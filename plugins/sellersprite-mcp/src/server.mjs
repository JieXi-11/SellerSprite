#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { inspectCdpAuth, readCdpExtensionState, readCdpWebSession } from './cdp-auth.mjs';
import { openSellerSpriteLogin, waitForSellerSpriteLogin } from './browser-login.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adapterPath = resolve(rootDir, 'src/adapter.mjs');
const operationsPath = resolve(rootDir, 'data/operations.json');
const catalog = JSON.parse(await readFile(operationsPath, 'utf8'));
const operations = catalog.operations;
const protocolVersion = '2025-06-18';
const supportedProtocolVersions = new Set(['2024-11-05', '2025-03-26', protocolVersion]);
const callTimeoutMs = Number(process.env.SELLERSPRITE_CALL_TIMEOUT_MS || 120000);
const maxOutputBytes = Number(process.env.SELLERSPRITE_MAX_OUTPUT_BYTES || 20 * 1024 * 1024);
const cdpUrl = process.env.SELLERSPRITE_CDP_URL || 'http://127.0.0.1:9222';
const extensionId = 'lnbmbgocenenhhhdojdielgnmeflbnfb';
const browserPath = process.env.SELLERSPRITE_BROWSER_PATH || null;
const browserProfilePath = process.env.SELLERSPRITE_BROWSER_PROFILE || null;

const toolDefinitions = [
  {
    name: 'sellersprite_list_operations',
    description: 'List available SellerSprite logged-in web and extension operations with their purpose and endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional case-insensitive operation-name, title, description, or endpoint filter.' },
        authentication: { type: 'string', enum: ['web', 'extension', 'mixed'], description: 'Optional authentication filter.' },
        status: { type: 'string', description: 'Optional exact mapping-status filter.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'sellersprite_describe_operation',
    description: 'Explain one operation: purpose, Agent input, actual logged-in web request, defaults, response, prerequisites, and verification.',
    inputSchema: {
      type: 'object',
      properties: { operation: { type: 'string' } },
      required: ['operation'],
      additionalProperties: false
    }
  },
  {
    name: 'sellersprite_call',
    description: 'Execute a SellerSprite logged-in web or extension operation using the documented MCP tool input.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', description: 'Operation name returned by sellersprite_list_operations.' },
        params: { type: 'object', description: 'Parameters from the operation tool_input returned by sellersprite_describe_operation.', additionalProperties: true }
      },
      required: ['operation', 'params'],
      additionalProperties: false
    }
  },
  {
    name: 'sellersprite_session_status',
    description: 'Check the attached Chrome SellerSprite web and extension login state without exposing credentials.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'sellersprite_login',
    description: 'Open SellerSprite in the local default Chromium browser and wait for the user to complete sign-in. Credentials stay in the browser.',
    inputSchema: {
      type: 'object',
      properties: {
        waitSeconds: {
          type: 'integer', minimum: 0, maximum: 300, default: 180,
          description: 'Seconds to wait for sign-in. Use 0 to only open the login window.'
        }
      },
      additionalProperties: false
    }
  }
];

function jsonContent(value, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {})
  };
}

function requireOperation(name) {
  if (typeof name !== 'string' || !operations[name]) {
    throw new Error(`Unknown SellerSprite operation: ${String(name)}`);
  }
  return operations[name];
}

async function sessionStatus() {
  const status = await inspectCdpAuth(cdpUrl, extensionId);
  return { ...status, ready: status.web.valid, operationCount: Object.keys(operations).length };
}

async function executeOperation(operation, params) {
  const operationDefinition = requireOperation(operation);
  const args = [adapterPath, operation, JSON.stringify(params || {})];
  const env = { ...process.env };
  const webSession = await readCdpWebSession(cdpUrl);
  env.SELLERSPRITE_SESSION_JSON = JSON.stringify({ cookie: webSession.cookie, userAgent: webSession.userAgent });
  if (['extension', 'mixed'].includes(operationDefinition.authentication)) {
    const extensionState = await readCdpExtensionState(cdpUrl, extensionId);
    env.SELLERSPRITE_EXTENSION_STATE_JSON = JSON.stringify(extensionState);
  }
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, { cwd: rootDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    const timer = setTimeout(() => {
      child.kill();
      rejectPromise(new Error(`SellerSprite call timed out after ${callTimeoutMs} ms.`));
    }, callTimeoutMs);
    child.stdout.on('data', (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        child.kill();
        rejectPromise(new Error(`SellerSprite response exceeded ${maxOutputBytes} bytes.`));
        return;
      }
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        rejectPromise(new Error(stderr.trim() || `Adapter exited with code ${code}.`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch (error) {
        rejectPromise(new Error(`Adapter returned invalid JSON: ${error.message}`));
      }
    });
  });
}

async function callTool(name, args = {}) {
  if (name === 'sellersprite_list_operations') {
    const query = String(args.query || '').toLowerCase();
    const items = Object.entries(operations)
      .filter(([operation, value]) => !query || [operation, value.title, value.description, value.web_request?.endpoint]
        .some((candidate) => String(candidate || '').toLowerCase().includes(query)))
      .filter(([, value]) => !args.authentication || value.authentication === args.authentication)
      .filter(([, value]) => !args.status || value.status === args.status)
      .map(([operation, value]) => ({
        operation,
        title: value.title,
        description: value.description,
        status: value.status,
        authentication: value.authentication || 'mixed',
        endpoint: value.web_request?.endpoint || null
      }));
    return jsonContent({ count: items.length, items });
  }
  if (name === 'sellersprite_describe_operation') {
    return jsonContent({ operation: args.operation, ...requireOperation(args.operation) });
  }
  if (name === 'sellersprite_call') {
    return jsonContent(await executeOperation(args.operation, args.params));
  }
  if (name === 'sellersprite_session_status') {
    return jsonContent(await sessionStatus());
  }
  if (name === 'sellersprite_login') {
    const waitSeconds = args.waitSeconds === undefined ? 180 : Number(args.waitSeconds);
    if (!Number.isInteger(waitSeconds) || waitSeconds < 0 || waitSeconds > 300) {
      throw new Error('waitSeconds must be an integer from 0 to 300.');
    }
    const opened = await openSellerSpriteLogin({ cdpUrl, browserPath, profilePath: browserProfilePath });
    const login = await waitForSellerSpriteLogin(cdpUrl, opened.targetId, waitSeconds);
    return jsonContent({ ...opened, ...login });
  }
  return jsonContent({ error: `Unknown MCP tool: ${String(name)}` }, true);
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handleMessage(message) {
  if (!message || message.jsonrpc !== '2.0') return;
  if (!Object.hasOwn(message, 'id')) return;
  try {
    if (message.method === 'initialize') {
      const negotiatedVersion = supportedProtocolVersions.has(message.params?.protocolVersion)
        ? message.params.protocolVersion : protocolVersion;
      writeMessage({
        jsonrpc: '2.0', id: message.id,
        result: {
          protocolVersion: negotiatedVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'sellersprite-mcp', version: '0.1.0' },
          instructions: 'Call sellersprite_session_status first. If sign-in is missing, call sellersprite_login so the user can sign in locally without exposing credentials. Discover an operation with sellersprite_list_operations, inspect tool_input and web_request with sellersprite_describe_operation, then pass only documented tool_input fields to sellersprite_call.'
        }
      });
      return;
    }
    if (message.method === 'ping') {
      writeMessage({ jsonrpc: '2.0', id: message.id, result: {} });
      return;
    }
    if (message.method === 'tools/list') {
      writeMessage({ jsonrpc: '2.0', id: message.id, result: { tools: toolDefinitions } });
      return;
    }
    if (message.method === 'tools/call') {
      const result = await callTool(message.params?.name, message.params?.arguments || {});
      writeMessage({ jsonrpc: '2.0', id: message.id, result });
      return;
    }
    writeMessage({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } });
  } catch (error) {
    if (message.method === 'tools/call') {
      writeMessage({ jsonrpc: '2.0', id: message.id, result: jsonContent({ error: error.message }, true) });
    } else {
      writeMessage({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: error.message } });
    }
  }
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', (line) => {
  if (!line.trim()) return;
  try {
    void handleMessage(JSON.parse(line));
  } catch (error) {
    process.stderr.write(`Invalid MCP JSON: ${error.message}\n`);
  }
});
