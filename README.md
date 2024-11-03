# basic-node-server
Basic node server for everyone.

Basic node server simply hosts and serves files from the current project directory through HTTP.
If no path is given, it will serve the index.html file in the root directory.

## Installation

```
npm install basic-node-server

```

## Usage

Then, you can run it from your project directory:

```
npx bns [port]
```

The [port] argument is optional. If no port is given, it will default to 3000.

For example, if you want to serve the current directory on port 8080, you would run:

```
node bns 8080
```