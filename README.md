# SellerSprite MCP

[简体中文](README.md) | [English](README.en.md)

让 AI 助手通过 MCP 查询卖家精灵的产品、关键词、流量、市场和评论数据，返回结构化结果。

**第一次使用，只需完成：安装 → 添加 MCP → 登录 → 查询。** MCP 在你的电脑上运行，使用专用浏览器里的卖家精灵登录态；不需要部署服务器，也不需要填写卖家精灵 API Key。可查询的数据仍取决于账号权限、数据是否已采集及上游接口状态。

## 文档导航

| 你要做什么 | 从这里开始 |
| --- | --- |
| 第一次安装并使用 | 下方「快速开始」 |
| 不知道怎么向 AI 提问 | [查询示例](#查询示例) |
| 找不到命令、登录失败、切换端口或浏览器 | [配置与排错](docs/configuration.md) |
| 从源码运行、测试或维护项目 | [开发指南](docs/development.md) |
| 查某个操作的完整参数 | 让 AI 调用 `sellersprite_describe_operation`，或查看 [操作目录](data/operations.json) |

## 快速开始

### 1. 安装到本机

先准备：

- [Node.js](https://nodejs.org/) 22 或更新版本（包含 npm）。
- [Git](https://git-scm.com/downloads)，供 npm 从 GitHub 安装。
- Chrome、Edge、Brave 或 Chromium 浏览器。
- 卖家精灵账号，以及支持**本地 STDIO MCP** 的 AI 客户端。

在 Windows PowerShell 或 macOS / Linux 终端执行：

```sh
node --version
npm --version
git --version
npm install -g git+https://github.com/JieXi-11/SellerSprite.git
npm list -g sellersprite-mcp --depth=0
```

**检查结果：** Node 版本至少为 `v22`，最后一条命令列出 `sellersprite-mcp`。安装完成后重启 AI 客户端，让它读取更新后的命令路径。

这条安装路线不需要克隆仓库，也不需要执行 `npm start`。安装失败或客户端找不到命令时，见[启动问题](docs/configuration.md#启动问题)。

### 2. 在 AI 客户端添加 MCP

下面三种方式**任选一种**，不要重复添加同名服务。

#### 方式 A：客户端有 MCP 配置表单

| 字段 | 填写内容 |
| --- | --- |
| 名称 | `sellersprite` |
| 类型 / 传输方式 | `STDIO`（本地命令） |
| 启动命令 | `sellersprite-mcp` |
| 参数 | 留空 |
| 环境变量 | 键：`SELLERSPRITE_CDP_URL`；值：`http://127.0.0.1:9222` |

`9222` 是本机**浏览器调试端口**，不是远程 MCP 服务地址。不要将它填入 HTTP / SSE 服务地址栏。

#### 方式 B：客户端接受 MCP JSON 配置

把下面配置合并到客户端的 MCP 配置中，保留已经配置的其他服务。配置文件位置由客户端决定。

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

也可复制 [mcp.example.json](mcp.example.json)。JSON 是客户端配置，不能直接粘贴到 PowerShell 中执行。

#### 方式 C：使用已安装的 Codex CLI

```sh
codex mcp add sellersprite --env SELLERSPRITE_CDP_URL=http://127.0.0.1:9222 -- sellersprite-mcp
codex mcp get sellersprite
```

没有 `codex` 命令时，使用方式 A 或 B。客户端配置能力以其版本为准，参见 [Codex MCP 文档](https://developers.openai.com/codex/mcp/)。

**检查结果：** 保存并重新加载 MCP 后，AI 应能调用 `sellersprite_session_status` 和 `sellersprite_login` 等工具。若没有工具，先解决[启动问题](docs/configuration.md#启动问题)，不要反复登录网页。

### 3. 在 MCP 专用浏览器中登录

把下面这句话发给 AI：

```text
使用 SellerSprite MCP 检查登录状态。若尚未就绪，调用
sellersprite_login，waitSeconds 设为 0，打开登录窗口让我登录。
```

在弹出的浏览器里登录卖家精灵，然后对 AI 说：

```text
我已登录，请重新调用 sellersprite_session_status 检查状态。
```

注意这三个区别：

- **专用浏览器与日常浏览器的登录态不共享。** 在原来的浏览器中已登录，不代表 MCP 也已登录。
- **网页与扩展是两套登录态。** 需要关键词反查、销量趋势等扩展功能时，还要在同一个专用浏览器内安装并登录卖家精灵扩展；只用网页功能不必先安装扩展。
- **使用时保持专用浏览器运行。** 登录信息会保存在专用目录，下次可复用；关闭后可让 AI 再次调用登录工具打开。

**检查结果：** `ready: true` 表示已读到网页 Cookie；需要扩展的操作还应检查 `extension.valid: true`。这些是本地凭据检查，不保证账号有权限或上游接口一定成功，见[状态字段说明](docs/configuration.md#状态字段说明)。

Windows 自动启动使用系统默认的 HTTPS 浏览器；如果默认是 Firefox 等不支持的浏览器，请[指定浏览器路径](docs/configuration.md#指定浏览器与配置目录)。

### 4. 发起第一次查询

先用不需要请求卖家精灵数据的功能目录检查工具连接：

```text
调用 sellersprite_list_operations，查找“关键词”相关功能。
```

再发起一个实际查询：

```text
使用 SellerSprite MCP 查询美国站 ASIN B09BF6XJY1 的详情。
先检查登录状态，再查找并阅读 ASIN 详情操作的参数说明，然后查询。
如果返回登录、权限或数据错误，请如实说明，不要编造数据。
```

将示例 ASIN 替换为你的目标商品。返回实际商品数据才说明这次查询成功；返回空结果时先核对站点、ASIN 和账号权限。

## 查询示例

复制后替换站点、ASIN、类目和日期条件；由 AI 先读取操作说明，确认接口支持哪些筛选。

**选品：**

```text
使用 SellerSprite MCP 分析美国站最近可用周期内增长较快的新品。
优先考虑上架三个月内、非季节性产品，排除个护、医疗和小家电。
先检查操作支持的筛选项；返回 ASIN、上架时间、增长指标、统计周期和数据来源。
如果缺少历史对比数据，不要仅凭当前销量判断“快速增长”。
```

**竞品与关键词：**

```text
分析美国站 ASIN B09BF6XJY1 的关键词和流量来源。
先读取关键词反查、流量来源相关操作的说明，检查扩展登录状态。
区分自然流量和广告相关数据，标注数据周期，并提出需要验证的优化方向。
```

**评论痛点：**

```text
读取美国站 ASIN B09BF6XJY1 的低星评论，归纳产品缺陷、使用困难和改进方向。
先读取 review 操作说明。如果账号内没有该 ASIN 的评论分析语料，请告知我先采集。
说明实际读取的页数和评论数量，不要把少量样本当成全部评论。
```

## 工具与功能

服务提供 5 个 MCP 工具，通过操作目录调用 40 项已映射功能。目录中的验证记录反映历史验证结果，不代表本次安装已完成全部在线验证。

| 工具 | 用途 |
| --- | --- |
| `sellersprite_session_status` | 检查网页 Cookie 和扩展凭据是否可读取 |
| `sellersprite_login` | 打开专用浏览器登录页，可等待用户登录 |
| `sellersprite_list_operations` | 按名称、用途等查找操作 |
| `sellersprite_describe_operation` | 查看参数、默认值、认证要求和前置条件 |
| `sellersprite_call` | 执行操作，返回结构化数据 |

推荐顺序：`session_status → 按需 login → list_operations → describe_operation → call`。

主要功能包括产品研究、竞品查询、ASIN 详情与趋势、关键词反查与挖掘、关联流量、ABA、市场集中度与分布、评论筛选。完整参数以 [data/operations.json](data/operations.json) 和工具返回的 `tool_input` 为准。

## 更新与日常使用

日常使用直接打开 AI 客户端，检查登录状态后查询，无需重复安装。更新时执行：

```sh
npm install -g git+https://github.com/JieXi-11/SellerSprite.git
```

然后重启 MCP 服务或 AI 客户端。正常更新不会删除专用浏览器目录中的登录信息。

账号密码只在卖家精灵网页或扩展中输入，不要发送给 AI。默认模式不把 Cookie、扩展 Token 写入项目文件，但登录信息会保存在专用浏览器目录中；请勿分享该目录，也不要将浏览器调试端口开放到公网。
