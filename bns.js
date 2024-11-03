#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.argv[2] || 3000; // Set the port from the command line argument or default to 3000

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
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
