# 开发指南

[返回首页](../README.md) | [English](development.en.md) | [配置与排错](configuration.md)

本文用于修改源码或运行测试。只想使用 MCP 时，按首页全局安装即可，无需再走这条路线。

## 从源码运行

需要 Node.js 22+ 和 Git。项目没有运行时 npm 依赖，无需先执行 `npm install`。

```sh
git clone https://github.com/JieXi-11/SellerSprite.git
cd SellerSprite
npm run check
node --test test/protocol.test.mjs test/portability.test.mjs
```

在 MCP 客户端中，将 `command` 设为 Node 的绝对路径，`args` 设为仓库内 `src/server.mjs` 的绝对路径。例如：

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

替换两个占位路径；Windows 路径写法见[配置指南](configuration.md#用绝对路径启动)。服务不依赖客户端工作目录，`scripts/start-mcp.mjs` 也可作为启动入口。不要同时启用源码版和同名全局版。

手动运行 `npm start` 或 `node scripts/start-mcp.mjs` 时，服务会等待标准输入中的 MCP JSON-RPC 消息；没有输出不代表启动失败。

## 目录结构

| 路径 | 用途 |
| --- | --- |
| `src/server.mjs` | STDIO 协议、5 个工具、认证读取与调用调度 |
| `src/adapter.mjs` | 业务参数转换、网页与扩展请求 |
| `src/browser-login.mjs` | 浏览器选择、专用目录、打开登录页 |
| `src/cdp-auth.mjs` | CDP 通信、网页 Cookie 与扩展状态读取 |
| `data/operations.json` | 操作目录、参数和历史验证记录 |
| `scripts/start-mcp.mjs` | 可从其他工作目录调用的启动入口 |
| `test/` | 协议、可移植性和可选真实请求测试 |
| `docs/` | 中英文配置与开发说明 |

## 操作参数与调用示例

先通过 `sellersprite_list_operations` 查找操作，再读取 `sellersprite_describe_operation`。注意下列字段：

| 字段 | 含义 |
| --- | --- |
| `authentication` | `web`、`extension` 或 `mixed` 认证要求 |
| `tool_input` | 传给 `sellersprite_call.params` 的业务参数 |
| `web_request` | 适配器实际发送的端点和字段，不直接作为工具输入 |
| `defaults` / `enums` | 默认值和枚举 |
| `precondition` | 语料采集等前置条件 |
| `web_response` | 响应字段说明 |
| `verification` | 历史验证记录，不是实时可用性保证 |

例如，在同一账号已经采集示例 ASIN 的评论语料后，调用 `sellersprite_call`：

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

这是工具参数，不是终端命令。使用 `marketplace`、`page`、`size` 等 `tool_input` 字段，不要混入网页层的 `market`、`pageNum`、`pageSize`。其他操作应单独查阅说明。

## 验证修改

无需登录的检查：

```sh
npm run check
node --test test/protocol.test.mjs test/portability.test.mjs
```

也可执行 `npm test`；它包含真实请求测试文件，但未启用下列开关时在线测试会跳过。若较早的 Node 22 小版本无法展开测试通配符，使用上面的显式文件列表，或升级 Node。

真实请求测试需要本机专用浏览器运行且已登录，可能使用账号查询额度。网页用例依赖账号已采集 `B09BF6XJY1` 的评论语料；扩展用例需要扩展登录。两组开关可分别启用。

Windows PowerShell：

```powershell
$env:SELLERSPRITE_LIVE_TEST = "1"
$env:SELLERSPRITE_LIVE_EXTENSION_TEST = "1"
node --test test/live.test.mjs
Remove-Item Env:SELLERSPRITE_LIVE_TEST, Env:SELLERSPRITE_LIVE_EXTENSION_TEST
```

macOS / Linux：

```sh
SELLERSPRITE_LIVE_TEST=1 SELLERSPRITE_LIVE_EXTENSION_TEST=1 node --test test/live.test.mjs
```

没有登录环境时，应明确报告在线测试未运行，不要将离线测试通过描述为 40 项功能全部验证通过。

修改文档后检查相对链接、示例 JSON 与实际工具参数是否一致，并运行 `npm pack --dry-run` 确认文档随包发布。源码改动不会自动更新另行安装的全局版本；开发时让客户端直接指向本地源码。

## 维护约定

- 接口或参数变化时，同步修改适配器与操作目录；验证记录应注明实际验证范围。
- 安装步骤放首页，自定义设置和故障处理放配置文档，测试放本文；同步中英文版本。
- STDIO 的标准输出只用于协议消息，诊断信息写入标准错误。
- MCP 当前通过 CDP 读取凭据，并将其经子进程环境传给适配器；没有面向用户的 `session.json` / `extension-state.json` 文件登录流程。`.gitignore` 中保留文件名不代表支持这种模式。
- 不提交凭据、浏览器配置目录或带认证信息的日志。
