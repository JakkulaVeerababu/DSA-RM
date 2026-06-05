const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Load environment variables from .env.local
const loadEnv = () => {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let val = parts.slice(1).join('=').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
          console.log(`Loaded Env: ${key}`);
        }
      }
    });
  }
};
loadEnv();

const server = http.createServer((req, res) => {
  console.log(`[Request]: ${req.method} ${req.url}`);

  // Handle API Requests
  if (req.method === 'GET' && req.url === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    }));
    return;
  }

  if (req.method === 'GET' && req.url === '/api/github/client-id') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (!process.env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID === 'your_github_client_id') {
      res.end(JSON.stringify({ demo: true }));
    } else {
      res.end(JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/github/authenticate') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { code } = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          isDemo: true,
          user: {
            login: "Veerababu-Demo",
            name: "Veerababu Jakkula (Demo)",
            avatar_url: "https://github.com/github.png"
          },
          token: "mock-jwt-token"
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
      }
    });
    return;
  }

  // Clean query strings or hash parameters first
  let filePath = req.url.split('?')[0].split('#')[0];
  
  // Normalize request path (default to index.html for root)
  if (filePath === '/') {
    filePath = '/index.html';
  }

  // Resolve absolute file path
  const absolutePath = path.join(__dirname, filePath);

  // Validate file exists
  fs.stat(absolutePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // Read and serve file
    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    
    const stream = fs.createReadStream(absolutePath);
    stream.on('error', (streamErr) => {
      console.error(streamErr);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    });
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================');
  console.log(` DSA Patterns Dashboard Server active!`);
  console.log(` Access your dashboard here:`);
  console.log(` 👉 http://localhost:${PORT}`);
  console.log('==================================================');
});
