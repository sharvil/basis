var Core = require('./core.js');
var Logger = require('./logger.js').Logger;
var Path = require('path');

// Try to load credentials from aws.js. If the file doesn't exist, log
// the error and expect arguments on the command line instead.
var Aws = {};
try {
  Aws = require('./aws.js');
} catch (e) {
  Logger.log('aws.js not found, must specify accessKeyId and secretAccessKey on command line.');
}

var Options = function() {
  this.options_ = {};
  for(var i = 2; i < process.argv.length; ++i) {
    var kv = process.argv[i].split('=');
    if(kv.length < 2) {
      this.options_[kv] = true;
    } else {
      this.options_[kv[0]] = kv[1];
    }
  }
};

Options.prototype.getAuth = function() {
  if (this.options_['accessKeyId']) {
    Aws.accessKeyId = this.options_['accessKeyId'];
  }
  if (this.options_['secretAccessKey']) {
    Aws.secretAccessKey = this.options_['secretAccessKey'];
  }
  return Aws;
};

Options.prototype.getRootDir = function() {
  return this.options_['rootDir'] || Path.join('..', 'dotproduct');
};

Options.prototype.getArena = function() {
  return this.options_['arena'] || 'svs';
};

Options.prototype.getPort = function() {
  return this.options_['port'] || 8000;
};

Options.prototype.getIsOffline = function() {
  return this.options_['offline'] || false;
};

Options.prototype.getRandomSeed = function() {
  return parseInt(this.options_['seed']) || new Date().getTime();
};

Options.prototype.getDumpPackets = function() {
  return this.options_['dumpPackets'] || false;
}

exports.Options = Options;
