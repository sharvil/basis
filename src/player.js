var Core = require('./core.js');

var Player = function(connection, id, name, team, completion, database) {
  this.connection_ = connection;
  this.database_ = database;

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

  this.loadFromDatabase_(completion);
};

Player.TABLE_NAME_ = 'player';

Player.unban = function(database, playerId, completion) {
  // Read-modify-write on the player object.
  database.get(Player.TABLE_NAME_, playerId, function(error, result) {
    if (error) {
      completion(!error);
    } else {
      result.isBanned = false;
      database.set(Player.TABLE_NAME_, playerId, function(error) {
        completion(!error);
      });
    }
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
  this.database_.get(Player.TABLE_NAME_, this.id, function(error, result) {
    if (result) {
      self.isBanned = result.isBanned || false;
      self.hasCompletedTutorial = result.hasCompletedTutorial || false;
      self.score.points = result.points || 0;
      self.score.wins = result.wins || 0;
      self.score.losses = result.losses || 0;
      completion(self);
    } else {
      var item = {
        name: self.name,
        isBanned: self.isBanned,
        hasCompletedTutorial: self.hasCompletedTutorial,
        points: self.score.points,
        wins: self.score.wins,
        losses: self.score.losses
      };

      self.database_.set(Player.TABLE_NAME_, self.id, item, function() {
        completion(self);
      });
    }
  });
};

Player.prototype.saveToDatabase_ = function(completion) {
  var values = {
    name: this.name,
    isBanned: this.isBanned,
    hasCompletedTutorial: this.hasCompletedTutorial,
    points: this.score.points,
    wins: this.score.wins,
    losses: this.score.losses
  };

  this.database_.set(Player.TABLE_NAME_, this.id, values, function() {
    completion();
  });
};

exports.Player = Player;
