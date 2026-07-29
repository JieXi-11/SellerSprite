import { execFile, spawn } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, posix, win32 } from 'node:path';
import { promisify } from 'node:util';
import { isCdpAvailable, listCdpTargets, openCdpTarget, readCdpWebSession } from './cdp-auth.mjs';

const execFileAsync = promisify(execFile);
const loginUrl = 'https://www.sellersprite.com/w/user/login';

function registryValue(output, valueName) {
  const escaped = valueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(output).match(new RegExp(`(?:${escaped}|\\(Default\\))\\s+REG_\\w+\\s+(.+)$`, 'im'));
  return match?.[1]?.trim() || null;
}

function executableFromCommand(command) {
  const quoted = String(command).match(/^\s*"([^"]+\.exe)"/i);
  if (quoted) return quoted[1];
  return String(command).match(/^\s*(.+?\.exe)(?:\s|$)/i)?.[1]?.trim() || null;
}

export async function defaultBrowserExecutable() {
  if (process.platform === 'win32') return await windowsDefaultBrowser();
  if (process.platform === 'darwin') return await firstExecutable([
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ], 'macOS Chromium browser');
  if (process.platform === 'linux') return await linuxBrowser();
  throw new Error(`Automatic Chromium discovery is not implemented for ${process.platform}. Set SELLERSPRITE_BROWSER_PATH.`);
}

async function windowsDefaultBrowser() {
  const userChoiceKey = 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice';
  const { stdout: choiceOutput } = await execFileAsync('reg.exe', ['query', userChoiceKey, '/v', 'ProgId'], { windowsHide: true });
  const progId = registryValue(choiceOutput, 'ProgId');
  if (!progId) throw new Error('Windows default HTTPS browser ProgId was not found.');
  const commandKey = `HKCR\\${progId}\\shell\\open\\command`;
  const { stdout: commandOutput } = await execFileAsync('reg.exe', ['query', commandKey, '/ve'], { windowsHide: true });
  const command = String(commandOutput).match(/REG_\w+\s+(.+)$/im)?.[1]?.trim();
  const executable = executableFromCommand(command);
  if (!executable) throw new Error(`Default browser executable was not found for ${progId}.`);
  assertChromiumExecutable(executable);
  return { executable, source: progId };
}

function assertChromiumExecutable(executable) {
  const name = basename(executable).toLowerCase();
  const supported = ['chrome', 'chrome.exe', 'google-chrome', 'google-chrome-stable', 'msedge', 'msedge.exe',
    'microsoft-edge', 'brave', 'brave.exe', 'brave-browser', 'chromium', 'chromium.exe', 'chromium-browser'];
  if (!supported.some((candidate) => name === candidate || executable.toLowerCase().includes(`${candidate}.app`))) {
    throw new Error(`The selected browser ${name} does not expose Chrome CDP. Set SELLERSPRITE_BROWSER_PATH to Chrome, Edge, Brave, or Chromium.`);
  }
}

async function firstExecutable(candidates, source) {
  for (const executable of candidates) {
    try {
      await access(executable, fsConstants.X_OK);
      assertChromiumExecutable(executable);
      return { executable, source };
    } catch {}
  }
  throw new Error(`${source} was not found. Set SELLERSPRITE_BROWSER_PATH.`);
}

async function linuxDesktopBrowser() {
  try {
    const { stdout } = await execFileAsync('xdg-settings', ['get', 'default-web-browser']);
    const desktopFile = stdout.trim();
    if (!desktopFile) return null;
    const candidates = [join(homedir(), '.local/share/applications', desktopFile), join('/usr/share/applications', desktopFile)];
    for (const path of candidates) {
      try {
        const content = await readFile(path, 'utf8');
        const command = content.match(/^Exec=(.+)$/m)?.[1]?.replace(/\s+%\w.*$/, '');
        const executable = executableFromCommand(command) || command?.split(/\s+/)[0];
        if (executable) {
          assertChromiumExecutable(executable);
          return executable;
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function linuxBrowser() {
  const desktop = await linuxDesktopBrowser();
  if (desktop) return { executable: desktop, source: 'xdg-settings' };
  for (const command of ['google-chrome-stable', 'google-chrome', 'microsoft-edge', 'brave-browser', 'chromium', 'chromium-browser']) {
    try {
      const { stdout } = await execFileAsync('which', [command]);
      const executable = stdout.trim();
      if (executable) return { executable, source: 'PATH' };
    } catch {}
  }
  throw new Error('A Chromium browser was not found on Linux. Set SELLERSPRITE_BROWSER_PATH.');
}

export function defaultBrowserProfilePath(platform = process.platform, env = process.env) {
  if (platform === 'win32') return win32.join(env.LOCALAPPDATA || env.TEMP || homedir(), 'SellerSpriteMCP', 'Chrome');
  if (platform === 'darwin') return posix.join(env.HOME || homedir(), 'Library', 'Application Support', 'SellerSpriteMCP', 'Chrome');
  return posix.join(env.XDG_CONFIG_HOME || posix.join(env.HOME || homedir(), '.config'), 'sellersprite-mcp', 'chrome');
}

async function waitForCdp(cdpUrl, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isCdpAvailable(cdpUrl)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }
  throw new Error(`Browser CDP did not start at ${cdpUrl}.`);
}

export async function openSellerSpriteLogin({ cdpUrl, browserPath, profilePath }) {
  let launched = false;
  let browser = browserPath || null;
  let browserSource = browserPath ? 'SELLERSPRITE_BROWSER_PATH' : null;
  if (!await isCdpAvailable(cdpUrl)) {
    if (!browser) {
      const detected = await defaultBrowserExecutable();
      browser = detected.executable;
      browserSource = detected.source;
    }
    const profile = profilePath || defaultBrowserProfilePath();
    await mkdir(profile, { recursive: true });
    const port = new URL(cdpUrl).port || '9222';
    const child = spawn(browser, [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--new-window',
      'about:blank'
    ], { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    launched = true;
    await waitForCdp(cdpUrl);
  }
  const targetId = await openCdpTarget(cdpUrl, loginUrl);
  return { opened: true, launched, browser, browserSource, targetId, loginUrl };
}

export async function waitForSellerSpriteLogin(cdpUrl, targetId, waitSeconds) {
  const deadline = Date.now() + Math.max(0, waitSeconds) * 1000;
  do {
    try {
      const targets = await listCdpTargets(cdpUrl);
      const target = targets.find((item) => item.id === targetId);
      const sellerSpritePage = target?.url?.startsWith('https://www.sellersprite.com/');
      const stillOnLogin = target?.url?.includes('/w/user/login');
      if (sellerSpritePage && !stillOnLogin) {
        const session = await readCdpWebSession(cdpUrl);
        return { loginComplete: true, cookieCount: session.cookieCount, browser: session.browser, currentUrl: target.url };
      }
    } catch {
      // The target can briefly disappear during an external identity-provider redirect.
    }
    if (Date.now() >= deadline) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
  } while (true);
  return { loginComplete: false, message: 'Login window opened. Complete sign-in, then call sellersprite_session_status.' };
}
