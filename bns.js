#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const contentTypes = require('./mime.json');
const { version } = require('./package.json');

const args = process.argv.slice(2);

function printHelp() {
    console.log(`Basic Node Server ${version}`);
    console.log('Usage:');
    console.log('- bns [--port <number>] [--root <dir>] [--404 <file>] [--no-cache true] [--tree]');
    console.log('');
    console.log('Options:');
    console.log('- --port <number>: Port number (1-65535), defaults to 3000');
    console.log('- --root <dir>: Directory to serve, defaults to the current directory');
    console.log('- --404 <file>: Custom 404 page inside the root directory (a directory means its index.html)');
    console.log('- --no-cache true: Send no-cache response headers (--no-cache alone also works)');
    console.log('- --tree: Always show the file browser for directories, even when index.html exists');
    console.log('- -h, --help: Show this help and exit');
    console.log('- -v, --version: Show the version and exit');
    console.log('');
    console.log('When a directory has no index.html, its URL shows a file browser of that directory.');
    console.log('');
    console.log('Examples:');
    console.log('- bns');
    console.log('- bns --port 8080');
    console.log('- bns --root ./public');
    console.log('- bns --port 8080 --404 notfound.html');
    console.log('- bns --port 8080 --no-cache true');
    console.log('- bns --port 8080 --root ./public --tree');
}

if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
}

if (args.includes('-v') || args.includes('--version')) {
    console.log(version);
    process.exit(0);
}

const VALUE_OPTIONS = ['port', 'root', '404'];
const BOOLEAN_OPTIONS = ['no-cache', 'tree'];

function fail(message) {
    console.error(message);
    console.error('Run "bns --help" to see the options.');
    process.exit(1);
}

function parseBoolean(name, value) {
    if (value === undefined || value === true) {
        return true;
    }
    const lower = String(value).toLowerCase();
    if (lower === 'true') {
        return true;
    }
    if (lower === 'false') {
        return false;
    }
    fail(`Invalid value for --${name}: "${value}". Use true or false.`);
}

// Reads "--name value", "--name=value" and the older "name=value" form.
function parseArgs(argv) {
    const options = {};

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        let name;
        let value;

        if (arg.startsWith('--')) {
            const eq = arg.indexOf('=');
            if (eq > -1) {
                name = arg.slice(2, eq);
                value = arg.slice(eq + 1);
            } else {
                name = arg.slice(2);
                const next = argv[i + 1];
                const nextIsValue = next !== undefined && !next.startsWith('--');
                if (VALUE_OPTIONS.includes(name)) {
                    if (!nextIsValue) {
                        fail(`Missing value for --${name}.`);
                    }
                    value = next;
                    i++;
                } else if (BOOLEAN_OPTIONS.includes(name)) {
                    if (nextIsValue && /^(true|false)$/i.test(next)) {
                        value = next;
                        i++;
                    } else {
                        value = true;
                    }
                }
            }
        } else if (/^(port|root|404|no-cache|tree)=/.test(arg)) {
            const eq = arg.indexOf('=');
            name = arg.slice(0, eq);
            value = arg.slice(eq + 1);
        } else if (/\.(html?|txt)$/i.test(arg)) {
            // Older form: a bare .html/.htm/.txt argument is the 404 page.
            name = '404';
            value = arg;
        } else {
            fail(`Unknown argument: ${arg}`);
        }

        if (!VALUE_OPTIONS.includes(name) && !BOOLEAN_OPTIONS.includes(name)) {
            fail(`Unknown option: --${name}`);
        }

        options[name] = BOOLEAN_OPTIONS.includes(name) ? parseBoolean(name, value) : value;
    }

    return options;
}

const options = parseArgs(args);

let port = 3000;
if (options.port !== undefined) {
    const parsedPort = parseInt(options.port, 10);
    if (/^\d+$/.test(options.port) && parsedPort >= 1 && parsedPort <= 65535) {
        port = parsedPort;
    } else {
        fail(`Invalid port: "${options.port}". Use a number from 1 to 65535.`);
    }
}

const noCache = options['no-cache'] === true;
const forceTree = options.tree === true;

let rootDir = process.cwd();
if (options.root !== undefined) {
    const resolvedRoot = path.resolve(process.cwd(), options.root);
    let stat;
    try {
        stat = fs.statSync(resolvedRoot);
    } catch (error) {
        fail(`Root directory not found: ${resolvedRoot} (${error.code || error.message}).`);
    }
    if (!stat.isDirectory()) {
        fail(`Root path is not a directory: ${resolvedRoot}.`);
    }
    rootDir = resolvedRoot;
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
if (options['404'] !== undefined) {
    // Relative to the root directory, like every other served path.
    notFoundFilePath = resolveLocalPath(options['404']);
    if (!notFoundFilePath) {
        fail(`The 404 page must be inside the root directory (${rootDir}): ${options['404']}`);
    }
    try {
        if (fs.statSync(notFoundFilePath).isDirectory()) {
            notFoundFilePath = path.join(notFoundFilePath, 'index.html');
        }
    } catch (error) {
        // Missing for now; checked again on every 404, so it can be created later.
    }
    if (!fs.existsSync(notFoundFilePath)) {
        console.log(`Warning: 404 page not found yet: ${notFoundFilePath}. The plain "File not found" text is used until it exists.`);
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

// Returns { urlPath, localPath } for the request, or null when the path is invalid or outside the root.
function resolveRequestPath(requestUrl) {
    const rawPath = requestUrl.split('?')[0] || '/';
    let urlPath;

    try {
        urlPath = decodeURIComponent(rawPath);
    } catch (error) {
        return null;
    }

    const localPath = resolveLocalPath(`.${urlPath}`);
    if (!localPath) {
        return null;
    }
    return { urlPath, localPath };
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

async function isFile(filePath) {
    try {
        return (await fs.promises.stat(filePath)).isFile();
    } catch (error) {
        return false;
    }
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function encodeUrlPath(urlPath) {
    return urlPath.split('/').map(encodeURIComponent).join('/');
}

function formatSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = bytes / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit++;
    }
    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unit]}`;
}

function formatDate(date) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function readEntries(dirPath) {
    const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const entries = await Promise.all(dirents.map(async dirent => {
        const entry = { name: dirent.name, isDir: dirent.isDirectory(), size: null, mtime: null };
        try {
            // stat follows symlinks, so a link to a folder lists as a folder.
            const stat = await fs.promises.stat(path.join(dirPath, dirent.name));
            entry.isDir = stat.isDirectory();
            entry.size = stat.isFile() ? stat.size : null;
            entry.mtime = stat.mtime;
        } catch (error) {
            // Broken link or unreadable entry: list it without size or date.
        }
        return entry;
    }));

    return entries.sort((a, b) => {
        if (a.isDir !== b.isDir) {
            return a.isDir ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
}

function renderDirectoryPage(urlPath, entries) {
    const segments = urlPath.split('/').filter(Boolean);
    let crumbHref = '/';
    const crumbs = [`<a href="/">${escapeHtml(path.basename(rootDir) || '/')}</a>`];
    for (const segment of segments) {
        crumbHref += `${segment}/`;
        crumbs.push(`<a href="${escapeHtml(encodeUrlPath(crumbHref))}">${escapeHtml(segment)}</a>`);
    }

    const rows = [];
    if (segments.length) {
        rows.push('<tr><td class="name"><a href="../">../</a></td><td class="size"></td><td class="date"></td></tr>');
    }
    for (const entry of entries) {
        const label = entry.isDir ? `${entry.name}/` : entry.name;
        const href = encodeURIComponent(entry.name) + (entry.isDir ? '/' : '');
        rows.push(
            `<tr class="${entry.isDir ? 'dir' : 'file'}">` +
            `<td class="name"><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></td>` +
            `<td class="size">${entry.isDir || entry.size === null ? '' : formatSize(entry.size)}</td>` +
            `<td class="date">${entry.mtime ? formatDate(entry.mtime) : ''}</td>` +
            '</tr>'
        );
    }
    if (!entries.length) {
        rows.push('<tr><td class="empty" colspan="3">This folder is empty.</td></tr>');
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Index of ${escapeHtml(urlPath)}</title>
<style>
    :root { color-scheme: light dark; --ink: #222; --muted: #777; --line: #e3e3e3; --link: #0b62c4; --bg: #fff; --hover: #f5f7fa; }
    @media (prefers-color-scheme: dark) {
        :root { --ink: #e6e6e6; --muted: #999; --line: #333; --link: #6aa8ff; --bg: #151515; --hover: #1f2329; }
    }
    body { margin: 0; padding: 24px 16px; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: var(--bg); }
    main { max-width: 960px; margin: 0 auto; }
    h1 { font-size: 18px; font-weight: 600; margin: 0 0 16px; word-break: break-all; }
    h1 a { color: inherit; text-decoration: none; }
    h1 a:hover { text-decoration: underline; }
    h1 .sep { color: var(--muted); margin: 0 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); }
    th { font-weight: 600; color: var(--muted); font-size: 12px; }
    tbody tr:hover { background: var(--hover); }
    td.name { word-break: break-all; }
    td.size, th.size { text-align: right; white-space: nowrap; }
    td.date, th.date { white-space: nowrap; color: var(--muted); }
    td.empty { color: var(--muted); }
    a { color: var(--link); text-decoration: none; }
    a:hover { text-decoration: underline; }
    tr.dir td.name a { font-weight: 600; }
    @media (max-width: 560px) { th.date, td.date { display: none; } }
</style>
</head>
<body>
<main>
<h1>${crumbs.join('<span class="sep">/</span>')}</h1>
<table>
<thead><tr><th>Name</th><th class="size">Size</th><th class="date">Modified</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody>
</table>
</main>
</body>
</html>
`;
}

async function serveDirectory(req, res, urlPath, dirPath, isHead) {
    const entries = await readEntries(dirPath);
    if (!noCache) {
        // Listings change whenever files change; always ask again.
        res.setHeader('Cache-Control', 'no-cache');
    }
    sendResponse(res, 200, 'text/html; charset=utf-8', renderDirectoryPage(urlPath, entries), isHead);
}

async function serveNotFound(req, res, isHead) {
    if (notFoundFilePath) {
        try {
            console.log(`Serving 404 file: ${notFoundFilePath}`);
            await serveFile(req, res, notFoundFilePath, 404, isHead);
            return;
        } catch (notFoundError) {
            // Fallback below if the custom 404 file can't be read.
        }
    }
    sendResponse(res, 404, 'text/plain; charset=utf-8', 'File not found', isHead);
}

const server = http.createServer(async (req, res) => {
    const isHead = req.method === 'HEAD';
    if (req.method !== 'GET' && !isHead) {
        res.setHeader('Allow', 'GET, HEAD');
        sendResponse(res, 405, 'text/plain; charset=utf-8', 'Method not allowed', false);
        return;
    }

    const requested = resolveRequestPath(req.url);
    if (!requested) {
        sendResponse(res, 400, 'text/plain; charset=utf-8', 'Bad request', isHead);
        return;
    }
    const { urlPath, localPath } = requested;

    try {
        const stat = await fs.promises.stat(localPath);

        if (stat.isDirectory()) {
            if (!urlPath.endsWith('/')) {
                // Folder URLs end with "/" so relative links inside the page resolve correctly.
                const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
                res.statusCode = 301;
                res.setHeader('Location', `${encodeUrlPath(urlPath)}/${query}`);
                res.end();
                return;
            }

            const indexPath = path.join(localPath, 'index.html');
            if (!forceTree && await isFile(indexPath)) {
                console.log(`Serving: ${indexPath}`);
                await serveFile(req, res, indexPath, 200, isHead);
                return;
            }

            console.log(`Serving file browser: ${localPath}`);
            await serveDirectory(req, res, urlPath, localPath, isHead);
            return;
        }

        console.log(`Serving: ${localPath}`);
        await serveFile(req, res, localPath, 200, isHead);
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR' || error.code === 'ENOTDIR') {
            await serveNotFound(req, res, isHead);
            return;
        }

        console.error(`Error serving ${localPath}: ${error.message}`);
        sendResponse(res, 500, 'text/plain; charset=utf-8', 'Internal server error', isHead);
    }
});

server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
        fail(`Port ${port} is already in use. Pick another one with --port <number>.`);
    }
    if (error.code === 'EACCES') {
        fail(`No permission to use port ${port}. Pick a port above 1024 with --port <number>.`);
    }
    fail(`Server error: ${error.message}`);
});

server.listen(port, () => {
    console.log(`Basic Node Server ${version} is running`);
    console.log(`- URL: http://localhost:${port}/`);
    console.log(`- Root: ${rootDir}`);
    console.log(`- Custom 404: ${notFoundFilePath || 'none'}`);
    console.log(`- No-cache headers: ${noCache}`);
    console.log(`- File browser: ${forceTree ? 'always (--tree)' : 'for folders without index.html'}`);
    console.log('');
    console.log('Stop the server with Ctrl+C. See all options with: bns --help');
});
