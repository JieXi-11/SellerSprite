import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function startClient(env = {}) {
  const child = spawn(process.execPath, [resolve(rootDir, 'src/server.mjs')], {
    cwd: rootDir,
    env: { ...process.env, SELLERSPRITE_AUTH_MODE: 'file', ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });
  const pending = new Map();
  const stderr = [];
  createInterface({ input: child.stdout }).on('line', (line) => {
    const message = JSON.parse(line);
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      callback.resolve(message);
    }
  });
  child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));
  let id = 0;
  return {
    child,
    request(method, params = {}) {
      id += 1;
      return new Promise((resolvePromise, rejectPromise) => {
        const timer = setTimeout(() => rejectPromise(new Error(`MCP response timeout. ${stderr.join('')}`)), 10000);
        pending.set(id, { resolve: (value) => { clearTimeout(timer); resolvePromise(value); } });
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });
    },
    close() { child.stdin.end(); child.kill(); }
  };
}

test('MCP handshake and operation discovery', async (context) => {
  const client = startClient();
  context.after(() => client.close());

  const initialized = await client.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.equal(initialized.result.serverInfo.name, 'sellersprite-mcp');
  assert.ok(initialized.result.capabilities.tools);

  const legacyClient = await client.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'legacy-test', version: '1' } });
  assert.equal(legacyClient.result.protocolVersion, '2024-11-05');

  const listedTools = await client.request('tools/list');
  assert.deepEqual(listedTools.result.tools.map((item) => item.name), [
    'sellersprite_list_operations',
    'sellersprite_describe_operation',
    'sellersprite_call',
    'sellersprite_session_status',
    'sellersprite_login'
  ]);

  const operations = await client.request('tools/call', {
    name: 'sellersprite_list_operations', arguments: { query: '市场-' }
  });
  const operationData = JSON.parse(operations.result.content[0].text);
  assert.equal(operationData.count, 13);
  assert.ok(operationData.items.every((item) => item.endpoint?.includes('www.sellersprite.com')));

  const description = await client.request('tools/call', {
    name: 'sellersprite_describe_operation', arguments: { operation: 'market_research' }
  });
  const descriptionData = JSON.parse(description.result.content[0].text);
  assert.equal(descriptionData.title, '选市场列表');
  assert.equal(Object.keys(descriptionData.tool_input).length, 72);
  assert.equal(descriptionData.web_request.template.method, 'POST');
  assert.equal(descriptionData.web_request.template.form.marketId, 1);
  assert.deepEqual(Object.keys(descriptionData).slice(0, 7), [
    'operation', 'title', 'description', 'status', 'authentication', 'web_request', 'tool_input'
  ]);
});

test('session status is credential-safe', async (context) => {
  const client = startClient();
  context.after(() => client.close());
  const response = await client.request('tools/call', { name: 'sellersprite_session_status', arguments: {} });
  const data = JSON.parse(response.result.content[0].text);
  assert.equal(data.operationCount, 40);
  assert.equal(JSON.stringify(data).includes('Cookie:'), false);
  assert.equal(JSON.stringify(data).includes('Auth-Token'), false);
});

test('catalog contains explained web requests without pre-mapping API artifacts', async () => {
  const catalogText = await readFile(resolve(rootDir, 'data/operations.json'), 'utf8');
  const catalog = JSON.parse(catalogText);
  const operations = Object.values(catalog.operations);
  assert.equal(catalog.schema_version, 2);
  assert.equal(operations.length, 40);
  assert.ok(operations.every((operation) => operation.title && operation.description));
  assert.ok(operations.every((operation) => operation.tool_input && operation.web_request?.template));
  assert.ok(operations.every((operation) => operation.web_request.parameters.every((parameter) => parameter.fields?.length > 0 && parameter.name && parameter.description)));
  const removedHost = ['api', 'sellersprite', 'com'].join('.');
  assert.equal(catalogText.includes(removedHost), false);
});
