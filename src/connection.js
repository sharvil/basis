var Core = require('./core.js');

var Events = require('events');
var Util = require('util');

var Connection = function(options, webSocket) {
  Events.EventEmitter.call(this);

  this.dumpPackets_ = options.getDumpPackets();
  this.socket_ = webSocket;
  this.socket_.on('message', Core.bind(this.onMessage_, this));
  this.socket_.on('close', Core.bind(this.emit, this, 'close', this));
};
Util.inherits(Connection, Events.EventEmitter);

Connection.prototype.send = function(message) {
  console.assert(Util.isArray(message), 'Must only send array objects through Connection.');
  try {
    if (this.dumpPackets_) {
      console.log('S2C\n---\n' + JSON.stringify(message) + '\n');
    }
    this.socket_.send(JSON.stringify(message));
  } catch(e) {
    console.error('Unable to stringify message: ', message);
  }
};

Connection.prototype.close = function() {
  this.socket_.close();
};

Connection.prototype.onMessage_ = function(message) {
  if(message.type != 'utf8') {
    this.socket_.close();
    return;
  }

  try {
    var request = JSON.parse(message.utf8Data);
    if(!Util.isArray(request)) {
      this.socket_.close();
      return;
    }
    if (this.dumpPackets_) {
      console.log('C2S\n---\n' + message.utf8Data + '\n');
    }
    this.emit(request[0], request.slice(1));
  } catch(e) {
    this.socket_.close();
  }
};

module.exports = Connection;
