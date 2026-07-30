# SellerSprite MCP

[简体中文](README.md) | [English](README.en.md)

让 AI Agent 直接读取和调用卖家精灵数据。

## 解决的问题

卖家精灵的大部分数据依赖网页登录状态或浏览器扩展状态。普通 Agent 即使知道要查询什么，也会遇到几个问题：

- Agent 只能看到网页，不能稳定读取页面背后的结构化数据；
- 网页接口需要 Cookie，扩展接口还需要动态签名和扩展登录状态；
- 不同功能使用不同的 URL、请求方法、字段名称、分页和枚举；
- Agent 不知道某个选品问题应该调用哪个功能，也不知道参数如何填写；
- 直接把网页内容交给 Agent，会消耗大量上下文并产生不稳定的解析结果。

SellerSprite MCP 把这些问题统一封装起来。Agent 只需要选择操作并提供业务参数，MCP 会完成：

1. 将 Agent 参数转换为卖家精灵当前网页请求；
2. 注入本机网页登录状态或扩展登录状态；
3. 生成扩展接口所需的动态参数并处理可续期授权；
4. 调用真实的 `www.sellersprite.com` 接口；
5. 返回结构化 JSON 数据。

项目目前覆盖 **40 个已经映射和验证的卖家精灵功能**，包括选产品、查竞品、ASIN、关键词、流量、ABA、选市场和评论数据。

## MCP 工具

服务只暴露五个稳定工具，避免让 Agent 面对 40 个独立工具：

| 工具 | 用途 |
|---|---|
| `sellersprite_session_status` | 检查 CDP、网页和扩展登录状态，不返回 Cookie、Token 等认证内容 |
| `sellersprite_login` | 使用默认 Chromium 浏览器打开登录页，等待用户完成登录并读取登录态 |
| `sellersprite_list_operations` | 按名称、用途、认证类型或网页端点查找功能 |
| `sellersprite_describe_operation` | 查看功能说明、输入参数、网页请求、默认值、枚举和前置条件 |
| `sellersprite_call` | 执行指定功能并返回结构化结果 |

Agent 的标准调用顺序是：

```text
session_status -> [login] -> list_operations -> describe_operation -> call
```

## 已覆盖功能

- 产品：选产品、查竞品、产品类目、ASIN 详情、销量与优惠趋势、Keepa 趋势、BSR 销量预测。
- 关键词：关键词反查、关键词选品、关键词挖掘、拓展流量词、出单词反查、谷歌趋势。
- 流量：关联流量、流量词统计、流量来源、关键词流向。
- ABA：按周选品、按月选品、关键词趋势。
- 市场：市场列表、统计、商品/品牌/卖家集中度及各类分布趋势。
- 评论：星级、图片、视频、VP、Vine 评论筛选与明细。

完整操作目录位于 [`data/operations.json`](data/operations.json)。每项操作都包含中文功能说明、Agent 输入、实际网页请求模板、字段含义、响应说明和验证证据。

## 环境要求

- Node.js 22 或更高版本，并确保 `node` 位于 `PATH`；
- 已登录的卖家精灵网页账号；
- 调用扩展功能时，需要安装并登录卖家精灵 Chrome 扩展。

项目没有运行时 npm 依赖，下载后可以直接启动。

## MCP 安装

推荐直接从 GitHub 安装为全局 npm 命令，无需克隆仓库，也不依赖固定目录：

```bash
node --version
npm --version
npm install -g github:JieXi-11/SellerSprite
npm list -g sellersprite-mcp --depth=0
```

`node --version` 需要输出 `v22` 或更高版本。安装命令执行后，`sellersprite-mcp` 必须位于当前终端的 `PATH`；重新启动 Codex 后再添加 MCP。

安装后系统中会提供 `sellersprite-mcp` 命令。MCP 客户端使用以下配置即可启动服务：

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

完整示例位于 [`mcp.example.json`](mcp.example.json)。

## 快速开始

### 1. 获取项目

```powershell
git clone https://github.com/JieXi-11/SellerSprite.git
cd SellerSprite
node --check src/server.mjs
node --test "test/*.test.mjs"
```

### 2. 登录浏览器

安装 MCP 后可以让 Agent 调用 `sellersprite_login`。工具会在 Windows、macOS 和 Linux 上寻找 Chrome、Edge、Brave 或 Chromium，并使用当前系统对应的持久化配置目录。

也可以手动启动专用调试浏览器。

Windows：

关闭使用同一用户目录的 Chrome 后，通过远程调试端口启动：

```powershell
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$profile = "$env:LOCALAPPDATA\SellerSpriteMCP\Chrome"
& $chrome --remote-debugging-port=9222 --user-data-dir=$profile
```

macOS：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/SellerSpriteMCP/Chrome"
```

Linux：

```bash
google-chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="${XDG_CONFIG_HOME:-$HOME/.config}/sellersprite-mcp/chrome"
```

首次启动后，在这个 Chrome 中完成：

1. 登录 `https://www.sellersprite.com`；
2. 安装卖家精灵 Chrome 扩展；
3. 在扩展中登录；
4. 保持 Chrome 运行。

MCP 会通过 CDP 实时读取卖家精灵 Cookie、浏览器 User-Agent 和扩展 `chrome.storage.local`。认证状态更新后会自动用于下一次调用，不需要维护 `session.json` 或扩展 Token 文件。

也可以让 Agent 调用：

```text
调用 sellersprite_login，打开登录窗口并等待 180 秒。
```

`sellersprite_login` 会在当前操作系统中寻找 Chrome、Edge、Brave 或 Chromium，并使用持久化的 MCP 专用用户目录打开卖家精灵登录页。用户直接在浏览器中输入账号密码，凭据不会经过 Agent 或 MCP；登录完成后，MCP 自动读取登录态。首次登录后，后续会复用该专用用户目录。

检查 CDP 是否启动：

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json/version
```

### 3. 启动 MCP

在项目根目录运行：

```bash
node scripts/start-mcp.mjs
```

使用其他调试端口时：

```powershell
$env:SELLERSPRITE_CDP_URL = "http://127.0.0.1:9333"
node src/server.mjs
```

## 接入 Codex

先安装全局命令，再注册到 Codex：

```bash
npm install -g github:JieXi-11/SellerSprite
codex mcp add sellersprite --env SELLERSPRITE_CDP_URL=http://127.0.0.1:9222 -- sellersprite-mcp
```

检查注册结果：

```bash
codex mcp get sellersprite
```

### 在“连接至自定义 MCP”界面填写

先执行上面的 `npm install -g`，然后按以下内容填写：

| 界面字段 | 填写内容 |
|---|---|
| 名称 | `sellersprite` |
| 类型 | `STDIO` |
| 启动命令 | `sellersprite-mcp` |
| 参数 | 留空 |
| 环境变量键 | `SELLERSPRITE_CDP_URL` |
| 环境变量值 | `http://127.0.0.1:9222` |
| 环境变量传递 | 留空 |

Windows 客户端提示找不到启动命令时，将启动命令填写为 `sellersprite-mcp.cmd`。保存配置后重新加载 MCP，并调用 `sellersprite_session_status` 检查连接。

如果 Codex 显示 Skill 已加载但 MCP 工具列表为空，说明旧插件仍在运行或 MCP 进程启动失败。停用旧的 SellerSprite 插件，确认 `node`、`npm` 和 `sellersprite-mcp` 在启动 Codex 的用户环境中可执行，然后创建新任务。MCP 工具显示在工具列表中，不显示为 `@` 插件标签。

更新项目时重新执行 `npm install -g github:JieXi-11/SellerSprite`。MCP 使用全局命令启动，因此仓库克隆位置、盘符和用户目录不会进入 Codex 配置。

### 登录工具如何使用

完成 MCP 配置并重新加载 Codex 后，可以直接对 Agent 说：

```text
使用 SellerSprite MCP 检查登录状态。如果没有登录，打开卖家精灵登录窗口并等待我完成登录。
```

Agent 会先调用：

```json
{}
```

对应工具为 `sellersprite_session_status`。如果返回 `ready: false`，Agent 接着调用：

```json
{
  "waitSeconds": 180
}
```

对应工具为 `sellersprite_login`。该调用会：

1. 在当前操作系统中寻找受支持的 Chromium 浏览器；
2. 确认浏览器是 Chrome、Edge、Brave 或 Chromium；
3. 使用当前操作系统对应的持久化用户目录；
4. 启动 `9222` CDP 调试端口；
5. 打开卖家精灵登录页；
6. 等待用户在浏览器中完成登录；
7. 登录成功后返回浏览器类型、Cookie 数量和当前页面，不返回 Cookie 内容。

账号和密码只在卖家精灵网页中输入，不要放入 Agent 提示词或 MCP 参数。

`waitSeconds` 的取值范围是 `0` 到 `300`：

| 值 | 行为 |
|---|---|
| `180` | 推荐；打开窗口并等待最多三分钟 |
| `0` | 只打开登录窗口并立即返回，登录后再调用 `sellersprite_session_status` |
| `300` | 登录过程包含验证码或第三方登录时使用 |

首次网页登录成功后，该登录态保存在专用浏览器目录中。以后通常只需要调用 `sellersprite_session_status`；Cookie 失效时再调用 `sellersprite_login`。

扩展认证与网页登录是两套状态。调用 BSR 销量预测等扩展功能前，还需要在同一个专用浏览器中安装卖家精灵扩展并登录一次。`sellersprite_session_status` 返回 `extension.valid: true` 时，扩展功能才已就绪。

如果调用登录工具后没有出现窗口，检查：

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json/version
```

也可以通过 `SELLERSPRITE_BROWSER_PATH` 和 `SELLERSPRITE_BROWSER_PROFILE` 覆盖自动发现结果。

## 接入其他 MCP 客户端

使用支持 stdio MCP 的客户端时，配置结构通常如下：

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

## Agent 如何使用

Agent 安装 MCP 后不需要自行猜测网页接口。推荐提示词：

```text
先检查 SellerSprite 登录状态，再查找与“评论”有关的操作。
读取操作说明后，查询 ASIN B09BF6XJY1 的五星评论，每页返回 5 条。
```

Agent 会依次调用：

1. `sellersprite_session_status`
2. 登录态失效时调用 `sellersprite_login({"waitSeconds":180})`
3. `sellersprite_list_operations({"query":"评论"})`
4. `sellersprite_describe_operation({"operation":"review"})`
5. `sellersprite_call(...)`

最终调用参数示例：

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

选市场示例提示词：

```text
使用 SellerSprite 查找选市场相关功能，读取参数说明后，
查询美国站指定类目最近 30 天的商品集中度、品牌集中度和价格分布。
```

## 操作说明结构

调用 `sellersprite_describe_operation` 后会返回：

| 字段 | 含义 |
|---|---|
| `title` / `description` | 功能名称和使用目的 |
| `authentication` | 使用网页 Cookie、扩展状态或混合认证 |
| `tool_input` | Agent 调用 `sellersprite_call` 时应传入的参数 |
| `web_request` | MCP 实际发送的网页端点、方法、模板和字段 |
| `defaults` / `enums` | 默认值和枚举 |
| `precondition` | 评论语料等数据前置条件 |
| `web_response` | 响应字段和语义 |
| `verification` | 真实请求验证记录 |

## 环境变量

| 环境变量 | 用途 | 默认值 |
|---|---|---|
| `SELLERSPRITE_CDP_URL` | 已登录 Chrome 的调试地址 | `http://127.0.0.1:9222` |
| `SELLERSPRITE_BROWSER_PATH` | 可选；覆盖自动识别的 Chromium 浏览器程序 | 自动发现 |
| `SELLERSPRITE_BROWSER_PROFILE` | 可选；覆盖当前系统的登录浏览器持久化目录 | 按操作系统自动选择 |
| `SELLERSPRITE_CALL_TIMEOUT_MS` | 单次调用超时毫秒数 | `120000` |
| `SELLERSPRITE_MAX_OUTPUT_BYTES` | 单次响应最大字节数 | `20971520` |

自动配置目录：

| 系统 | 默认目录 |
|---|---|
| Windows | `%LOCALAPPDATA%\SellerSpriteMCP\Chrome` |
| macOS | `$HOME/Library/Application Support/SellerSpriteMCP/Chrome` |
| Linux | `${XDG_CONFIG_HOME:-$HOME/.config}/sellersprite-mcp/chrome` |

## 测试

协议和操作目录测试：

```powershell
node --test test/protocol.test.mjs
```

网页真实请求测试：

```powershell
$env:SELLERSPRITE_LIVE_TEST = "1"
node --test test/live.test.mjs
```

扩展真实请求测试：

```powershell
$env:SELLERSPRITE_LIVE_EXTENSION_TEST = "1"
node --test test/live.test.mjs
```

## 常见问题

### 网页请求返回登录错误

在 CDP 附加的 Chrome 中重新登录卖家精灵，然后再次调用 `sellersprite_session_status`。下一次请求会自动读取最新 Cookie。

### 扩展请求返回重新认证状态

在 CDP 附加的 Chrome 中打开卖家精灵扩展并重新登录。下一次扩展调用会直接读取最新的 `chrome.storage.local`。可续期状态由适配器自动处理。

### 评论接口返回空列表

网页登录态评论接口依赖账号中已有的评论分析语料。先在卖家精灵评论分析页面采集对应 ASIN，再调用评论接口。

### Agent 不知道调用哪个操作

让 Agent 先调用 `sellersprite_list_operations` 搜索业务关键词，再调用 `sellersprite_describe_operation`。不要直接猜测操作名称和参数。

## 数据与认证安全

- 默认 CDP 模式不把 Cookie、扩展 Token 或 UUID 写入项目文件；
- 调试端口应只监听本机，不要向局域网或公网开放；
- 备用文件模式中的 `session.json`、`extension-state.json`、`.env` 和日志文件均被忽略；
- `sellersprite_session_status` 只报告状态，不返回认证值。
