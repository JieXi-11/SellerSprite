# Configuration and troubleshooting

[Home](../README.en.md) | [简体中文](configuration.md) | [Development](development.en.md)

Complete the four quick-start steps first. Use this guide for failures or custom settings.

## Startup issues

| Symptom | Action |
| --- | --- |
| `node`, `npm`, or `git` not found | Install the program, reopen the terminal, and check its version; Node must be 22+ |
| PowerShell blocks `npm.ps1` | Run the same npm command using `npm.cmd`; a global execution-policy change is unnecessary |
| GitHub connection fails during installation | Check network access with `git ls-remote https://github.com/JieXi-11/SellerSprite.git HEAD` |
| npm permission error | Check the global install directory; use a user-writable Node/npm installation rather than broadly relaxing system permissions |
| Command works in a terminal but not the AI client | Restart the client; otherwise configure absolute Node and script paths below |
| Windows cannot launch `sellersprite-mcp` | Some clients accept `sellersprite-mcp.cmd`; if yours does not, use absolute Node/script paths to avoid command-wrapper support issues |
| Running the command manually produces no output | Expected: this STDIO server waits for MCP messages, not HTTP requests. Stop it with Ctrl+C and let the client start it |
| A Skill is visible but no MCP tools appear | Check server registration and startup logs, inspect duplicate or stale configurations, then reload; a loaded Skill does not prove the server started |

### Launch with absolute paths

Use this if the graphical client cannot see your terminal PATH or cannot execute npm wrappers on Windows.

Windows PowerShell:

```powershell
(Get-Command node.exe).Source
npm.cmd root -g
```

macOS / Linux:

```sh
command -v node
npm root -g
```

Use the first output for `command`. Append `/sellersprite-mcp/src/server.mjs` to the second output for the sole argument. This Windows configuration is an **example**; replace paths with your actual outputs:

```json
{
  "mcpServers": {
    "sellersprite": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": ["C:/Users/YOUR_USER/AppData/Roaming/npm/node_modules/sellersprite-mcp/src/server.mjs"],
      "env": {
        "SELLERSPRITE_CDP_URL": "http://127.0.0.1:9222"
      }
    }
  }
}
```

Windows JSON paths may use `/` or escaped `\\`. Keep arguments separate from `command`; do not paste a whole shell command into that field.

## Status fields

`sellersprite_session_status` does not perform a complete upstream permission check.

| Field | Current implementation |
| --- | --- |
| `ready` / `web.valid` | At least one SellerSprite cookie survived local expiry filtering and was read through CDP; upstream authentication may still fail |
| `connected` | Set to `true` only after web cookies are read; `false` alone does not establish that the debugging port is unavailable |
| `extension.valid` | Extension token and UUID were read; upstream acceptance and permissions are not verified |
| `web.error` / `extension.error` | Credential-reading error details |
| `operationCount` | Number of catalog operations |

With `ready: true` and `extension.valid: false`, web operations can still be attempted. Operations marked `extension` or `mixed` additionally need extension login. All business operations currently read web cookies first, including extension operations.

## Login and query issues

| Symptom | Action |
| --- | --- |
| Signed in elsewhere but MCP is not ready | Sign in through the dedicated profile opened by the login tool |
| No browser appears; unsupported browser error | On Windows, set `SELLERSPRITE_BROWSER_PATH` to a Chromium browser, then restart MCP |
| `Browser CDP did not start` | Check executable and port; close the browser using the same dedicated profile before reopening with debugging enabled |
| `No SellerSprite cookies found` | CDP was reached but no SellerSprite cookies were found; sign in using that profile |
| Client times out while waiting for login | Use `waitSeconds: 0`, sign in manually, then check status |
| `extension.valid: false` | Install and sign in to the SellerSprite extension in the same dedicated browser |
| Status looks ready but upstream reports expired login | Sign in again; subsequent calls read refreshed credentials |
| Permission denied | Verify the same feature is available to your account on SellerSprite; MCP does not grant membership permissions |
| Empty review list | Collect the ASIN's review corpus in the same account first; check marketplace and filters |
| Timeout or oversized output | Reduce page size/query scope first; adjust limits if needed and check the client's own tool timeout |

### Check the browser debugging endpoint

Windows PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json/version
```

macOS / Linux:

```sh
curl --fail http://127.0.0.1:9222/json/version
```

A JSON response containing `webSocketDebuggerUrl` confirms debugging access, **not SellerSprite login**. Do not publicly share the full debugger connection URL.

## Environment variables

Set these in the client's MCP server configuration and restart MCP afterward. Terminal-only environment changes do not update an already-running graphical client.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SELLERSPRITE_CDP_URL` | `http://127.0.0.1:9222` | Local browser debugging endpoint |
| `SELLERSPRITE_BROWSER_PATH` | Automatic | Absolute browser executable path |
| `SELLERSPRITE_BROWSER_PROFILE` | See below | Persistent login-browser profile |
| `SELLERSPRITE_CALL_TIMEOUT_MS` | `120000` | Adapter subprocess limit in milliseconds, excluding preceding CDP reads; does not override client timeouts |
| `SELLERSPRITE_MAX_OUTPUT_BYTES` | `20971520` | Adapter stdout limit, 20 MiB |

The login tool's `waitSeconds` is a tool argument, not an environment variable. Default: `180`; range: `0–300`. `0` skips waiting for sign-in after opening the page; browser startup and connection still take time.

### Browser and profile overrides

Discovery: Windows reads the default HTTPS browser and checks CDP support; macOS checks Chrome, Edge, Brave, then Chromium in `/Applications`; Linux tries its desktop default, then PATH.

To override, add `SELLERSPRITE_BROWSER_PATH` to the MCP `env`. A common Windows Chrome path is `C:/Program Files/Google/Chrome/Application/chrome.exe`; confirm the file exists. Do not include launch arguments in the path value.

| OS | Default profile directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%\SellerSpriteMCP\Chrome` |
| macOS | `$HOME/Library/Application Support/SellerSpriteMCP/Chrome` |
| Linux | `${XDG_CONFIG_HOME:-$HOME/.config}/sellersprite-mcp/chrome` |

Use an absolute path for overrides. The table describes defaults; do not assume clients expand `$HOME`, `~`, or `%LOCALAPPDATA%` inside JSON values.

If CDP is already accessible at the configured endpoint, login reuses that browser. Changing executable or profile settings does not switch an existing connection.

### Manual browser startup (optional)

Use only when automatic startup fails or you want to manage the browser yourself. Close instances using the same dedicated profile first; adjust Chrome paths for your installation.

Windows PowerShell:

```powershell
$chromePath = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$sellerSpriteProfile = "$env:LOCALAPPDATA\SellerSpriteMCP\Chrome"
& $chromePath --remote-debugging-port=9222 --user-data-dir=$sellerSpriteProfile https://www.sellersprite.com/w/user/login
```

macOS:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/SellerSpriteMCP/Chrome" \
  https://www.sellersprite.com/w/user/login
```

Linux (graphical desktop required):

```sh
google-chrome --remote-debugging-port=9222 \
  --user-data-dir="${XDG_CONFIG_HOME:-$HOME/.config}/sellersprite-mcp/chrome" \
  https://www.sellersprite.com/w/user/login
```

To change ports, update both `--remote-debugging-port` and MCP's `SELLERSPRITE_CDP_URL`, for example `9333` and `http://127.0.0.1:9333`. This setup guide targets a local browser.

## Reporting a problem

Include OS, Node version, installation method, client name, failing step, redacted errors, operation name, and business parameters. Do not share passwords, cookies, tokens, or browser profiles. Historical catalog verification records do not replace current error details.
