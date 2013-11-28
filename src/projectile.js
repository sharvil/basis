var Core = require('./core.js');

var Projectile = function(type, level, bounceCount, x, y, xVelocity, yVelocity) {
  this.type = type;
  this.level = level;
  this.bounceCount = bounceCount;
  this.x = x;
  this.y = y;
  this.xVelocity = xVelocity;
  this.yVelocity = yVelocity;
};

exports.Projectile = Projectile;
