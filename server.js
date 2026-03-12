// Simple local dev server — replaces `netlify dev`
// Serves static files and handles /api/* locally
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env file for environment variables
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
};

const PORT = 8888;

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Handle Netlify functions
  if (url.pathname.startsWith('/api/')) {
    const fnName = url.pathname.replace('/api/', '').split('/')[0];
    const fnPath = path.join(__dirname, 'api', fnName, 'index.js');

    if (!fs.existsSync(fnPath)) {
      res.writeHead(404); res.end('Function not found'); return;
    }

    // Read body for POST
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        delete require.cache[require.resolve(fnPath)];
        const fn = require(fnPath);
        const context = { res: {} };
        const azReq = { method: req.method, body: body ? JSON.parse(body) : null, headers: req.headers };
        await fn(context, azReq);
        res.writeHead(context.res.status || 200, context.res.headers || {});
        res.end(context.res.body);
      } catch (e) {
        console.error(e);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);

}).listen(PORT, () => {
  console.log(`\n  Local dev server ready: http://localhost:${PORT}\n`);
});
