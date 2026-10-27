# 配置与排错

[返回首页](../README.md) | [English](configuration.en.md) | [开发指南](development.md)

首次使用请先完成首页四步。本文供启动失败、登录异常或需要自定义配置时查阅。

## 启动问题

| 现象 | 检查与处理 |
| --- | --- |
| 找不到 `node`、`npm` 或 `git` | 安装对应程序，重开终端，确认版本命令成功；Node 至少为 22 |
| PowerShell 提示禁止运行 `npm.ps1` | 使用 `npm.cmd` 执行同一条 npm 命令，不必为安装修改全局执行策略 |
| npm 安装报 GitHub 连接错误 | 检查本机网络能否访问仓库；用 `git ls-remote https://github.com/JieXi-11/SellerSprite.git HEAD` 检查 Git 访问 |
| npm 安装报权限错误 | 检查 npm 全局安装目录的写权限，使用当前用户可写的 Node/npm 安装；不要直接给整个系统目录放宽权限 |
| 终端能找到命令，AI 客户端找不到 | 重启客户端；仍失败则使用下方 Node 和脚本的绝对路径配置 |
| Windows 无法启动 `sellersprite-mcp` | 部分客户端支持 `sellersprite-mcp.cmd`；若仍失败，使用下方绝对路径方式，避免依赖 `.cmd` 启动支持 |
| 手动运行命令后空白、像是卡住 | 正常：这是 STDIO 服务，等待 MCP 客户端发送消息，不会打开网页或显示 HTTP 地址；用 Ctrl+C 结束，交给客户端启动 |
| 只看到了 Skill，没有 MCP 工具 | 检查 MCP 是否已配置并成功启动，查看客户端启动错误；检查是否启用了重复或旧配置，再重新加载。Skill 出现不等于服务启动成功 |

### 用绝对路径启动

当图形客户端拿不到终端的 PATH，或 Windows 无法执行 npm 命令包装器时，直接指定 Node 和服务脚本。

Windows PowerShell：

```powershell
(Get-Command node.exe).Source
npm.cmd root -g
```

macOS / Linux：

```sh
command -v node
npm root -g
```

将第一条输出作为 `command`；第二条输出后拼接 `/sellersprite-mcp/src/server.mjs` 作为唯一参数。下面是 Windows **示意配置**，请替换成刚查出的真实路径：

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

JSON 中 Windows 路径可以用 `/`，也可以用转义的 `\\`。`command` 只填可执行文件，参数单独填写；不要将整条终端命令塞进 `command`。

## 状态字段说明

`sellersprite_session_status` 不会向卖家精灵发起完整的业务权限验证。

| 字段 | 当前实现中的含义 |
| --- | --- |
| `ready` / `web.valid` | CDP 可读到至少一个未按本地到期时间过滤掉的卖家精灵 Cookie；不保证远端仍接受登录 |
| `connected` | 当前代码在成功读取网页 Cookie 后才设为 `true`；`false` 不能单独证明调试端口没启动 |
| `extension.valid` | 已读到扩展 Token 和 UUID；不保证远端接受或账号有对应功能权限 |
| `web.error` / `extension.error` | 对应凭据读取失败的原因 |
| `operationCount` | 当前目录包含的操作数量 |

`ready: true`、`extension.valid: false` 时，网页操作可以继续尝试；`authentication` 为 `extension` 或 `mixed` 的操作还需要扩展。当前服务在执行所有业务操作前都读取网页 Cookie，所以扩展操作也需要网页登录态。

## 登录与查询问题

| 现象 | 处理 |
| --- | --- |
| 普通浏览器已登录，MCP 仍未就绪 | 登录工具使用独立配置目录；请在它打开的专用窗口内登录 |
| 没有弹出浏览器，提示不支持默认浏览器 | Windows 默认浏览器可能不是 Chromium；设置 `SELLERSPRITE_BROWSER_PATH` 后重启 MCP |
| `Browser CDP did not start` | 确认路径和端口正确；退出使用同一专用目录的浏览器后重开，避免旧进程未启用调试端口 |
| `No SellerSprite cookies found` | 已连上浏览器但未读到卖家精灵 Cookie；在该配置目录的浏览器中登录 |
| 等待登录超过客户端时限 | 使用 `sellersprite_login` 的 `waitSeconds: 0`，自行登录后再检查状态 |
| `extension.valid: false` | 在同一专用浏览器内安装卖家精灵扩展，打开扩展并登录，再检查状态 |
| 状态正常但接口提示登录失效 | 在专用浏览器重新登录；下一次调用自动读取新凭据 |
| 接口提示权限不足 | 在卖家精灵网页确认该账号能使用相同功能；MCP 不会增加会员权限 |
| 评论列表为空 | 先在该账号的评论分析页面采集对应 ASIN，随后再调用 `review`；核对站点及筛选条件 |
| 请求超时或结果过大 | 先缩小分页和查询范围；必要时调整下方超时/输出限制，同时检查客户端自身的工具超时 |

### 检查浏览器调试端口

Windows PowerShell：

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json/version
```

macOS / Linux：

```sh
curl --fail http://127.0.0.1:9222/json/version
```

返回包含 `webSocketDebuggerUrl` 的 JSON，说明浏览器调试服务可访问，**不代表已登录卖家精灵**。不要公开分享完整的调试连接地址。

## 环境变量

这些变量应填写在 MCP 客户端的服务器配置中；修改后重启 MCP。在终端临时设置变量，不会自动改变已经启动的图形客户端环境。

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `SELLERSPRITE_CDP_URL` | `http://127.0.0.1:9222` | 本机浏览器调试地址 |
| `SELLERSPRITE_BROWSER_PATH` | 自动选择 | 浏览器可执行文件的绝对路径 |
| `SELLERSPRITE_BROWSER_PROFILE` | 见下表 | 登录浏览器的持久化配置目录 |
| `SELLERSPRITE_CALL_TIMEOUT_MS` | `120000` | 适配器子进程执行时限，毫秒；不包含前置 CDP 读取，也不覆盖客户端自身时限 |
| `SELLERSPRITE_MAX_OUTPUT_BYTES` | `20971520` | 适配器标准输出上限，20 MiB |

`sellersprite_login` 的 `waitSeconds` 是工具参数，不是环境变量：默认 `180`，允许 `0–300`。`0` 表示打开窗口后不继续等待登录；浏览器启动和连接本身仍需要时间。

### 指定浏览器与配置目录

自动选择规则：Windows 读取默认 HTTPS 浏览器并检查是否支持 CDP；macOS 按 Chrome、Edge、Brave、Chromium 顺序检查 `/Applications`；Linux 先尝试默认桌面浏览器，再搜索 PATH。

需要覆盖时，在 MCP 的 `env` 中加入 `SELLERSPRITE_BROWSER_PATH`。例如 Windows Chrome 常见路径是 `C:/Program Files/Google/Chrome/Application/chrome.exe`，请先确认文件实际存在。不要在路径值中附带启动参数。

| 系统 | 默认专用配置目录 |
| --- | --- |
| Windows | `%LOCALAPPDATA%\SellerSpriteMCP\Chrome` |
| macOS | `$HOME/Library/Application Support/SellerSpriteMCP/Chrome` |
| Linux | `${XDG_CONFIG_HOME:-$HOME/.config}/sellersprite-mcp/chrome` |

自定义目录时使用绝对路径。上表的变量是目录说明；不要假定客户端会展开 JSON 值里的 `$HOME`、`~` 或 `%LOCALAPPDATA%`。

如果配置的 CDP 地址已有浏览器可访问，登录工具会复用它，不会重新启动浏览器；此时修改浏览器路径或配置目录不会切换现有连接。

### 手动启动浏览器（可选）

只有自动启动失败或需要自行管理浏览器时才用。先退出使用同一专用配置目录的浏览器；以下 Chrome 路径需与你的安装位置一致。

Windows PowerShell：

```powershell
$chromePath = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$sellerSpriteProfile = "$env:LOCALAPPDATA\SellerSpriteMCP\Chrome"
& $chromePath --remote-debugging-port=9222 --user-data-dir=$sellerSpriteProfile https://www.sellersprite.com/w/user/login
```

macOS：

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/SellerSpriteMCP/Chrome" \
  https://www.sellersprite.com/w/user/login
```

Linux（需要图形桌面）：

```sh
google-chrome --remote-debugging-port=9222 \
  --user-data-dir="${XDG_CONFIG_HOME:-$HOME/.config}/sellersprite-mcp/chrome" \
  https://www.sellersprite.com/w/user/login
```

换端口时，同时修改浏览器的 `--remote-debugging-port` 和 MCP 的 `SELLERSPRITE_CDP_URL`，例如 `9333` 与 `http://127.0.0.1:9333`。本入门流程仅面向本机浏览器。

## 提交问题时附什么

提供操作系统、Node 版本、安装方式、客户端名称、失败步骤、脱敏后的错误信息，以及操作名称和业务参数。不要提供密码、Cookie、Token 或浏览器配置目录。目录里保留的历史验证结果不能代替本次错误信息。
