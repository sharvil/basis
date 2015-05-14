var Authenticator = require('./authenticator.js');
var Core = require('./core.js');
var Connection = require('./connection.js');
var Database = require('./database.js');
var Flags = require('./flags.js');
var Logger = require('./logger.js');
var MersenneTwister = require('./mersenne.js');
var Options = require('./options.js');
var Player = require('./player.js');
var PlayerList = require('./playerlist.js');
var Protocol = require('./protocol.js');
var Teams = require('./teams.js');

var Fs = require('fs');
var Util = require('util');

var Game = function(arena, restartFunction, shutdownFunction) {
  this.isLameduck_ = false;

  this.database_ = new Database('data/arenas/' + arena + '/db');
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

  this.prng_ = new MersenneTwister(Options.getRandomSeed());
  this.onPrizeSeedUpdate_();
  setInterval(Core.bind(this.onPrizeSeedUpdate_, this), Game.PRIZE_SEED_UPDATE_PERIOD_);
};

Game.PRIZE_SEED_UPDATE_PERIOD_ = 2 * 60 * 1000;

Game.prototype.addConnection = function(webSocket) {
  var connection = new Connection(webSocket);
  connection.on('close', Core.bind(this.removeConnection, this));
  connection.on(Protocol.C2SPacketType.LOGIN, Core.bind(this.onLoginPacket_, this, connection));

  this.connections_.push(connection);
};

Game.prototype.removeConnection = function(connection) {
  this.connections_.removeObject(connection);
};

// Called when this arena should be closed and put into lame duck mode.
Game.prototype.close = function() {
  if (this.isLameduck_) {
    return;
  }

  this.isLameduck_ = true;
  this.database_.close();
  this.playerList_.broadcastAll(Protocol.buildChatMessage(null, 'This server is now closed. Refresh your browser to join the new server.'));
};

Game.prototype.onPrizeSeedUpdate_ = function() {
  this.prizeSeed_ = this.prng_.genrand_int32();
  this.prizeSeedTimestamp_ = Core.timestamp();
  this.playerList_.broadcastAll(Protocol.buildPrizeSeedUpdate(this.prizeSeed_, this.prizeSeedTimestamp_));
};

Game.prototype.onLoginPacket_ = function(connection, message) {
  var completion = Core.bind(function(authResponse) {
    if(authResponse.error) {
      console.error('Error logging user in: ' + Util.inspect(authResponse));
      connection.close();
      return;
    }

    // Remove any existing players with the same id.
    var oldPlayer = this.playerList_.findById(authResponse.id);
    if(oldPlayer) {
      this.onPlayerLeft_(oldPlayer);
    }

    // Add the new player to the game.
    var team = this.teamAllocator_.placeOnTeam(this.playerList_);
    new Player(connection, authResponse.id, authResponse.name, team, Core.bind(function(player) {
      if(player.isBanned()) {
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
    }, this), this.database_);
  }, this);

  Authenticator.authenticate(message[0].strategy, message[0].accessToken, completion);
};

Game.prototype.onStartGamePacket_ = function(player, message) {
  player.started = true;
  player.ship = message[0];

  player.send(Protocol.buildPrizeSeedUpdate(this.prizeSeed_, this.prizeSeedTimestamp_));

  this.flags_.forEach(function(flag) {
    player.send(Protocol.buildFlagUpdate(flag));
  });

  this.playerList_.forEach(function(other) {
    if(other.started && player != other) {
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
    this.playerList_.broadcast(player, Protocol.buildPlayerPosition(player, message[7]));
  }
};

Game.prototype.onPlayerDiedPacket_ = function(player, message) {
  var x = message[0];
  var y = message[1];
  var killerId = message[2];
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

  this.playerList_.broadcast(player, Protocol.buildPlayerDeath(x, y, player, killer, gainedBounty));
};

Game.prototype.onClockSyncPacket_ = function(player, message) {
  player.send(Protocol.buildClockSyncReply(message[0]));
};

Game.prototype.onChatMessagePacket_ = function(player, message) {
  var text = message[0];

  if(player.isSysop() && text[0] == '*') {
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
          bannedPlayer.ban();
          bannedPlayer.send(Protocol.buildChatMessage(null, 'You have been banned from the game. Please contact sharvil.nanavati@gmail.com if you believe the ban was made in error.'));
          player.send(Protocol.buildChatMessage(null, 'Player ' + bannedPlayer.name + '(' + bannedPlayer.id + ') banned.'));
          this.onPlayerLeft_(bannedPlayer);
        }
        break;

      case '*unban':
        Player.unban(this.database_, rest, function(success) {
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
        } else {
          player.send(Protocol.buildChatMessage(null, 'Server is already in lameduck mode.'));
        }
        break;

      case '*shutdown':
        this.database_.close();
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

module.exports = Game;
