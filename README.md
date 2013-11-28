basis
==
basis is a game server for [dotproduct](http://github.com/sharvil/dotproduct), an action-packed,
multiplayer space shooter. For a live demo, visit http://dotproduct.nanavati.net.

Version
--
1.0

Tech
--
basis is built on the following technologies:
 * [node.js](http://www.nodejs.org)
 * [Amazon DynamoDB](http://aws.amazon.com/dynamodb/)
 * [Google Closure Compiler](https://developers.google.com/closure/compiler/)

Installing
--
```bash
  git clone https://github.com/sharvil/basis.git
  cd basis
  npm install
```

Running
--
```bash
  node src/server.js accessKeyId=<key> secretAccessKey=<key> [options]
```

Where `accessKeyId` and `secretAccessKey` are your [Amazon keys](http://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSGettingStartedGuide/AWSCredentials.html) which will be used to store player stats in DynamoDB.
`options` consists of zero or more of the following:
 * port=&lt;port number to listen on&gt;
 * rootDir=&lt;path to dotproduct&gt;
 * arena=&lt;name of arena to run&gt;

License
--
Apache 2.0
