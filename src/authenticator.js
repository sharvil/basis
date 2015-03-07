var Https = require('https');

var Authenticator = {};

Authenticator.authenticate = function(strategy, token, completion) {
  if (!Authenticator.STRATEGIES_[strategy]) {
    completion({ 'error': 'invalid authentication strategy: ' + strategy + ', ' + Authenticator.STRATEGIES_[strategy]});
    return;
  }
  Authenticator.STRATEGIES_[strategy](token, completion);
};

Authenticator.facebookAuth_ = function(token, completion) {
  var fetchOptions = {
    host: 'graph.facebook.com',
    path: '/me?access_token=' + token
  };

  Authenticator.fetch_(fetchOptions, completion);
};

Authenticator.anonymousAuth_ = function(token, completion) {
  var authResponse = {
    id: 'anon/' + Authenticator.UNIQUE_ID_++,
    name: 'testing'
  };

  completion(authResponse);
};

Authenticator.fetch_ = function(options, completion) {
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

Authenticator.STRATEGIES_ = {
  facebook: Authenticator.facebookAuth_,
  anonymous: Authenticator.anonymousAuth_
};

Authenticator.UNIQUE_ID_ = 0;

module.exports = Authenticator;
