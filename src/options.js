var Core = require('./core.js');
var Logger = require('./logger.js');
var Path = require('path');

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

Options.prototype.getRootDir = function() {
  return this.options_['rootDir'] || Path.join('..', 'dotproduct');
};

Options.prototype.getArena = function() {
  return this.options_['arena'] || 'svs';
};

Options.prototype.getDatabase = function() {
  return this.options_['db'] || null;
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

module.exports = Options;
