# simple-node-server
Simple node server for everyone.

Simple node server hosts and serves files from the current directory.
If no path is given, it will serve the index.html file.

## How to use
```
npm run sns [port]
```

The [port] argument is optional. If no port is given, it will default to 3000.

For example, if you want to serve the current directory on port 8080, you would run:
```
npm run sns 8080
```
