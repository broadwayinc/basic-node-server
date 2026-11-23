# basic-node-server

A small static file server for local hosting and quick testing.

It serves files from your current working directory (or a configured root) over HTTP.

- If the request path is a folder (for example `/`), it serves that folder's `index.html`.
- If the folder has no `index.html`, it shows a file browser of that folder instead.
- `--tree` always shows the file browser, even when `index.html` exists.
- It only serves files inside the configured root directory.
- It supports conditional caching via `ETag` and `Last-Modified` (`304 Not Modified`).

## Installation

```bash
npm install basic-node-server
```

Or install it globally to run `bns` from anywhere:

```bash
npm install -g basic-node-server
```

## Quick Start

```bash
npx bns
```

Default port is `3000`.

## Usage

```bash
bns [--port <number>] [--root <dir>] [--404 <file>] [--no-cache true] [--tree]
```

Every option also takes the `--option=value` form, for example `--port=8080`.

Show CLI help:

```bash
bns --help
```

## Options

- `--port <number>`: Port number (`1-65535`), defaults to `3000`.
- `--root <dir>`: Directory to serve, defaults to the current directory.
- `--404 <file>`: Custom 404 page, relative to the root directory and inside it. If you give a folder, its `index.html` is used.
- `--no-cache true`: Adds no-cache headers (`Cache-Control`, `Pragma`, `Expires`). `--no-cache` alone does the same.
- `--tree`: Always shows the file browser for folders and ignores `index.html`.
- `-h`, `--help`: Shows CLI help and exits.
- `-v`, `--version`: Shows the version and exits.

The older `port=8080 root=./public 404=notfound.html no-cache=true` form still works.

## File Browser

When a folder URL has no `index.html` (or `--tree` is on), the server answers with a page listing that folder:

- Folders come first, then files, sorted by name.
- Each row shows the name, size and last modified time.
- Click a folder to open it, `../` to go up, or a file to open it.
- The path at the top links back to every parent folder.

A folder URL without a trailing slash (`/docs`) redirects to `/docs/`.

## Examples

```bash
# Serve the current directory on port 3000
bns

# Serve on port 8080
bns --port 8080

# Serve a specific directory
bns --root ./public

# Use a custom 404 page
bns --port 8080 --404 notfound.html

# Disable caching headers
bns --port 8080 --no-cache true

# Browse the files even if there is an index.html
bns --port 8080 --root ./public --tree

# Everything together
bns --port 8080 --root ./public --404 notfound.html --no-cache true
```

Use `npx bns ...` when the package is installed locally instead of globally.

## Request Behavior

- Supported methods: `GET`, `HEAD`
- Unsupported methods return `405 Method Not Allowed`
- Missing files return `404` (or the custom 404 file if configured)
- Paths outside the root directory return `400 Bad Request`
- Invalid options stop the server with a message saying what is wrong
