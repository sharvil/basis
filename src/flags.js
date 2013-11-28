var Flag = function(id, team, xTile, yTile) {
  this.id = id;
  this.team = team;
  this.xTile = xTile;
  this.yTile = yTile;
};

var Flags = function(settings, map, tileProperties) {
  this.flags_ = [];

  for (var key in map) {
    var xTile = key % settings.map.width;
    var yTile = Math.floor(key / settings.map.width);
    var tile = map[key];
    if (tile >= 0 && tileProperties[tile]['object'] == 2 /* OBJECT_FLAG */) {
      this.flags_.push(new Flag(this.flags_.length, -1, xTile, yTile));
    }
  }
};

Flags.prototype.getFlag = function(id) {
  console.assert(Math.floor(id) == id, 'Flag id is not an integer: ' + id);

  var flag = this.flags_[id];
  return new Flag(flag.id, flag.team, flag.xTile, flag.yTile);
};

Flags.prototype.captureFlag = function(id, team) {
  console.assert(Math.floor(id) == id, 'Flag id is not an integer: ' + id);

  if (id < 0 || id >= this.flags_.length) {
    return false;
  }

  var flag = this.flags_[id];
  var changedOwnership = (flag.team != team);
  flag.team = team;
  return changedOwnership;
};

Flags.prototype.forEach = function(closure) {
  for (var i = 0; i < this.flags_.length; ++i) {
    closure(this.flags_[i]);
  }
};

exports.Flags = Flags;
