const http = require('http');
const fs = require('fs');
const path = require('path');
const serveDir = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
const server = http.createServer((req, res) => {
  const safePath = path.resolve(serveDir).toLowerCase();
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.resolve(path.join(serveDir, filePath));
  if (!filePath.toLowerCase().startsWith(safePath)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});
const port = parseInt(process.argv[2] || '3000', 10);
server.listen(port, '127.0.0.1', () => {
  console.log(`Server ready: http://127.0.0.1:${port}/`);
});
