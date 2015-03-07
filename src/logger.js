var Logger = function() {};

Logger.log = function(format) {
  arguments[0] = '[' + new Date().toUTCString() + '] ' + arguments[0];
  console.log.apply(null, arguments);
};

module.exports = Logger;
