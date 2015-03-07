var MersenneTwister = require('./mersenne.js');

var MAX_TEAMS = 10000;

function calculateHistogram(maxTeams, playerList) {
  var histogram = new Array(maxTeams);
  for (var i = 0; i < maxTeams; ++i) {
    histogram[i] = 0;
  }

  playerList.forEach(function(p) {
    ++histogram[p.team];
  });

  return histogram;
}

// ---------------------------------------------------------------------------------------------

var FreeForAll = function() {
  this.nextTeam_ = 0;
};

FreeForAll.prototype.placeOnTeam = function(playerList) {
  var ret = this.nextTeam_;
  this.nextTeam_ = (this.nextTeam_ + 1) % MAX_TEAMS;
  return ret;
};

// ---------------------------------------------------------------------------------------------

var Random = function(maxTeams) {
  console.assert(maxTeams > 1, 'Must provide a positive integer for maxTeams.');
  console.assert(maxTeams <= MAX_TEAMS, 'maxTeams must be between 0 and ' + MAX_TEAMS);

  this.maxTeams_ = maxTeams;
  this.prng_ = new MersenneTwister();
};

Random.prototype.placeOnTeam = function(playerList) {
  return this.prng_.genrand_int32() % this.maxTeams_;
};

// ---------------------------------------------------------------------------------------------

var UniformBalanced = function(maxTeams) {
  console.assert(maxTeams > 1, 'Must provide a positive integer for maxTeams.');
  console.assert(maxTeams <= MAX_TEAMS, 'maxTeams must be between 0 and ' + MAX_TEAMS);

  this.maxTeams_ = maxTeams;
};

UniformBalanced.prototype.placeOnTeam = function(playerList) {
  var histogram = calculateHistogram(this.maxTeams_, playerList);

  var smallestTeam = 0;
  for (var i = 1; i < this.maxTeams_; ++i) {
    if (histogram[i] < histogram[smallestTeam]) {
      smallestTeam = i;
    }
  }
  return smallestTeam;
};

// ---------------------------------------------------------------------------------------------
// Note: the FlexibleBalanced code is currently incomplete and generally broken.
// ---------------------------------------------------------------------------------------------

var FlexibleBalanced = function(capacity, maxTeams) {
  console.assert(capacity > 0, 'Each team must have a positive capacity.');
  console.assert(maxTeams > 1, 'Must provide a positive integer for maxTeams.');
  console.assert(maxTeams <= MAX_TEAMS, 'maxTeams must be between 0 and ' + MAX_TEAMS);

  this.capacity_ = capacity;
  this.maxTeams_ = maxTeams;
  this.teamState_ = new Array(maxTeams);

  for (var i = 0; i < this.teamState_.length; ++i) {
    this.teamState_[i] = 0;
  }
};

FlexibleBalanced.prototype.placeOnTeam = function(playerList) {
  // Open a new team when all current teams are >= capacity
  var histogram = calculateHistogram(this.maxTeams_, playerList);

  var largestClosedTeam = -1;
  var smallestOpenTeam = -1;
  var emptySlots = 0;
  for (var i = 0; i < this.maxTeams_; ++i) {
    if (this.teamState_[i] == 0) {
      if (largestClosedTeam == -1 || histogram[i] > histogram[largestClosedTeam]) {
        largestClosedTeam = i;
      }
      continue;
    }

    emptySlots += Math.max(this.capacity_ - histogram[i], 0);
    if (smallestOpenTeam == -1 || histogram[i] < histogram[smallestOpenTeam]) {
      smallestOpenTeam = i;
    }
  }

  // Close the smallest team if there are |capacity| empty slots in the sum of all other teams.
  if (smallestOpenTeam != -1 && emptySlots - Math.max(this.capacity_ - histogram[smallestOpenTeam], 0) >= this.capacity_) {
    this.teamState_[smallestOpenTeam] = 0;
  }

  // Open up a team to place this player if there are no more slots.
  if (emptySlots == 0 && largestClosedTeam != -1) {
    this.teamState_[i] = 1;
  }
};

module.exports = {
  'FreeForAll': FreeForAll,
  'Random': Random,
  'UniformBalanced': UniformBalanced
};
