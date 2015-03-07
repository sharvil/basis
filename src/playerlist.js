var Core = require('./core.js');

var PlayerList = function() {
  this.players_ = [];
};

PlayerList.prototype.addPlayer = function(player) {
  this.players_.push(player);
};

PlayerList.prototype.removePlayer = function(player) {
  player.close();
  this.players_.removeObject(player);
};

PlayerList.prototype.isEmpty = function() {
  return this.players_.length == 0;
};

PlayerList.prototype.findById = function(id) {
  for(var i = 0; i < this.players_.length; ++i) {
    if(this.players_[i].id == id) {
      return this.players_[i];
    }
  }
  return null;
};

PlayerList.prototype.forEach = function(callback) {
  this.players_.forEach(callback);
};

PlayerList.prototype.broadcast = function(excludedPlayer, message) {
  this.players_.forEach(function(player) {
    if(player.started && player != excludedPlayer) {
      player.send(message);
    }
  });
};

PlayerList.prototype.broadcastAll = function(message) {
  this.players_.forEach(function(player) {
    if(player.started) {
      player.send(message);
    }
  });
}

module.exports = PlayerList;
