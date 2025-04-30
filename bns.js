#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

let port = process.argv[2] || 3000; // Set the port from the command line argument or default to 3000
try{
    port = parseInt(port);
    if (isNaN(port) || port < 1 || port > 65535) {
        console.log('Invalid port number. Falling back to default port 3000.');
        port = 3000;
    }
}
catch (error) {
    console.log('Invalid port number. Falling back to default port 3000.');
    port = 3000;
}

let notFoundFile = null;
let noCache = false;

// loop through the arguments from index 3
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('404=')) {
        notFoundFile = notFoundFile.split('=').slice(1).join('=');
    }
    else if (process.argv[i] === 'no-cache=true') {
        noCache = true;
    }
    // else if it's a file name
    else if (process.argv[i].endsWith('.html') || process.argv[i].endsWith('.htm') || process.argv[i].endsWith('.txt')) {
        notFoundFile = process.argv[i];
    }
}

const mimeJson = path.join(__dirname, '/mime.json');

const getContentType = (() => {
    return new Promise((resolve, reject) => {
        fs.readFile(mimeJson, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(JSON.parse(data));
            }
        });
    })
})();

function setNoCache(res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res;
}

const server = http.createServer((req, res) => {
    // Extract the file path from the request URL
    let filePath = path.join(process.cwd(), req.url);

    // check if its a get request
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method not allowed');
    }

    // remove get query string
    filePath = filePath.split('?')[0];

    // If filePath is empty or ends with '/', default to 'index.html'
    if (!filePath || filePath.endsWith('/') || filePath.endsWith('\\')) {
        filePath = path.join(filePath, 'index.html');
    }

    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // File not found
            if (notFoundFile) {
                filePath = path.join(process.cwd(), notFoundFile);
                fs.access(filePath, fs.constants.F_OK, (err) => {
                    if (err) {
                        res.statusCode = 404;
                        res.end('File not found');
                    } else {
                        // Read the file and send it as the response
                        const fileExtension = path.extname(filePath).substring(1);
                        getContentType.then(contentType => {
                            console.log(`Serving: ${filePath}`);

                            contentType = contentType[fileExtension] || 'application/octet-stream';
                            res.setHeader('Content-Type', contentType);

                            fs.readFile(filePath, (err, data) => {
                                if (err) {
                                    // Error reading the file
                                    res.statusCode = 500;
                                    res.end('Internal server error');
                                } else {
                                    // Send the file contents as the response
                                    res.statusCode = 200;
                                    res.end(data);
                                }
                            });
                        });
                    }
                });
            }
            else {
                res.statusCode = 404;
                res.end('File not found');
            }
        } else {
            // Read the file and send it as the response
            const fileExtension = path.extname(filePath).substring(1);
            getContentType.then(contentType => {
                console.log(`Serving: ${filePath}`);

                contentType = contentType[fileExtension] || 'application/octet-stream';
                res.setHeader('Content-Type', contentType);

                fs.readFile(filePath, (err, data) => {
                    if (err) {
                        // Error reading the file
                        res.statusCode = 500;
                        res.end('Internal server error');
                    } else {
                        // Send the file contents as the response
                        res.statusCode = 200;
                        // set no-cache header if noCache is true
                        if (noCache) {
                            setNoCache(res);
                        }
                        res.end(data);
                    }
                });
            });
        }
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`404 file: ${notFoundFile}`);
    console.log(`No cache: ${noCache}`);
    console.log(`Serving files from: ${process.cwd()}`);
    console.log(`Use Ctrl+C to stop the server`);
    console.log(`Use 'bns.js <port> 404=<file>' to set a custom 404 file`);
    console.log(`Use 'bns.js <port> no-cache=true' to set no-cache headers`);
    console.log(`Use 'bns.js <port> 404=<file> no-cache=true' to set a custom 404 file and no-cache headers`);
});
