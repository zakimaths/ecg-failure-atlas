import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const output = resolve(root, 'output/playwright');
const cliFile = resolve(root, 'node_modules/@playwright/cli/playwright-cli.js');

export async function cli(session, ...args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [cliFile, `-s=${session}`, ...args], {cwd: root});
    let text = '';
    child.stdout.on('data', chunk => {text += chunk;});
    child.stderr.on('data', chunk => {text += chunk;});
    const timeout = setTimeout(() => {child.kill('SIGTERM'); reject(new Error('Browser command timed out'));}, 180_000);
    child.on('error', error => {clearTimeout(timeout); reject(error);});
    child.on('close', code => {clearTimeout(timeout); code === 0 ? done(text) : reject(new Error(args[0] + ': ' + text));});
  });
}

export function resultOf(text) {
  const value = text.split('### Result\n')[1]?.split('\n### ')[0].trim();
  if (!value) throw new Error(text);
  return JSON.parse(value);
}

export async function localServer(directory = 'gallery') {
  const base = resolve(root, directory);
  const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.zip':'application/zip'};
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!path.startsWith(base + sep)) {response.writeHead(403).end(); return;}
      const content = await readFile(path);
      response.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream'}).end(content);
    } catch {response.writeHead(404).end('Not found');}
  });
  await new Promise((done, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', done);});
  return {url:`http://127.0.0.1:${server.address().port}`, close:()=>new Promise(done => server.close(done))};
}

export async function saveLog(name, text) {
  await mkdir(output, {recursive:true});
  await writeFile(resolve(output, name), text);
}
