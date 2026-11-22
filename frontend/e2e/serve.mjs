// Serveur statique des tests de bout en bout : sert le build démo sous /9rayti/, comme GitHub Pages,
// avec repli sur index.html pour les liens directs (routes Angular).
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = normalize(process.argv[2] ?? 'dist/frontend/browser');
const port = Number(process.argv[3] ?? 4300);
const types = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (!url.startsWith('/9rayti')) {
    res.writeHead(302, { location: '/9rayti/' });
    return res.end();
  }
  let file = join(root, url.replace(/^\/9rayti/, '') || '/');
  if (!file.startsWith(root)) file = join(root, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`e2e : ${root} sur http://localhost:${port}/9rayti/`));
