#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const contentTypes = require('./mime.json');

const args = process.argv.slice(2);

function printHelp() {
    console.log('Basic Node Server');
    console.log('Usage:');
    console.log('- npx bns [port=<number>] [root=<dir>] [404=<file>] [no-cache=true]');
    console.log('');
    console.log('Options:');
    console.log('- port=<number>: Optional port number (1-65535), defaults to 3000');
    console.log('- root=<dir>: Optional root directory to serve, defaults to current directory');
    console.log('- 404=<file>: Optional custom 404 file path (inside root directory)');
    console.log('- no-cache=true: Optional no-cache response headers');
    console.log('- -h, --help: Show this help and exit');
    console.log('');
    console.log('Examples:');
    console.log('- npx bns');
    console.log('- npx bns port=8080');
    console.log('- npx bns root=./public');
    console.log('- npx bns 404=notfound.html port=8080');
    console.log('- npx bns no-cache=true port=8080');
    console.log('- npx bns 404=notfound.html no-cache=true port=8080 root=./public');
}

if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
}

let port = 3000;
let notFoundFile = null;
let noCache = false;
let rootDirArg = null;

for (const arg of args) {
    if (arg.startsWith('root=')) {
        rootDirArg = arg.slice(5);
    } else if (arg.startsWith('port=')) {
        const rawPort = arg.slice(5);
        const parsedPort = parseInt(rawPort, 10);
        if (/^\d+$/.test(rawPort) && parsedPort >= 1 && parsedPort <= 65535) {
            port = parsedPort;
        } else {
            console.log('Invalid port value in port=<number>. Falling back to default port 3000.');
            port = 3000;
        }
    } else if (arg.startsWith('404=')) {
        notFoundFile = arg.slice(4);
    } else if (arg === 'no-cache=true') {
        noCache = true;
    } else if (arg === 'no-cache=false') {
        noCache = false;
    } else if (arg.endsWith('.html') || arg.endsWith('.htm') || arg.endsWith('.txt')) {
        notFoundFile = arg;
    }
}

let rootDir = process.cwd();
if (rootDirArg) {
    const resolvedRoot = path.resolve(process.cwd(), rootDirArg);
    try {
        const stat = fs.statSync(resolvedRoot);
        if (!stat.isDirectory()) {
            console.log(`Invalid root path (not a directory): ${resolvedRoot}. Falling back to current directory.`);
        } else {
            rootDir = resolvedRoot;
        }
    } catch (error) {
        console.log(`Invalid root path (${error.code || error.message}): ${resolvedRoot}. Falling back to current directory.`);
    }
}

function isWithinRoot(targetPath) {
    const relativePath = path.relative(rootDir, targetPath);
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveLocalPath(inputPath) {
    const resolvedPath = path.resolve(rootDir, inputPath);
    if (!isWithinRoot(resolvedPath)) {
        return null;
    }
    return resolvedPath;
}

let notFoundFilePath = null;
if (notFoundFile) {
    notFoundFilePath = resolveLocalPath(notFoundFile);
    if (!notFoundFilePath) {
        console.log('Invalid 404 file path (outside current directory). Ignoring custom 404 file.');
        notFoundFile = null;
    }
}

function setNoCache(res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
}

function setDefaultCache(res) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
}

function buildEtag(stat) {
    return `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
}

function setCacheValidators(res, stat) {
    res.setHeader('ETag', buildEtag(stat));
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    if (!noCache) {
        setDefaultCache(res);
    }
}

function shouldReturnNotModified(req, stat) {
    const ifNoneMatch = req.headers['if-none-match'];
    const etag = buildEtag(stat);

    if (ifNoneMatch) {
        const candidates = ifNoneMatch
            .split(',')
            .map(value => value.trim());
        if (candidates.includes('*') || candidates.includes(etag)) {
            return true;
        }
    }

    const ifModifiedSince = req.headers['if-modified-since'];
    if (!ifModifiedSince) {
        return false;
    }

    const modifiedSince = Date.parse(ifModifiedSince);
    if (Number.isNaN(modifiedSince)) {
        return false;
    }

    return Math.floor(stat.mtimeMs / 1000) * 1000 <= modifiedSince;
}

function sendResponse(res, statusCode, contentType, body, isHead) {
    res.statusCode = statusCode;
    if (contentType) {
        res.setHeader('Content-Type', contentType);
    }
    if (noCache) {
        setNoCache(res);
    }
    if (isHead) {
        res.end();
        return;
    }
    res.end(body);
}

function getContentType(filePath) {
    const extension = path.extname(filePath).substring(1).toLowerCase();
    return contentTypes[extension] || 'application/octet-stream';
}

function resolveRequestPath(requestUrl) {
    const rawPath = requestUrl.split('?')[0] || '/';
    let decodedPath;

    try {
        decodedPath = decodeURIComponent(rawPath);
    } catch (error) {
        return null;
    }

    let normalizedPath = decodedPath;
    if (normalizedPath.endsWith('/') || normalizedPath.endsWith('\\')) {
        normalizedPath = `${normalizedPath}index.html`;
    }

    return resolveLocalPath(`.${normalizedPath}`);
}

async function serveFile(req, res, filePath, statusCode, isHead) {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
        const error = new Error('Not a file');
        error.code = 'ENOENT';
        throw error;
    }

    const contentType = getContentType(filePath);
    setCacheValidators(res, stat);

    if (shouldReturnNotModified(req, stat)) {
        sendResponse(res, 304, contentType, null, true);
        return;
    }

    const data = isHead ? null : await fs.promises.readFile(filePath);
    sendResponse(res, statusCode, contentType, data, isHead);
}

const server = http.createServer(async (req, res) => {
    const isHead = req.method === 'HEAD';
    if (req.method !== 'GET' && !isHead) {
        res.setHeader('Allow', 'GET, HEAD');
        sendResponse(res, 405, 'text/plain; charset=utf-8', 'Method not allowed', false);
        return;
    }

    const requestFilePath = resolveRequestPath(req.url);
    if (!requestFilePath) {
        sendResponse(res, 400, 'text/plain; charset=utf-8', 'Bad request', isHead);
        return;
    }

    try {
        console.log(`Serving: ${requestFilePath}`);
        await serveFile(req, res, requestFilePath, 200, isHead);
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR') {
            if (notFoundFilePath) {
                try {
                    console.log(`Serving 404 file: ${notFoundFilePath}`);
                    await serveFile(req, res, notFoundFilePath, 404, isHead);
                    return;
                } catch (notFoundError) {
                    // Fallback below if custom 404 file can't be read.
                }
            }
            sendResponse(res, 404, 'text/plain; charset=utf-8', 'File not found', isHead);
            return;
        }

        sendResponse(res, 500, 'text/plain; charset=utf-8', 'Internal server error', isHead);
    }
});

server.listen(port, () => {
    console.log('Basic Node Server is running');
    console.log(`- Port: ${port}`);
    console.log(`- Root: ${rootDir}`);
    console.log(`- Custom 404: ${notFoundFile || 'none'}`);
    console.log(`- No-cache headers: ${noCache}`);
    console.log('');
    console.log('Quick commands:');
    console.log('- Stop server: Ctrl+C');
    console.log('- Help: npx bns --help');
    console.log('- Set port: npx bns port=8080');
    console.log('- Set root: npx bns root=./public');
    console.log('- Custom 404: npx bns port=8080 404=notfound.html');
    console.log('- Disable caching: npx bns port=8080 no-cache=true');
    console.log('- Custom 404 + no-cache: npx bns port=8080 404=notfound.html no-cache=true');
});
