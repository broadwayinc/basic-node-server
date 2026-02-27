# basic-node-server

A small static file server for local hosting and quick testing.

It serves files from your current working directory over HTTP.

- If the request path is `/` (or ends with `/`), it serves `index.html`.
- It only serves files inside the current directory.
- It supports conditional caching via `ETag` and `Last-Modified` (`304 Not Modified`).

## Installation

```bash
npm install basic-node-server
```

## Quick Start

```bash
npx bns
```

Default port is `3000`.

## Usage

```bash
npx bns [port=<number>] [404=<file>] [no-cache=true]
```

Show CLI help:

```bash
npx bns --help
```

## Options

- `port=<number>`: Optional port number (`1-65535`), defaults to `3000`.
- `404=<file>`: Optional custom 404 page (must be inside current directory).
- `no-cache=true`: Adds no-cache headers (`Cache-Control`, `Pragma`, `Expires`).

## Examples

```bash
# Serve current directory on port 3000
npx bns

# Serve on port 8080
npx bns port=8080

# Use a custom 404 page
npx bns port=8080 404=notfound.html

# Disable caching headers
npx bns no-cache=true port=8080

# Custom 404 + no-cache
npx bns 404=notfound.html no-cache=true port=8080
```

## Request Behavior

- Supported methods: `GET`, `HEAD`
- Unsupported methods return `405 Method Not Allowed`
- Missing files return `404` (or custom 404 file if configured)