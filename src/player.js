var Core = require('./core.js');

var Dynode = require('dynode');

var Player = function(connection, id, name, team, completion, opt_skipDatabase) {
  this.connection_ = connection;

  this.id = id;
  this.name = name;
  this.team = team;
  this.started = false;
  this.isAlive = true;
  this.timestamp = 0;
  this.ship = 0;
  this.direction = 0;
  this.x = 0;
  this.y = 0;
  this.xVelocity = 0;
  this.yVelocity = 0;
  this.isSafe = false;
  this.bounty = 0;
  this.presence = 0;
  this.isBanned = false;
  this.hasCompletedTutorial = false;

  this.score = {
    points: 0,
    wins: 0,
    losses: 0
  };

  if(!opt_skipDatabase) {
    this.loadFromDatabase_(completion);
  } else {
    completion(this);
  }
};

Player.TABLE_NAME_ = 'dotproduct.Player';

Player.unban = function(playerId, completion) {
  Dynode.updateItem(Player.TABLE_NAME_, playerId, { isBanned: false }, function(error, result) {
    completion(!error);
  });
};

Player.prototype.send = function(message) {
  this.connection_.send(message);
};

Player.prototype.close = function() {
  // If someone is explicitly calling close on the connection,
  // we don't really need to notify them that the connection is
  // being closed.
  this.connection_.removeAllListeners('close');
  this.connection_.close();
  this.saveToDatabase_(Core.nullFunction);
};

Player.prototype.loadFromDatabase_ = function(completion) {
  // Get user data from database and update object. If we couldn't find
  // any user data, create a new row as this is a new user.
  var self = this;
  Dynode.getItem(Player.TABLE_NAME_, this.id, function(error, result) {
    if (result) {
      self.isBanned = (result.isBanned == 'true');
      self.hasCompletedTutorial = (result.hasCompletedTutorial == 'true');
      self.score.points = result.points || 0;
      self.score.wins = result.wins || 0;
      self.score.losses = result.losses || 0;
      completion(self);
    } else {
      var item = {
        id: self.id,
        name: self.name,
        isBanned: self.isBanned,
        hasCompletedTutorial: self.hasCompletedTutorial,
        points: self.score.points,
        wins: self.score.wins,
        losses: self.score.losses
      };

      Dynode.putItem(Player.TABLE_NAME_, item, {}, function() {
        completion(self);
      });
    }
  });
};

Player.prototype.saveToDatabase_ = function(completion) {
  var values = {
    isBanned: this.isBanned,
    hasCompletedTutorial: this.hasCompletedTutorial,
    points: this.score.points,
    wins: this.score.wins,
    losses: this.score.losses
  };

  Dynode.updateItem(Player.TABLE_NAME_, this.id, values, function() {
    completion();
  });
};

exports.Player = Player;
