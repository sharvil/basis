var Core = require('./core.js');
var Logger = require('./logger.js');
var Path = require('path');

var Options = {};

Options.options_ = null;

Options.getRootDir = function() {
  return Options.options_['rootDir'] || Path.join('..', 'dotproduct');
};

Options.getPort = function() {
  return Options.options_['port'] || 8000;
};

Options.getRandomSeed = function() {
  return parseInt(Options.options_['seed']) || new Date().getTime();
};

Options.getDumpPackets = function() {
  return Options.options_['dumpPackets'] || false;
}

if (!Options.options_) {
  Options.options_ = {};
  for(var i = 2; i < process.argv.length; ++i) {
    var kv = process.argv[i].split('=');
    if(kv.length < 2) {
      Options.options_[kv] = true;
    } else {
      Options.options_[kv[0]] = kv[1];
    }
  }
}

module.exports = Options;
