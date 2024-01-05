const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.argv[2] || 3000; // Set the port from the command line argument or default to 3000

const csvFilePath = path.join(__dirname, '/application.csv');

const getContentType = (() => {
    return new Promise((resolve, reject) => {
        fs.readFile(csvFilePath, 'utf8', (err, csvData) => {
            if (err) {
                reject(err);
            } else {
                const contentTypeMap = csvData.split('\n')
                    .map(row => row.split(','))
                    .reduce((map, [extension, contentType]) => {
                        map[extension] = contentType;
                        return map;
                    }, {});

                resolve(contentTypeMap);
            }
        });
    })
})();

const server = http.createServer((req, res) => {
    // Extract the file path from the request URL
    let filePath = path.join(__dirname, req.url);

    // If filePath is empty or ends with '/', default to 'index.html'
    if (!filePath || filePath.endsWith('/')) {
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
                contentType[fileExtension] || 'application/octet-stream';

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
