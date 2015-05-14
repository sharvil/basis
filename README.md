# basis

basis is a game server for [dotproduct](http://github.com/sharvil/dotproduct), an action-packed,
multiplayer space shooter. For a live demo, visit http://dotproduct.nanavati.net.

### Tech
basis is built on the following technologies:

 * [Node.js](http://www.nodejs.org)
 * [LevelDB](https://github.com/google/leveldb)
 * [Google Closure Compiler](https://developers.google.com/closure/compiler/)
 * [Google Closure Library](https://developers.google.com/closure/library/)

### Installing

```bash
  git clone https://github.com/sharvil/basis.git
  cd basis
  npm install
```

### Running
```bash
  node src/server.js [options]
```

`options` consists of zero or more of the following:

 * port=&lt;port number to listen on&gt;
 * rootDir=&lt;path to dotproduct&gt;

### License
Apache 2.0
