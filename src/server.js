var Core = require('./core.js');
var Game = require('./game.js');
var Options = require('./options.js');
var Logger = require('./logger.js');

var ChildProcess = require('child_process');
var Crypto = require('crypto');
var Fs = require('fs');
var HttpServer = require('http');
var Path = require('path');
var Url = require('url');
var Watch = require('watch');
var WebSocketServer = require('websocket').server;
var Zlib = require('zlib');

var Server = function() {
  var options = new Options();
  var rootDir = options.getRootDir();
  this.launchPath_ = process.cwd();
  process.chdir(rootDir);

  this.httpServer_ = HttpServer.createServer(Core.bind(this.onHttpRequest_, this));
  this.httpServer_.listen(options.getPort(), Core.bind(function() {
    Logger.log('basis started');
    Logger.log('  port: ' + options.getPort());
    Logger.log('  path: ' + options.getRootDir());
    Logger.log('  arena: ' + options.getArena());
    Logger.log('  database: ' + options.getDatabase());
  }, this));

  this.websocketServer_ = new WebSocketServer({ httpServer: this.httpServer_ });
  this.websocketServer_.on('request', Core.bind(this.onWebSocketRequest_, this));

  this.game_ = new Game(options, Core.bind(this.restartServer_, this), Core.bind(this.shutdownServer_, this));

  // Run this special tree watcher to invalidate all of the Javascript whenever
  // anything in the /js directory changes.
  Watch.watchTree('js/', Core.bind(this.invalidateCacheItem_, this, '/js/Application.js', { errorCode: 'EINTR' }));
};

Server.PROTOCOL_NAME_ = 'dotproduct.v1';
Server.REQUEST_PATH_ = '/dotproduct/v1/';
Server.DEFAULT_CONTENT_TYPE_ = 'text/plain';
Server.CONTENT_TYPE_MAP_ = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ttf': 'font/ttf',
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.bmp': 'image/x-ms-bmp',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav'
};

// Maps from path name to {etag, headers, content, waiters, watcher, uri}.
Server.DATA_CACHE_ = {};

Server.prototype.onHttpRequest_ = function(request, response) {
  var uri = Url.parse(request.url).pathname;

  if(uri == '/favicon.ico') {
    response.writeHead(200, { 'Expires': 'Mon 06 Oct 2028 12:43:48 GMT' });
    response.end();
    return;
  }

  this.readUri_(uri, function(cacheItem, error) {
    if(error) {
      response.writeHead(500);
      if(error.code == 'ENOENT') {
        response.writeHead(404);
      }
    } else if(cacheItem.etag.length && request.headers['if-none-match'] == cacheItem.etag) {
      response.writeHead(304);
    } else {
      response.writeHead(200, cacheItem.headers);
      response.write(cacheItem.content, 'binary');
    }
    response.end();
  });
};

Server.prototype.readUri_ = function(uri, completion) {
  var cacheItem = Server.DATA_CACHE_[uri];

  if(cacheItem) {
    // We have the content for this item cached already - serve up immediately.
    if(cacheItem.content) {
      completion(cacheItem, null);
    } else {
      console.assert(cacheItem.waiters, 'Repeated request for uri, expected waiters array to exist.');
      console.assert(cacheItem.waiters.length >= 1, 'Repeated request for uri, expected waiters array to have at least one existing waiter.');
      cacheItem.waiters.push(completion);
    }
    return;
  }

  cacheItem = {
    etag: '',
    headers: {},
    content: null,
    uri: uri,
    waiters: [completion],
    watcher: null
  };
  Server.DATA_CACHE_[uri] = cacheItem;

  this.readCacheItem_(cacheItem, Core.bind(this.onReadUriCompleted_, this));
};

Server.prototype.onReadUriCompleted_ = function(cacheItem, error) {
  if(error) {
    this.invalidateCacheItem_(cacheItem.uri, error);
    return;
  }

  this.compressCacheItem_(cacheItem, function(cacheItem) {
    for(var i = 0; i < cacheItem.waiters.length; ++i) {
      cacheItem.waiters[i](cacheItem, null);
    }
    cacheItem.waiters = [];
  });
};

Server.prototype.compressCacheItem_ = function(cacheItem, completion) {
  if(cacheItem.headers['Content-Encoding'] == 'gzip') {
    Zlib.gzip(cacheItem.content, function(err, result) {
      cacheItem.content = result;
      completion(cacheItem);
    });
  } else {
    completion(cacheItem);
  }
};

Server.prototype.readCacheItem_ = function(cacheItem, completion) {
  var uri = cacheItem.uri;
  if(uri == '/js/Application.js') {
    this.compileJavascript_(function(content) {
      var md5 = Crypto.createHash('md5');
      md5.update(content);
      cacheItem.etag = md5.digest('hex');
      cacheItem.content = content;
      cacheItem.headers['ETag'] = cacheItem.etag;
      cacheItem.headers['Content-Type'] = 'text/javascript';
      cacheItem.headers['Content-Encoding'] = 'gzip';
      completion(cacheItem, null);
    });
  } else {
    var stat;
    var filename = Path.join(process.cwd(), uri);
    try {
      stat = Fs.statSync(filename);
      if(stat.isDirectory()) {
        filename += '/index.html';
        stat = Fs.statSync(filename);
      }
    } catch(error) {
      completion(cacheItem, error);
      return;
    }

    var extension = Path.extname(filename);
    var contentType = Server.CONTENT_TYPE_MAP_[extension] || Server.DEFAULT_CONTENT_TYPE_;
    var contentEncoding = (contentType.indexOf('text/') == 0) ? 'gzip' : null;
    var self = this;

    Fs.readFile(filename, 'binary', function(error, file) {
      if(error) {
        completion(cacheItem, error);
        return;
      }
      cacheItem.etag = '' + stat.mtime.getTime();
      cacheItem.content = file;
      cacheItem.headers['ETag'] = cacheItem.etag;
      cacheItem.headers['Content-Type'] = contentType;
      cacheItem.watcher = Fs.watch(filename, Core.bind(self.invalidateCacheItem_, self, uri, null));
      if(contentEncoding) {
        cacheItem.headers['Content-Encoding'] = contentEncoding;
      }
      completion(cacheItem, null);
    });
  }
};

Server.prototype.invalidateCacheItem_ = function(uri, error) {
  var cacheItem = Server.DATA_CACHE_[uri];
  if(!cacheItem) {
    return;
  }

  if(cacheItem.watcher) {
    cacheItem.watcher.close();
    cacheItem.watcher = null;
  }

  if(cacheItem.waiters) {
    for(var i = 0; i < cacheItem.waiters.length; ++i) {
      cacheItem.waiters[i](cacheItem, error);
    }
    cacheItem.waiters = [];
  }

  delete Server.DATA_CACHE_[uri];
};

Server.prototype.compileJavascript_ = function(completion) {
  var options = { maxBuffer: 1024 * 1024 * 5 };
  var compilerPath = Path.join(this.launchPath_, 'tools', 'closure_compiler.jar');

  ChildProcess.exec('python ../closure/bin/calcdeps.py -i js/Application.js -o script --compiler_jar ' + compilerPath +  ' -p ../closure -p js', options, function(error, stdout, stderr) {
    completion(stdout);
  });
};

Server.prototype.onWebSocketRequest_ = function(request) {
  if(request.resourceURL.pathname != Server.REQUEST_PATH_) {
    request.reject(404);
    return;
  }

  try {
    this.game_.addConnection(request.accept(Server.PROTOCOL_NAME_, request.origin));
  } catch (e) {
    Logger.log('Exception while accepting socket: ' + e);
  }
};

Server.prototype.restartServer_ = function() {
  this.websocketServer_.unmount();
  this.httpServer_.close();

  var options = {
    cwd: this.launchPath_,
    detached: true,
    stdio: 'ignore'
  };
  ChildProcess.fork('src/server.js', process.argv.slice(2), options).unref();
};

Server.prototype.shutdownServer_ = function() {
  process.exit(0);
};

new Server();
