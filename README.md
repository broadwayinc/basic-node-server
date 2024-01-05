# basic-node-server
Basic node server for everyone.

Basic node server simply hosts and serves files from the current project directory through HTTP.
If no path is given, it will serve the index.html file.

## How to use
```
npm run bns [port]
```

The [port] argument is optional. If no port is given, it will default to 3000.

For example, if you want to serve the current directory on port 8080, you would run:
```
npm run bns 8080
```

## NPM
This package is also available on NPM. To install it, run:

```
npm install basic-node-server

```

Then, to run it, run from your project directory:

```
node node_modules/basic-node-server/index.js [port]
```
