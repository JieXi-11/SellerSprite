import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { defaultBrowserProfilePath } from '../src/browser-login.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('published MCP configuration is directory-independent', async () => {
  const config = JSON.parse(await readFile(resolve(rootDir, 'mcp.example.json'), 'utf8'));
  const server = config.mcpServers.sellersprite;
  assert.equal(server.command, 'sellersprite-mcp');
  assert.deepEqual(server.args, []);
  assert.equal(server.cwd, undefined);
  assert.doesNotMatch(JSON.stringify(config), /"[A-Za-z]:[\\/]/);
  assert.doesNotMatch(JSON.stringify(config), /"\/(?:Users|home)\//);
});

test('browser profile defaults follow each operating system', () => {
  assert.equal(
    defaultBrowserProfilePath('win32', { LOCALAPPDATA: 'PROFILE_ROOT' }),
    'PROFILE_ROOT\\SellerSpriteMCP\\Chrome'
  );
  assert.equal(
    defaultBrowserProfilePath('darwin', { HOME: 'PROFILE_ROOT' }),
    'PROFILE_ROOT/Library/Application Support/SellerSpriteMCP/Chrome'
  );
  assert.equal(
    defaultBrowserProfilePath('linux', { HOME: 'PROFILE_ROOT' }),
    'PROFILE_ROOT/.config/sellersprite-mcp/chrome'
  );
});

test('Node launcher starts the MCP outside the project directory', async (context) => {
  const child = spawn(process.execPath, [resolve(rootDir, 'scripts/start-mcp.mjs')], {
    cwd: tmpdir(),
    env: { ...process.env, SELLERSPRITE_CDP_URL: 'http://127.0.0.1:1' },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });
  context.after(() => child.kill());
  const response = new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error('Portable launcher response timed out.')), 10000);
    createInterface({ input: child.stdout }).once('line', (line) => {
      clearTimeout(timer);
      resolvePromise(JSON.parse(line));
    });
  });
  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'portability-test', version: '1' } }
  })}\n`);
  const initialized = await response;
  assert.equal(initialized.result.serverInfo.name, 'sellersprite-mcp');
});
