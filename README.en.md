# SellerSprite MCP

[简体中文](README.md) | [English](README.en.md)

Give AI agents direct, structured access to SellerSprite data.

## The Problem

Most SellerSprite data depends on a logged-in web session or browser-extension state. A normal agent may know what to research but still cannot retrieve the data reliably because:

- page scraping is unstable and returns presentation markup instead of structured data;
- web requests require cookies, while extension requests also require dynamic signing and extension credentials;
- each feature uses different endpoints, methods, field names, pagination rules, and enums;
- the agent does not know which SellerSprite feature fits a business question or how to fill its parameters;
- passing full pages into the model wastes context tokens and produces inconsistent parsing.

SellerSprite MCP provides one execution layer for these cases. The agent supplies an operation and business parameters; the server then:

1. translates the Agent input into the current SellerSprite web request;
2. injects the local web or extension login state;
3. generates dynamic extension parameters and handles renewable authorization;
4. calls the real `www.sellersprite.com` endpoint;
5. returns structured JSON.

The project currently covers **40 mapped and verified SellerSprite features**, including product research, competitors, ASIN data, keywords, traffic, ABA, market research, and reviews.

## MCP Tools

The server exposes five stable tools instead of creating 40 separate tools:

| Tool | Purpose |
|---|---|
| `sellersprite_session_status` | Check CDP, web, and extension login state without returning cookies or tokens |
| `sellersprite_login` | Open the login page in the default Chromium browser, wait for the user, and read the resulting session |
| `sellersprite_list_operations` | Find operations by name, purpose, authentication type, or web endpoint |
| `sellersprite_describe_operation` | Inspect Agent input, actual web request, defaults, enums, prerequisites, and response semantics |
| `sellersprite_call` | Execute an operation and return structured data |

The standard Agent flow is:

```text
session_status -> [login] -> list_operations -> describe_operation -> call
```

## Coverage

- Products: product research, competitor lookup, categories, ASIN details, sales and offer trends, Keepa trends, and BSR sales estimation.
- Keywords: reverse lookup, keyword research, mining, traffic expansion, order keywords, and Google Trends.
- Traffic: related traffic, keyword statistics, traffic sources, and keyword destinations.
- ABA: weekly research, monthly research, and keyword trends.
- Markets: market lists, statistics, concentration metrics, and distribution trends.
- Reviews: star, image, video, Verified Purchase, Vine, and review detail filters.

The full catalog is in [`data/operations.json`](data/operations.json). Every operation includes a Chinese feature description, Agent input contract, actual web request template, field semantics, response documentation, and verification evidence.

## Requirements

- Node.js 22 or newer, with `node` available on `PATH`.
- A valid SellerSprite web login session.
- A logged-in SellerSprite Chrome extension for extension-authenticated operations.

There are no runtime npm dependencies.

## MCP Installation

Install the MCP command directly from GitHub. Cloning the repository or choosing a fixed directory is not required:

```bash
npm install -g github:JieXi-11/SellerSprite
```

This installs the `sellersprite-mcp` command. Configure any MCP client with:

```json
{
  "mcpServers": {
    "sellersprite": {
      "command": "sellersprite-mcp",
      "args": [],
      "env": {
        "SELLERSPRITE_CDP_URL": "http://127.0.0.1:9222"
      }
    }
  }
}
```

See [`mcp.example.json`](mcp.example.json) for the complete example.

## Quick Start

### 1. Get the project

```powershell
git clone https://github.com/JieXi-11/SellerSprite.git
cd SellerSprite
node --check src/server.mjs
node --test "test/*.test.mjs"
```

### 2. Start a login browser

After installing the MCP, an Agent can call `sellersprite_login`. It discovers Chrome, Edge, Brave, or Chromium on Windows, macOS, and Linux and selects a platform-appropriate persistent profile directory.

For manual startup on macOS:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/SellerSpriteMCP/Chrome"
```

For manual startup on Linux:

```bash
google-chrome --remote-debugging-port=9222 \
  --user-data-dir="${XDG_CONFIG_HOME:-$HOME/.config}/sellersprite-mcp/chrome"
```

For manual startup on Windows:

After closing Chrome instances that use the same profile, start Chrome with a remote debugging port:

```powershell
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$profile = "$env:LOCALAPPDATA\SellerSpriteMCP\Chrome"
& $chrome --remote-debugging-port=9222 --user-data-dir=$profile
```

On the first run:

1. Sign in at `https://www.sellersprite.com`.
2. Install the SellerSprite Chrome extension.
3. Sign in through the extension.
4. Keep Chrome running.

The MCP server reads SellerSprite cookies, the browser User-Agent, and extension `chrome.storage.local` through CDP before each call. Updated login state is picked up automatically; no session or token file is required.

An Agent can also call `sellersprite_login` with `{"waitSeconds":180}`. The tool discovers a supported Chromium browser on Windows, macOS, or Linux, opens the SellerSprite login page in a persistent MCP profile, and waits for the user to finish signing in. Credentials remain in the browser and do not pass through the Agent or MCP.

Verify the CDP endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json/version
```

### 3. Start the server

From the project root:

```bash
node scripts/start-mcp.mjs
```

For a different debugging port:

```powershell
$env:SELLERSPRITE_CDP_URL = "http://127.0.0.1:9333"
node src/server.mjs
```

## Codex Configuration

Install the global command and register it with Codex:

```bash
npm install -g github:JieXi-11/SellerSprite
codex mcp add sellersprite --env SELLERSPRITE_CDP_URL=http://127.0.0.1:9222 -- sellersprite-mcp
```

Verify the registration:

```bash
codex mcp get sellersprite
```

Run `npm install -g github:JieXi-11/SellerSprite` again to update. Codex starts the globally installed command, so its configuration contains no repository, drive, or user-specific path.

### Using the login tool

After reloading the MCP configuration, ask the Agent:

```text
Check the SellerSprite session. If it is signed out, open the SellerSprite login window and wait for me to sign in.
```

The Agent first calls `sellersprite_session_status`. If it returns `ready: false`, it calls:

```json
{
  "waitSeconds": 180
}
```

This `sellersprite_login` call discovers a supported Chromium browser, starts it with the platform-specific persistent profile and CDP port `9222`, opens the login page, and waits for sign-in. Account credentials are entered only on the SellerSprite page and are not passed through Agent prompts or MCP arguments.

Set `waitSeconds` to `0` to open the window and return immediately, or up to `300` when additional verification takes longer. After a successful first login, the persistent browser profile is reused. Extension-authenticated operations also require installing and signing in to the SellerSprite extension once in the same browser profile.

## Other MCP Clients

For a generic stdio MCP client:

```json
{
  "mcpServers": {
    "sellersprite": {
      "command": "sellersprite-mcp",
      "args": [],
      "env": {
        "SELLERSPRITE_CDP_URL": "http://127.0.0.1:9222"
      }
    }
  }
}
```

## Agent Usage

The Agent does not need to guess web endpoints. Example prompt:

```text
Check the SellerSprite session, find the review operation, read its parameter
contract, and retrieve five five-star reviews for ASIN B09BF6XJY1.
```

The Agent should call:

1. `sellersprite_session_status`
2. `sellersprite_list_operations({"query":"review"})`
3. `sellersprite_describe_operation({"operation":"review"})`
4. `sellersprite_call(...)`

Final tool arguments:

```json
{
  "operation": "review",
  "params": {
    "marketplace": "US",
    "asin": "B09BF6XJY1",
    "starList": [5],
    "typeList": [],
    "page": 1,
    "size": 5
  }
}
```

Market-research prompt example:

```text
Use SellerSprite to find market-research operations. After reading their
contracts, retrieve product concentration, brand concentration, and price
distribution for the specified US category over the latest 30-day period.
```

## Operation Description

`sellersprite_describe_operation` returns:

| Field | Meaning |
|---|---|
| `title` / `description` | Feature name and purpose |
| `authentication` | Web cookie, extension state, or mixed authentication |
| `tool_input` | Parameters accepted by `sellersprite_call` |
| `web_request` | Actual web endpoint, method, template, and fields |
| `defaults` / `enums` | Defaults and enum values |
| `precondition` | Data prerequisites such as a collected review corpus |
| `web_response` | Response fields and semantics |
| `verification` | Live-request verification evidence |

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `SELLERSPRITE_CDP_URL` | Debug endpoint of the signed-in Chrome | `http://127.0.0.1:9222` |
| `SELLERSPRITE_BROWSER_PATH` | Optional override for the discovered Chromium executable | Auto-detected |
| `SELLERSPRITE_BROWSER_PROFILE` | Optional persistent profile used by the login browser | Platform-specific |
| `SELLERSPRITE_CALL_TIMEOUT_MS` | Call timeout in milliseconds | `120000` |
| `SELLERSPRITE_MAX_OUTPUT_BYTES` | Maximum response size | `20971520` |

Default profile directories:

| Platform | Directory |
|---|---|
| Windows | `%LOCALAPPDATA%\SellerSpriteMCP\Chrome` |
| macOS | `$HOME/Library/Application Support/SellerSpriteMCP/Chrome` |
| Linux | `${XDG_CONFIG_HOME:-$HOME/.config}/sellersprite-mcp/chrome` |

## Tests

Protocol and catalog tests:

```powershell
node --test test/protocol.test.mjs
```

Live web-session test:

```powershell
$env:SELLERSPRITE_LIVE_TEST = "1"
node --test test/live.test.mjs
```

Live extension test:

```powershell
$env:SELLERSPRITE_LIVE_EXTENSION_TEST = "1"
node --test test/live.test.mjs
```

## Troubleshooting

### Web requests report an expired login

Sign in to SellerSprite again in the CDP-attached Chrome, then call `sellersprite_session_status`. The next request reads the current cookies automatically.

### Extension requests require re-authorization

Open the SellerSprite extension in the CDP-attached Chrome and sign in again. The next extension call reads the current `chrome.storage.local` values. Renewable authorization is handled automatically.

### Review calls return an empty list

The logged-in review endpoint depends on an existing review-analysis corpus in the account. Collect the ASIN on the SellerSprite review-analysis page first.

### The Agent does not know which operation to use

Have it call `sellersprite_list_operations` with a business keyword and then `sellersprite_describe_operation`. It should not guess operation names or parameters.

## Credential Safety

- Default CDP mode does not write cookies, extension tokens, or UUIDs into project files.
- Keep the debugging port bound to localhost; do not expose it to a LAN or the public internet.
- In fallback file mode, `session.json`, `extension-state.json`, `.env`, and log files are ignored.
- `sellersprite_session_status` reports status without returning credential values.
