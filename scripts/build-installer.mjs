import { spawnSync } from 'node:child_process';
import { copyFile, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
if (config.productName !== 'CentralHub' || config.mainBinaryName !== 'CentralHub') {
  throw new Error('O nome do aplicativo e do executável deve ser CentralHub.');
}
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'build', '--bundles', 'nsis'], {
  cwd: root, stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const directory = path.join(root, 'src-tauri/target/release/bundle/nsis');
const source = path.join(directory, `CentralHub_${config.version}_x64-setup.exe`);
if (!(await stat(source)).isFile()) throw new Error('O instalador x64 não foi gerado.');
const destination = path.join(directory, 'CentralHub-Setup.exe');
await copyFile(source, destination);
console.log(`Instalador com nome fixo: ${destination}`);
