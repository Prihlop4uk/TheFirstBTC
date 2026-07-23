import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'public');

// --- Config ---
const DEFAULT_PORT = 3000;
const DEFAULT_HTTP_PORT = 80;
const PORT = process.env.PORT || DEFAULT_PORT;
const HOST = process.env.HOST || '0.0.0.0';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:8001';
const IS_PROD = process.env.NODE_ENV === 'production';

// --- HTTP status codes ---
const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const SERVER_ERROR_STATUS = 500;
const BACKEND_ERROR_STATUS = 502;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendText(res, status, body, contentType = 'text/plain') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function isApiPath(urlPath) {
  return urlPath === '/api' || urlPath.startsWith('/api/');
}

// Proxy /api/* to the backend (never serve index.html for API paths)
function proxyApi(req, res) {
  const target = new URL(req.url, BACKEND);
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const headers = { ...req.headers, host: target.host };
    const preq = http.request(
      {
        hostname: target.hostname,
        port: target.port || DEFAULT_HTTP_PORT,
        path: target.pathname + target.search,
        method: req.method,
        headers,
      },
      (pres) => {
        res.writeHead(pres.statusCode || BACKEND_ERROR_STATUS, pres.headers);
        pres.pipe(res);
      }
    );
    preq.on('error', (e) => {
      sendText(res, BACKEND_ERROR_STATUS, JSON.stringify({ detail: 'Bad gateway: ' + e.message }), 'application/json');
    });
    if (body.length) preq.write(body);
    preq.end();
  });
}

// Resolve a request path to a safe file path inside ROOT, or null on 404.
function resolveFilePath(urlPath) {
  const cleanPath = urlPath === '/' ? '/index.html' : urlPath;
  let filePath = path.join(ROOT, cleanPath);
  if (!filePath.startsWith(ROOT)) return { forbidden: true };

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // SPA-ish fallback for extensionless routes -> index.html
    if (!path.extname(cleanPath)) {
      filePath = path.join(ROOT, 'index.html');
    } else {
      return { notFound: true };
    }
  }
  return { filePath };
}

async function serveStatic(res, urlPath) {
  const { filePath, forbidden, notFound } = resolveFilePath(urlPath);
  if (forbidden) return sendText(res, FORBIDDEN_STATUS, 'Forbidden');
  if (notFound) return sendText(res, NOT_FOUND_STATUS, 'Not found');

  const data = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(OK_STATUS, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (isApiPath(urlPath)) return proxyApi(req, res);
    await serveStatic(res, urlPath);
  } catch (e) {
    sendText(res, SERVER_ERROR_STATUS, 'Server error: ' + e.message);
  }
});

server.listen(PORT, HOST, () => {
  if (!IS_PROD) {
    console.log(`Static landing server running at http://${HOST}:${PORT}`);
  }
});
