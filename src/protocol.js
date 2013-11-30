var Core = require('./core.js');

var Protocol = {};

Protocol.SYSTEM_PLAYER_ID = '0';

Protocol.C2SPacketType = {
  LOGIN: 1,
  START_GAME: 2,
  POSITION: 3,
  CLOCK_SYNC: 4,
  PLAYER_DIED: 5,
  CHAT_MESSAGE: 6,
  SHIP_CHANGE: 7,
  QUERY_NAME: 8,
  REGISTER_NAME: 9,
  PRIZE_COLLECTED: 10,
  SET_PRESENCE: 11,
  TUTORIAL_COMPLETED: 12,
  FLAG_CAPTURED: 13
};

Protocol.S2CPacketType = {
  LOGIN_REPLY: 1,
  PLAYER_ENTERED: 2,
  PLAYER_LEFT: 3,
  PLAYER_POSITION: 4,
  CLOCK_SYNC_REPLY: 5,
  PLAYER_DIED: 6,
  CHAT_MESSAGE: 7,
  SHIP_CHANGE: 8,
  SCORE_UPDATE: 9,
  QUERY_NAME_REPLY: 10,
  REGISTER_NAME_REPLY: 11,
  PRIZE_SEED_UPDATE: 12,
  PRIZE_COLLECTED: 13,
  SET_PRESENCE: 14,
  FLAG_UPDATE: 15
};

Protocol.buildLoginSuccess = function(resources, settings, map, tileProperties, player) {
  settings.id = player.id;
  settings.name = player.name;
  settings.team = player.team;
  settings.showTutorial = !player.hasCompletedTutorial;
  return [Protocol.S2CPacketType.LOGIN_REPLY, 1 /* success code */, resources, settings, map, tileProperties];
};

Protocol.buildPlayerJoined = function(player) {
  return [Protocol.S2CPacketType.PLAYER_ENTERED, player.id, player.name, player.team, player.isAlive, player.ship, player.bounty, player.presence];
};

Protocol.buildPlayerLeft = function(player) {
  return [Protocol.S2CPacketType.PLAYER_LEFT, player.id];
};

Protocol.buildPlayerPosition = function(player, opt_projectile) {
  var ret = [Protocol.S2CPacketType.PLAYER_POSITION, player.timestamp, player.id, player.direction, player.x, player.y, player.xVelocity, player.yVelocity, player.isSafe];
  if (opt_projectile) {
    ret.push(opt_projectile);
  }
  return ret;
};

Protocol.buildClockSyncReply = function(timestamp) {
  return [Protocol.S2CPacketType.CLOCK_SYNC_REPLY, timestamp, Core.timestamp()];
};

Protocol.buildPlayerDeath = function(timestamp, x, y, player, killer, gainedBounty) {
  return [Protocol.S2CPacketType.PLAYER_DIED, timestamp, x, y, player.id, killer.id, gainedBounty];
};

Protocol.buildChatMessage = function(player, message) {
  var playerId = !!player ? player.id : Protocol.SYSTEM_PLAYER_ID;
  return [Protocol.S2CPacketType.CHAT_MESSAGE, playerId, message];
};

Protocol.buildShipChange = function(player) {
  return [Protocol.S2CPacketType.SHIP_CHANGE, player.id, player.ship];
};

Protocol.buildScoreUpdate = function(player) {
  return [Protocol.S2CPacketType.SCORE_UPDATE, player.id, player.score.points, player.score.wins, player.score.losses];
};

Protocol.buildPrizeSeedUpdate = function(seed, timestamp) {
  return [Protocol.S2CPacketType.PRIZE_SEED_UPDATE, seed, timestamp];
};

Protocol.buildPrizeCollected = function(player, type, xTile, yTile) {
  return [Protocol.S2CPacketType.PRIZE_COLLECTED, player.id, type, xTile, yTile];
};

Protocol.buildSetPresence = function(player) {
  return [Protocol.S2CPacketType.SET_PRESENCE, player.id, player.presence];
};

Protocol.buildFlagUpdate = function(flag) {
  return [Protocol.S2CPacketType.FLAG_UPDATE, flag.id, flag.team, flag.xTile, flag.yTile];
};

exports.Protocol = Protocol;
