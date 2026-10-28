import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const files = (await readdir(new URL('../dist/assets/', import.meta.url))).filter(f => /\.(js|css)$/.test(f));
let raw = 0, gzip = 0;
for (const file of files) {
  const data = await readFile(new URL(`../dist/assets/${file}`, import.meta.url));
  const compressed = gzipSync(data).length;
  raw += data.length; gzip += compressed;
  console.log(`${file}: ${data.length} bytes; gzip ${compressed} bytes`);
}
console.log(`TOTAL: ${raw} bytes; gzip ${gzip} bytes (all routes, not only initial load).`);
