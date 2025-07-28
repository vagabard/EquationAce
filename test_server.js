const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? './test_exponent_sizing.html' : '.' + req.url;
    
    // Handle MathJax CDN requests by serving from node_modules
    if (req.url.includes('mathjax')) {
        filePath = './node_modules/mathjax/es5/tex-mml-chtml.js';
    }
    
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    if (extname === '.js') contentType = 'text/javascript';
    else if (extname === '.css') contentType = 'text/css';
    else if (extname === '.xml') contentType = 'application/xml';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            console.log(`File not found: ${filePath}`);
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Testing exponent sizing changes...');
    console.log('Open the URL in your browser to see the comparison');
});