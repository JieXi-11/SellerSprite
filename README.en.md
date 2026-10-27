# SellerSprite MCP

[简体中文](README.md) | [English](README.en.md)

Give AI assistants structured access to SellerSprite product, keyword, traffic, market, and review data through MCP.

**Start here: install → add MCP → sign in → query.** The server runs locally and uses your SellerSprite session in a dedicated browser profile. No server deployment or SellerSprite API key is required. Data access still depends on account permissions, collected data, and upstream availability.

## Documentation

| Task | Guide |
| --- | --- |
| Install and make your first query | Quick start below |
| Find useful prompts | [Query examples](#query-examples) |
| Fix startup or login; change browser or port | [Configuration and troubleshooting](docs/configuration.en.md) |
| Run from source, test, or contribute | [Development guide](docs/development.en.md) |
| Inspect operation parameters | Ask the AI to call `sellersprite_describe_operation`, or read the [catalog](data/operations.json) |

## Quick start

### 1. Install locally

Requirements:

- [Node.js](https://nodejs.org/) 22 or newer, including npm.
- [Git](https://git-scm.com/downloads), used by npm to install from GitHub.
- Chrome, Edge, Brave, or Chromium.
- A SellerSprite account and an AI client supporting **local STDIO MCP**.

Run in Windows PowerShell or a macOS / Linux terminal:

```sh
node --version
npm --version
git --version
npm install -g git+https://github.com/JieXi-11/SellerSprite.git
npm list -g sellersprite-mcp --depth=0
```

**Checkpoint:** Node reports `v22` or later, and the last command lists `sellersprite-mcp`. Restart your AI client afterward so it picks up the executable path.

You do not need to clone the repository or run `npm start` for this method. For errors, see [startup issues](docs/configuration.en.md#startup-issues).

### 2. Add MCP to your AI client

Choose **one** method below. Do not register the same server multiple times.

#### Option A: an MCP configuration form

| Field | Value |
| --- | --- |
| Name | `sellersprite` |
| Type / transport | `STDIO` (local command) |
| Command | `sellersprite-mcp` |
| Arguments | Leave empty |
| Environment variable | Key: `SELLERSPRITE_CDP_URL`; value: `http://127.0.0.1:9222` |

Port `9222` belongs to the local **browser debugger**, not a remote MCP server. Do not enter it into an HTTP / SSE server URL field.

#### Option B: MCP JSON configuration

Merge this into your client's MCP configuration, preserving existing servers. The file location depends on the client.

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

The same example is in [mcp.example.json](mcp.example.json). This JSON is configuration, not a PowerShell command.

#### Option C: an existing Codex CLI installation

```sh
codex mcp add sellersprite --env SELLERSPRITE_CDP_URL=http://127.0.0.1:9222 -- sellersprite-mcp
codex mcp get sellersprite
```

If `codex` is not installed, use option A or B. Client capabilities vary by version; see the [Codex MCP documentation](https://developers.openai.com/codex/mcp/).

**Checkpoint:** After saving and reloading MCP, the AI can call `sellersprite_session_status` and `sellersprite_login`. If tools are missing, fix [startup issues](docs/configuration.en.md#startup-issues) before repeating browser login.

### 3. Sign in through the dedicated browser

Send this to the AI:

```text
Check my SellerSprite MCP session. If it is not ready, call
sellersprite_login with waitSeconds set to 0 to open the login window.
```

Sign in to SellerSprite in that browser, then tell the AI:

```text
I have signed in. Call sellersprite_session_status again.
```

- **The dedicated profile does not share your everyday browser session.** Being signed in elsewhere does not sign MCP in.
- **Web and extension authentication are separate.** For reverse keyword lookup, sales trends, and other extension operations, install and sign in to the SellerSprite extension in the same dedicated browser. Web-only operations do not require it.
- **Keep the dedicated browser running during use.** Its profile persists; call the login tool again to reopen it when needed.

**Checkpoint:** `ready: true` means web cookies were found. Extension operations also need `extension.valid: true`. These are local credential checks, not proof of permissions or upstream success. See [status fields](docs/configuration.en.md#status-fields).

On Windows, automatic startup uses the default HTTPS browser. If it is Firefox or another unsupported browser, [set an explicit browser path](docs/configuration.en.md#browser-and-profile-overrides).

### 4. Make your first query

First check tool connectivity by reading the catalog; this does not request SellerSprite data:

```text
Call sellersprite_list_operations to find keyword operations.
```

Then try a real query:

```text
Use SellerSprite MCP to fetch details for US ASIN B09BF6XJY1.
Check my session, discover the ASIN detail operation, read its parameters,
and query. Report authentication, permission, or data errors as-is.
Do not invent missing data.
```

Replace the ASIN with your target product. Actual product data confirms that query succeeded. For empty results, check the marketplace, ASIN, and account access.

## Query examples

Replace the marketplace, ASIN, category, and date conditions. Have the AI inspect supported filters first.

**Product research:**

```text
Find fast-growing US products in the latest available SellerSprite period.
Prioritize listings under three months old and non-seasonal products; exclude
personal care, medical products, and small appliances. Check supported filters.
Report ASINs, listing dates, growth metrics, reporting periods, and sources.
Do not infer rapid growth from current sales alone if historical data is missing.
```

**Competitors and keywords:**

```text
Analyze keywords and traffic sources for US ASIN B09BF6XJY1.
Read the reverse keyword and traffic-source operation descriptions first;
check extension login. Separate organic and advertising-related data,
state the reporting period, and suggest improvements to validate.
```

**Review pain points:**

```text
Read low-star reviews for US ASIN B09BF6XJY1 and identify defects,
usability problems, and improvements. Read the review operation description.
If my account has no review corpus, ask me to collect it first.
Report pages and reviews read; do not treat a small sample as all reviews.
```

## Tools and coverage

Five MCP tools expose 40 mapped operations. Catalog verification records describe historical checks, not live validation of every operation in your installation.

| Tool | Purpose |
| --- | --- |
| `sellersprite_session_status` | Check access to web cookies and extension credentials |
| `sellersprite_login` | Open a dedicated login browser; optionally wait for sign-in |
| `sellersprite_list_operations` | Discover operations by name or purpose |
| `sellersprite_describe_operation` | Inspect parameters, defaults, authentication, and prerequisites |
| `sellersprite_call` | Execute an operation and return structured results |

Recommended order: `session_status → login if needed → list_operations → describe_operation → call`.

Coverage includes products, competitors, ASIN details and trends, keywords, related traffic, ABA, market concentration and distributions, and reviews. Use [data/operations.json](data/operations.json) and each operation's `tool_input` for exact parameters.

## Updates and daily use

For daily use, open your AI client, check login, and query. No reinstall is needed. To update:

```sh
npm install -g git+https://github.com/JieXi-11/SellerSprite.git
```

Restart MCP or the AI client afterward. Normal updates do not remove login information from the dedicated browser profile.

Enter passwords only on the SellerSprite website or extension, never in AI prompts. Default mode does not save cookies or extension tokens in project files, but the browser profile stores login information. Do not share that directory or expose the debugging port to the public internet.
