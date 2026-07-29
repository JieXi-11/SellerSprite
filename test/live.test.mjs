import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const enabled = process.env.SELLERSPRITE_LIVE_TEST === '1';
const extensionEnabled = process.env.SELLERSPRITE_LIVE_EXTENSION_TEST === '1';

function startClient() {
  const child = spawn(process.execPath, [resolve(rootDir, 'src/server.mjs')], {
    cwd: rootDir,
    env: {
      ...process.env,
      SELLERSPRITE_AUTH_MODE: 'cdp',
      SELLERSPRITE_CDP_URL: process.env.SELLERSPRITE_CDP_URL || 'http://127.0.0.1:9222'
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });
  const pending = new Map();
  createInterface({ input: child.stdout }).on('line', (line) => {
    const message = JSON.parse(line);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  });
  let id = 0;
  return {
    child,
    request(name, args) {
      id += 1;
      return new Promise((resolvePromise, rejectPromise) => {
        const timer = setTimeout(() => rejectPromise(new Error('Live MCP response timeout.')), 120000);
        pending.set(id, (value) => { clearTimeout(timer); resolvePromise(value); });
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`);
      });
    },
    close() { child.stdin.end(); child.kill(); }
  };
}

test('live web-session calls return SellerSprite data', { skip: !enabled }, async (context) => {
  const client = startClient();
  context.after(() => client.close());

  const statusResponse = await client.request('sellersprite_session_status', {});
  const status = JSON.parse(statusResponse.result.content[0].text);
  assert.equal(status.mode, 'cdp');
  assert.equal(status.connected, true);
  assert.equal(status.web.valid, true);

  const response = await client.request('sellersprite_call', {
    operation: 'review',
    params: { marketplace: 'US', asin: 'B09BF6XJY1', starList: [5], typeList: [], page: 1, size: 5 }
  });
  assert.equal(response.result.isError, undefined);
  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.status, 200);
  assert.equal(payload.result.code, 'OK');
  assert.equal(payload.result.data.items.length, 5);
  assert.ok(payload.result.data.items.every((item) => item.star === 5));
});

test('live extension-session call returns SellerSprite data', { skip: !extensionEnabled }, async (context) => {
  const client = startClient();
  context.after(() => client.close());

  const extensionResponse = await client.request('sellersprite_call', {
    operation: 'bsr_sales_prediction',
    params: { marketplace: 'US', bsr: 1025, categoryId: '2619525011' }
  });
  assert.equal(extensionResponse.result.isError, undefined);
  const extensionPayload = JSON.parse(extensionResponse.result.content[0].text);
  assert.equal(extensionPayload.status, 200);
  assert.equal(extensionPayload.result.code, 'OK');
  assert.ok(extensionPayload.result.data.daily);
});
