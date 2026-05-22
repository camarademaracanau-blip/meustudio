const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { spawn } = require('child_process');

// Try multiple ports if the preferred one is busy
const PREFERRED_PORT = 8080;
let PORT = PREFERRED_PORT;
const DIR = __dirname;
const FFMPEG = path.join(DIR, 'ffmpeg.exe');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Active FFmpeg processes per WebSocket connection
const connProcs = new Map();

function startFfmpeg(ws, targetId, rtmpUrl, streamKey, resolution) {
  const fullUrl = rtmpUrl.replace(/\/+$/, '') + '/' + streamKey;
  const [w, h] = (resolution || '1920x1080').split('x').map(Number);

  const args = [
    '-y',
    '-f', 'webm',
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-b:v', '6000k',
    '-maxrate', '8000k',
    '-bufsize', '12000k',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-g', '60',
    '-s', `${w}x${h}`,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-f', 'flv',
    fullUrl
  ];

  try {
    const proc = spawn(FFMPEG, args);
    proc.stdin.on('error', () => {});
    proc.stderr.on('data', d => console.log(`[ffmpeg:${targetId}] ${d.toString().trim()}`));
    proc.on('close', code => console.log(`[ffmpeg:${targetId}] exited code ${code}`));
    proc.on('error', err => console.error(`[ffmpeg:${targetId}] error:`, err.message));

    if (!connProcs.has(ws)) connProcs.set(ws, []);
    connProcs.get(ws).push({ targetId, proc, stopped: false });

    console.log(`[ffmpeg:${targetId}] started -> ${fullUrl}`);
    return proc;
  } catch (err) {
    console.error(`[ffmpeg:${targetId}] spawn failed:`, err.message);
    return null;
  }
}

function stopAllFfmpeg(ws) {
  const procs = connProcs.get(ws);
  if (!procs) return;
  procs.forEach(({ targetId, proc, stopped }) => {
    if (!stopped && proc && !proc.killed) {
      try { proc.stdin.end(); } catch (e) {}
      setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 3000);
      console.log(`[ffmpeg:${targetId}] stopped`);
    }
  });
  connProcs.delete(ws);
}

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/meustudio.html';

  const file = path.join(DIR, url);
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found: ' + url);
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('[ws] client connected');

  ws.on('message', data => {
    // First byte checks if it's a text or binary message
    if (typeof data === 'string' || data instanceof Buffer && data.toString().startsWith('{')) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'start') {
          (msg.targets || []).forEach(t => {
            startFfmpeg(ws, t.id, t.url, t.key, t.res);
          });
          ws.send(JSON.stringify({ type: 'started', count: (msg.targets || []).length }));
        } else if (msg.type === 'stop') {
          stopAllFfmpeg(ws);
          ws.send(JSON.stringify({ type: 'stopped' }));
        }
      } catch (e) {
        console.error('[ws] invalid message:', e.message);
      }
    } else {
      // Binary data - write to all FFmpeg processes for this connection
      const procs = connProcs.get(ws);
      if (procs) {
        procs.forEach(({ proc, stopped }) => {
          if (!stopped && proc && !proc.killed && proc.stdin.writable) {
            proc.stdin.write(data);
          }
        });
      }
    }
  });

  ws.on('close', () => {
    console.log('[ws] client disconnected');
    stopAllFfmpeg(ws);
  });

  ws.on('error', err => {
    console.error('[ws] error:', err.message);
    stopAllFfmpeg(ws);
  });
});

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    PORT = port; // Update the PORT variable to the actual port being used
    console.log(`Server running at http://127.0.0.1:${PORT}/`);
    console.log(`Open http://127.0.0.1:${PORT}/meustudio.html in your browser`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

// Start server with port fallback
startServer(PREFERRED_PORT);
