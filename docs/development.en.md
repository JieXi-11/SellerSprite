# Development guide

[Home](../README.en.md) | [简体中文](development.md) | [Configuration](configuration.en.md)

Use this guide to change source or run tests. Regular users only need the global installation in the README.

## Run from source

Requires Node.js 22+ and Git. There are no runtime npm dependencies; `npm install` is unnecessary.

```sh
git clone https://github.com/JieXi-11/SellerSprite.git
cd SellerSprite
npm run check
node --test test/protocol.test.mjs test/portability.test.mjs
```

Configure the client with absolute paths to Node and the repository's `src/server.mjs`:

```json
{
  "mcpServers": {
    "sellersprite": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/SellerSprite/src/server.mjs"],
      "env": {
        "SELLERSPRITE_CDP_URL": "http://127.0.0.1:9222"
      }
    }
  }
}
```

Replace both placeholders. See [Windows path syntax](configuration.en.md#launch-with-absolute-paths). The server does not depend on the client's working directory; `scripts/start-mcp.mjs` is also a supported entry point. Do not enable source and global installations under the same server name.

Running `npm start` or `node scripts/start-mcp.mjs` manually waits for MCP JSON-RPC input. Silence alone is not a startup failure.

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/server.mjs` | STDIO protocol, five tools, credential reading, dispatch |
| `src/adapter.mjs` | Business parameter mapping and web/extension requests |
| `src/browser-login.mjs` | Browser discovery, profiles, login page |
| `src/cdp-auth.mjs` | CDP communication and credential reading |
| `data/operations.json` | Operations, parameters, historical verification |
| `scripts/start-mcp.mjs` | Launcher usable outside the repository directory |
| `test/` | Protocol, portability, optional live tests |
| `docs/` | Chinese and English configuration/development guides |

## Operation parameters

Discover with `sellersprite_list_operations`, then inspect with `sellersprite_describe_operation`.

| Field | Meaning |
| --- | --- |
| `authentication` | `web`, `extension`, or `mixed` requirements |
| `tool_input` | Business parameters for `sellersprite_call.params` |
| `web_request` | Adapter endpoint and fields, not direct tool inputs |
| `defaults` / `enums` | Defaults and allowed values |
| `precondition` | Requirements such as a collected review corpus |
| `web_response` | Response field semantics |
| `verification` | Historical evidence, not a current availability guarantee |

After collecting the example ASIN's review corpus in the same account, call `sellersprite_call` with:

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

These are tool arguments, not a shell command. Use `tool_input` names such as `marketplace`, `page`, and `size`, not web-layer names such as `market`, `pageNum`, and `pageSize`. Inspect other operations individually.

## Validate changes

Checks requiring no login:

```sh
npm run check
node --test test/protocol.test.mjs test/portability.test.mjs
```

`npm test` also includes the live test file, but live tests skip unless enabled below. If an early Node 22 release cannot expand the test glob, use the explicit file list above or upgrade Node.

Live tests require a running, signed-in dedicated browser and may consume account query allowance. The web test requires an existing review corpus for `B09BF6XJY1`; the extension test requires extension login. Enable either or both switches as needed.

Windows PowerShell:

```powershell
$env:SELLERSPRITE_LIVE_TEST = "1"
$env:SELLERSPRITE_LIVE_EXTENSION_TEST = "1"
node --test test/live.test.mjs
Remove-Item Env:SELLERSPRITE_LIVE_TEST, Env:SELLERSPRITE_LIVE_EXTENSION_TEST
```

macOS / Linux:

```sh
SELLERSPRITE_LIVE_TEST=1 SELLERSPRITE_LIVE_EXTENSION_TEST=1 node --test test/live.test.mjs
```

When login is unavailable, report live tests as not run. Passing offline checks does not verify all 40 operations against the live service.

For documentation edits, check relative links and JSON examples against the implementation, then run `npm pack --dry-run` to confirm documentation is included. Editing source does not update a separate global installation; point the development client at local source.

## Maintenance conventions

- Update the adapter and operation catalog together when endpoints or parameters change; record the actual verification scope.
- Keep installation in the README, customization/troubleshooting in the configuration guide, and tests here. Update both languages.
- Reserve stdout for MCP protocol messages; write diagnostics to stderr.
- MCP reads credentials through CDP and passes them to the adapter through its subprocess environment. There is no user-facing `session.json` / `extension-state.json` login workflow; ignored filenames do not establish support for file-based authentication.
- Never commit credentials, browser profiles, or logs containing authentication data.
