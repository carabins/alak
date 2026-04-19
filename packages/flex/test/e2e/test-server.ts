import { serve, file } from 'bun';
import { join } from 'path';

const port = 8080;
const root = join(import.meta.dir, '.');

const server = serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    if (path === '/') path = '/index.html';
    
    // Serve static files
    const filePath = join(root, path);
    return new Response(file(filePath));
  }
});

console.log(`Server running at http://localhost:${port}`);
