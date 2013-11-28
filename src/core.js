var bind = function(fn, selfObj) {
  if(arguments.length > 2) {
    var boundArgs = Array.prototype.slice.call(arguments, 2);
    return function() {
      newArgs = Array.prototype.slice.call(arguments);
      Array.prototype.unshift.apply(newArgs, boundArgs);
      return fn.apply(selfObj, newArgs);
    };
  }
  return function() {
    return fn.apply(selfObj, arguments);
  };
};

var join = function(functions, completion) {
  var dict = {};
  var count = Object.keys(functions).length;
  for(var name in functions) {
    functions[name](bind(function(name) {
      dict[name] = Array.prototype.slice.call(arguments, 1);
      if(!--count) {
        completion(dict);
      }
    }, null, name));
  }
};

var nullFunction = function() {};

Array.prototype.removeObject = function(obj) {
  var idx = this.indexOf(obj);
  if (idx != -1) {
    this.splice(idx, 1);
  }
};

var randomString = function(opt_stringLength) {
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
  var ret = '';
  var stringLength = opt_stringLength || 16;
  for(var i = 0; i < stringLength; ++i) {
    var rnum = Math.floor(Math.random() * chars.length);
    ret += chars.substring(rnum, rnum + 1);
  }
  return ret;
};

var timestamp = function() {
  return +new Date >>> 0;
};

exports.bind = bind;
exports.join = join;
exports.nullFunction = nullFunction;
exports.randomString = randomString;
exports.timestamp = timestamp;
