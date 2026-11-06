// Malý místní server pro náhled návrhu: node serve.js, pak http://127.0.0.1:8099/
// 3D modely se ze souboru otevřeného přímo v prohlížeči načíst nedají, proto je potřeba server.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'site'), port = 8099;
const TYPES = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Soubor nenalezen'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
server.on('error', e => { if (e.code === 'EADDRINUSE') { console.log('Náhled už běží: http://127.0.0.1:' + port + '/'); process.exit(0); } throw e; });
server.listen(port, '127.0.0.1', () => console.log('Náhled běží: http://127.0.0.1:' + port + '/ (ukončíš klávesami Ctrl+C)'));
