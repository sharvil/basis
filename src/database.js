var LevelDB = require('node-leveldb');

var Database = function(dbName) {
  this.db_ = null;
  if (dbName) {
    this.db_ = new LevelDB();
	  this.db_.open(dbName);
  }
};

Database.prototype.get = function(table, key, completion) {
  if (!this.db_) {
    completion(new Error('Running without a database.'), null);
  }

  var value = this.db_.get(table + '/' + key);
  try {
    completion(null, JSON.parse(value));
  } catch (e) {
    completion(e, null);
  }
};

Database.prototype.set = function(table, key, valueJson, completion) {
  if (!this.db_) {
    completion(new Error('Running without a database.'));
  }

  this.db_.set(table + '/' + key, JSON.stringify(valueJson));
  completion(null);
};

module.exports = Database;
