const defaultTimeoutMs = 10000;

function normalizeHttpUrl(value) {
  return String(value || 'http://127.0.0.1:9222').replace(/\/+$/, '');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(defaultTimeoutMs) });
  if (!response.ok) throw new Error(`CDP HTTP ${response.status}: ${url}`);
  return await response.json();
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.socket = null;
    this.nextId = 0;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => rejectPromise(new Error(`CDP WebSocket connection timed out: ${this.webSocketUrl}`)), defaultTimeoutMs);
      this.socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolvePromise();
      }, { once: true });
      this.socket.addEventListener('error', () => {
        clearTimeout(timer);
        rejectPromise(new Error(`CDP WebSocket connection failed: ${this.webSocketUrl}`));
      }, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('CDP WebSocket closed before the command completed.'));
      }
      this.pending.clear();
    });
    return this;
  }

  async send(method, params = {}) {
    this.nextId += 1;
    const id = this.nextId;
    return await new Promise((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectPromise(new Error(`CDP command timed out: ${method}`));
      }, defaultTimeoutMs);
      this.pending.set(id, { resolve: resolvePromise, reject: rejectPromise, timer, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

async function browserClient(cdpUrl) {
  const version = await fetchJson(`${normalizeHttpUrl(cdpUrl)}/json/version`);
  if (!version.webSocketDebuggerUrl) throw new Error('CDP browser WebSocket URL is missing.');
  const client = await new CdpClient(version.webSocketDebuggerUrl).connect();
  return { client, version };
}

export async function isCdpAvailable(cdpUrl) {
  try {
    const version = await fetchJson(`${normalizeHttpUrl(cdpUrl)}/json/version`);
    return Boolean(version.webSocketDebuggerUrl);
  } catch {
    return false;
  }
}

export async function openCdpTarget(cdpUrl, url) {
  const { client } = await browserClient(cdpUrl);
  try {
    const created = await client.send('Target.createTarget', { url });
    return created.targetId;
  } finally {
    client.close();
  }
}

export async function listCdpTargets(cdpUrl) {
  return await fetchJson(`${normalizeHttpUrl(cdpUrl)}/json/list`);
}

function sellerSpriteCookies(cookies) {
  const now = Date.now() / 1000;
  return cookies
    .filter((cookie) => cookie.domain.replace(/^\./, '').endsWith('sellersprite.com'))
    .filter((cookie) => cookie.expires <= 0 || cookie.expires > now)
    .sort((left, right) => right.path.length - left.path.length || right.domain.length - left.domain.length);
}

export async function readCdpWebSession(cdpUrl) {
  const { client, version } = await browserClient(cdpUrl);
  try {
    const result = await client.send('Storage.getCookies');
    const cookies = sellerSpriteCookies(result.cookies || []);
    if (cookies.length === 0) throw new Error('No SellerSprite cookies found in the attached Chrome profile.');
    const unique = new Map();
    for (const cookie of cookies) if (!unique.has(cookie.name)) unique.set(cookie.name, cookie.value);
    return {
      cookie: [...unique].map(([name, value]) => `${name}=${value}`).join('; '),
      userAgent: version['User-Agent'],
      cookieCount: unique.size,
      browser: version.Browser
    };
  } finally {
    client.close();
  }
}

async function extensionTarget(cdpUrl, extensionId) {
  const baseUrl = normalizeHttpUrl(cdpUrl);
  let targets = await fetchJson(`${baseUrl}/json/list`);
  let target = targets.find((item) => item.url?.startsWith(`chrome-extension://${extensionId}/`) && item.webSocketDebuggerUrl);
  if (target) return { target, createdTargetId: null };

  const { client } = await browserClient(cdpUrl);
  let createdTargetId;
  try {
    const created = await client.send('Target.createTarget', { url: `chrome-extension://${extensionId}/popup/index.html`, background: true });
    createdTargetId = created.targetId;
  } finally {
    client.close();
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  targets = await fetchJson(`${baseUrl}/json/list`);
  target = targets.find((item) => item.id === createdTargetId || item.url?.startsWith(`chrome-extension://${extensionId}/`));
  if (!target?.webSocketDebuggerUrl) throw new Error('SellerSprite extension target was not found in the attached Chrome profile.');
  return { target, createdTargetId };
}

export async function readCdpExtensionState(cdpUrl, extensionId) {
  const { target, createdTargetId } = await extensionTarget(cdpUrl, extensionId);
  const client = await new CdpClient(target.webSocketDebuggerUrl).connect();
  try {
    await client.send('Runtime.enable');
    const expression = `(async () => {
      const state = await chrome.storage.local.get(['__SIGN_IN_USER', '__UUID', '__FP']);
      return {
        token: state.__SIGN_IN_USER && state.__SIGN_IN_USER.token,
        uuid: state.__UUID,
        fingerprint: state.__FP && state.__FP.value
      };
    })()`;
    const evaluated = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.text || 'Extension storage evaluation failed.');
    const state = evaluated.result?.value;
    if (!state?.token || !state?.uuid) throw new Error('SellerSprite extension is not signed in in the attached Chrome profile.');
    return { token: state.token, uuid: state.uuid, fingerprint: state.fingerprint || null };
  } finally {
    client.close();
    if (createdTargetId) {
      const { client: browser } = await browserClient(cdpUrl);
      try { await browser.send('Target.closeTarget', { targetId: createdTargetId }); } finally { browser.close(); }
    }
  }
}

export async function inspectCdpAuth(cdpUrl, extensionId) {
  const result = {
    mode: 'cdp',
    cdpUrl: normalizeHttpUrl(cdpUrl),
    connected: false,
    web: { valid: false },
    extension: { valid: false, requiredOnlyForExtensionOperations: true }
  };
  try {
    const web = await readCdpWebSession(cdpUrl);
    result.connected = true;
    result.web = { valid: true, cookieCount: web.cookieCount, browser: web.browser };
  } catch (error) {
    result.web.error = error.message;
    return result;
  }
  try {
    await readCdpExtensionState(cdpUrl, extensionId);
    result.extension.valid = true;
  } catch (error) {
    result.extension.error = error.message;
  }
  return result;
}
