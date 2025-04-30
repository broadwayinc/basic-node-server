# basic-node-server
Basic node server for everyone.

Basic node server simply hosts and serves files from the current project directory through HTTP.
If no path is given, or if the path ends with '/' or '\', it will serve the index.html file in the directory.

## Installation

```
npm install basic-node-server
```

## Usage

Then, you can run it from your project directory:

```
npx bns [port] 404=[404.page]
```

The [port] argument is optional. If no port is given, it will default to 3000.

For example, if you want to serve the current directory on port 8080, you would run:

```
npx bns 8080
```

If you need to setup additional 404 page you can do so by:

```
npx bns 8080 404=your404page.html
```

If you need to set response header to have no-caching settings:

```
npx bns 8080 404=your404page.html no-cache=true
```