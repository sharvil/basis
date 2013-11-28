var Core = require('./core.js');
var Connection = require('./connection.js').Connection;
var Flags = require('./flags.js').Flags;
var Logger = require('./logger.js').Logger;
var MersenneTwister = require('./mersenne.js').MersenneTwister;
var Player = require('./player.js').Player;
var PlayerList = require('./playerlist.js').PlayerList;
var Projectile = require('./projectile.js').Projectile;
var Protocol = require('./protocol.js').Protocol;
var Teams = require('./teams.js').Teams;

var Fs = require('fs');
var Https = require('https');
var Util = require('util');

var SHARVIL_FACEBOOK_ID = '615600520';

var Game = function(options, restartFunction, shutdownFunction) {
  this.options_ = options;
  this.isLameduck_ = false;

  var arena = this.options_.getArena();
  this.resources_ = JSON.parse(Fs.readFileSync('data/arenas/' + arena + '/resources.json'));
  this.settings_ = JSON.parse(Fs.readFileSync('data/arenas/' + arena + '/settings.json'));
  this.map_ = JSON.parse(Fs.readFileSync('data/arenas/' + arena + '/map.json'));
  this.tileProperties_ = JSON.parse(Fs.readFileSync('data/arenas/' + arena + '/tile_properties.json'));

  // Function to call when we want to restart the server.
  this.restartFunction_ = restartFunction;

  // Function to call when we want to shut down the server.
  this.shutdownFunction_ = shutdownFunction;

  this.connections_ = [];
  this.playerList_ = new PlayerList();
  this.teamAllocator_ = new Teams.UniformBalanced(this.settings_.game.maxTeams);
  this.flags_ = new Flags(this.settings_, this.map_, this.tileProperties_);

  this.prng_ = new MersenneTwister(options.getRandomSeed());
  this.onPrizeSeedUpdate_();
  setInterval(Core.bind(this.onPrizeSeedUpdate_, this), Game.PRIZE_SEED_UPDATE_PERIOD_);
};

Game.PRIZE_SEED_UPDATE_PERIOD_ = 2 * 60 * 1000;

// Hack
Game.prototype.get_ = function(options, completion) {
  if(this.options_.getIsOffline()) {
    if (this.hack_ === undefined) {
      this.hack_ = 0;
    }
    ++this.hack_;
    completion({ id: SHARVIL_FACEBOOK_ID + this.hack_, name: 'Sharvil Nanavati ' + this.hack_ });
    return;
  }

  Https.get(options, function(result) {
    var collectedResponse = '';
    result.on('data', function(data) {
      collectedResponse += data.toString();
    });
    result.on('end', function() {
      completion(JSON.parse(collectedResponse));
    });
  });
};

Game.prototype.addConnection = function(webSocket) {
  var connection = new Connection(this.options_, webSocket);
  connection.on('close', Core.bind(this.removeConnection, this));
  connection.on(Protocol.C2SPacketType.LOGIN, Core.bind(this.onLoginPacket_, this, connection));

  this.connections_.push(connection);
};

Game.prototype.removeConnection = function(connection) {
  this.connections_.removeObject(connection);
};

Game.prototype.onPrizeSeedUpdate_ = function() {
  this.prizeSeed_ = this.prng_.genrand_int32();
  this.prizeSeedTimestamp_ = Core.timestamp();
  this.playerList_.broadcastAll(Protocol.buildPrizeSeedUpdate(this.prizeSeed_, this.prizeSeedTimestamp_));
};

Game.prototype.onLoginPacket_ = function(connection, message) {
  var completion = Core.bind(function(facebookData) {
    if(facebookData.error) {
      console.error('Error logging user in: ' + Util.inspect(facebookData));
      connection.close();
      return;
    }

    // Remove any existing players with the same id.
    var oldPlayer = this.playerList_.findById(facebookData.id);
    if(oldPlayer) {
      this.onPlayerLeft_(oldPlayer);
    }

    // Add the new player to the game.
    var team = this.teamAllocator_.placeOnTeam(this.playerList_);
    new Player(connection, facebookData.id, facebookData.name, team, Core.bind(function(player) {
      if(player.isBanned && player.id != SHARVIL_FACEBOOK_ID) {
        Logger.log('Rejecting banned player: ' + player.name);
        connection.close();
        return;
      }
      this.playerList_.addPlayer(player);

      connection.send(Protocol.buildLoginSuccess(this.resources_, this.settings_, this.map_, this.tileProperties_, player));

      this.removeConnection(connection);
      connection.removeAllListeners('close');
      connection.on('close', Core.bind(this.onPlayerLeft_, this, player));
      connection.on(Protocol.C2SPacketType.START_GAME, Core.bind(this.onStartGamePacket_, this, player));
      connection.on(Protocol.C2SPacketType.POSITION, Core.bind(this.onPositionPacket_, this, player));
      connection.on(Protocol.C2SPacketType.CLOCK_SYNC, Core.bind(this.onClockSyncPacket_, this, player));
      connection.on(Protocol.C2SPacketType.PRIZE_COLLECTED, Core.bind(this.onPrizeCollected_, this, player));
      connection.on(Protocol.C2SPacketType.PLAYER_DIED, Core.bind(this.onPlayerDiedPacket_, this, player));
      connection.on(Protocol.C2SPacketType.CHAT_MESSAGE, Core.bind(this.onChatMessagePacket_, this, player));
      connection.on(Protocol.C2SPacketType.SHIP_CHANGE, Core.bind(this.onShipChangePacket_, this, player));
      connection.on(Protocol.C2SPacketType.SET_PRESENCE, Core.bind(this.onSetPresencePacket_, this, player));
      connection.on(Protocol.C2SPacketType.TUTORIAL_COMPLETED, Core.bind(this.onTutorialCompleted_, this, player));
      connection.on(Protocol.C2SPacketType.FLAG_CAPTURED, Core.bind(this.onFlagCaptured_, this, player));
      Logger.log('[%s] entered the game.', player.name);
    }, this), this.options_.getIsOffline());
  }, this);

  this.get_({ host: 'graph.facebook.com', path: '/me?access_token=' + message[0].accessToken }, completion);
};

Game.prototype.onStartGamePacket_ = function(player, message) {
  player.started = true;
  player.ship = message[0];

  player.send(Protocol.buildPrizeSeedUpdate(this.prizeSeed_, this.prizeSeedTimestamp_));

  this.flags_.forEach(function(flag) {
    player.send(Protocol.buildFlagUpdate(flag));
  });

  this.playerList_.forEach(function(other) {
    if(player != other) {
      player.send(Protocol.buildPlayerJoined(other));
      player.send(Protocol.buildPlayerPosition(other));
      player.send(Protocol.buildScoreUpdate(other));
    }
  });

  this.playerList_.broadcast(player, Protocol.buildPlayerJoined(player));
  this.playerList_.broadcastAll(Protocol.buildScoreUpdate(player));
};

Game.prototype.onPlayerLeft_ = function(player) {
  this.playerList_.broadcast(player, Protocol.buildPlayerLeft(player));
  this.playerList_.removePlayer(player);
  Logger.log('[%s] left the game.', player.name);

  // If we're lameducking and all clients have now disconnected,
  // it's time to shut down this server process.
  if (this.isLameduck_ && this.playerList_.isEmpty()) {
    this.shutdownFunction_();
  }
};

Game.prototype.onPositionPacket_ = function(player, message) {
  player.timestamp = message[0];
  player.direction = message[1];
  player.x = message[2];
  player.y = message[3];
  player.xVelocity = message[4];
  player.yVelocity = message[5];
  player.isSafe = message[6];
  player.isAlive = true;

  if(message.length <= 7) {
    this.playerList_.broadcast(player, Protocol.buildPlayerPosition(player));
  } else {
    var projectile = new Projectile(message[7], message[8], message[9], message[10], message[11], message[12], message[13]);
    this.playerList_.broadcast(player, Protocol.buildPlayerPosition(player, projectile));
  }
};

Game.prototype.onPlayerDiedPacket_ = function(player, message) {
  var timestamp = message[0];
  var x = message[1];
  var y = message[2];
  var killerId = message[3];
  var killer = this.playerList_.findById(killerId);

  if(!killer) {
    return;
  }

  var gainedBounty = player.bounty;
  killer.score.points += this.settings_.game.killPoints + gainedBounty;
  ++killer.score.wins;

  ++player.score.losses;
  player.bounty = 0;
  player.isAlive = false;

  this.playerList_.broadcast(player, Protocol.buildPlayerDeath(timestamp, x, y, player, killer, gainedBounty));
};

Game.prototype.onClockSyncPacket_ = function(player, message) {
  player.send(Protocol.buildClockSyncReply(message[0]));
};

Game.prototype.onChatMessagePacket_ = function(player, message) {
  var text = message[0];

  if(player.id == SHARVIL_FACEBOOK_ID && text[0] == '*') {
    var command = text.split(' ')[0];
    var rest = text.split(' ').slice(1).join(' ');
    switch(command) {
      case '*lookup':
        this.playerList_.forEach(function(other) {
          if (other.name.toLowerCase().indexOf(rest.toLowerCase()) != -1) {
            player.send(Protocol.buildChatMessage(null, other.name + ' = ' + other.id));
          }
        });
        break;

      case '*ban':
        var bannedPlayer = this.playerList_.findById(rest);
        if(!bannedPlayer) {
          player.send(Protocol.buildChatMessage(null, 'No player found with id ' + rest));
        } else {
          bannedPlayer.isBanned = true;
          bannedPlayer.send(Protocol.buildChatMessage(null, 'You have been banned from the game. Please contact sharvil.nanavati@gmail.com if you believe the ban was made in error.'));
          player.send(Protocol.buildChatMessage(null, 'Player ' + bannedPlayer.name + '(' + bannedPlayer.id + ') banned.'));
          this.onPlayerLeft_(bannedPlayer);
        }
        break;

      case '*unban':
        Player.unban(rest, function(success) {
          if(success) {
            player.send(Protocol.buildChatMessage(null, 'Player successfully unbanned.'));
          } else {
            player.send(Protocol.buildChatMessage(null, 'Unable to unban player.'));
          }
        });
        break;

      case '*msg':
        this.playerList_.broadcastAll(Protocol.buildChatMessage(null, rest));
        break;

      case '*restart':
        if (!this.isLameduck_) {
          this.restartFunction_();
          this.isLameduck_ = true;
          player.send(Protocol.buildChatMessage(null, 'Forked a new server and entered lameduck mode.'));
          this.playerList_.broadcastAll(Protocol.buildChatMessage(null, 'This server is now closed. Refresh your browser to join the new server.'));
        } else {
          player.send(Protocol.buildChatMessage(null, 'Server is already in lameduck mode.'));
        }
        break;

      case '*shutdown':
        this.shutdownFunction_();
        break;

      default:
        player.send(Protocol.buildChatMessage(null, 'Invalid command: ' + command + '. Try *ban <id>, *unban <id>, *lookup <name> or *msg <message>.'))
        break;
    }
  } else {
    this.playerList_.broadcast(player, Protocol.buildChatMessage(player, text));
  }
};

Game.prototype.onShipChangePacket_ = function(player, message) {
  player.ship = message[0];
  this.playerList_.broadcast(player, Protocol.buildShipChange(player));
};

Game.prototype.onPrizeCollected_ = function(player, message) {
  ++player.bounty;
  this.playerList_.broadcast(player, Protocol.buildPrizeCollected(player, message[0], message[1], message[2]));
};

Game.prototype.onSetPresencePacket_ = function(player, message) {
  player.presence = message[0];
  this.playerList_.broadcast(player, Protocol.buildSetPresence(player));
};

Game.prototype.onTutorialCompleted_ = function(player, message) {
  player.hasCompletedTutorial = true;
};

Game.prototype.onFlagCaptured_ = function(player, message) {
  // TODO: ensure proper ordering of the packet based on timestamp. If the incoming packet
  // is older than the last update we sent out for that flag, we should silently drop the packet.
  var timestamp = message[0];
  var id = message[1] >>> 0;
  if (this.flags_.captureFlag(id, player.team)) {
    var flag = this.flags_.getFlag(id);
    this.playerList_.broadcastAll(Protocol.buildFlagUpdate(flag));
  }
};

exports.Game = Game;
