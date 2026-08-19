# dsh-route-resilience

面向 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）的多路由高可用、故障隔离与可观测插件。

**让一个 provider 路由宕机时，agent 照常工作。** `dsh-route-resilience` 把您已有的 provider 路由组织成模型组，把请求分摊到健康的路由上；一旦某个路由劣化，立即故障切换到下一个路由——对不稳定路由做指数退避隔离、对彻底失效的凭据做永久禁用——全程不触碰任何 API 密钥原文。

> **English docs: [README.md](./README.md)**

## 定位与口径

`dsh-route-resilience` 是**可靠性层**，不是配额绕过工具。

- 它**不**绕过任何配额、速率限制或公平使用限制。
- 它**不**支持通过多账号、多身份规避服务商的限制。
- 它只使用**用户有权使用的凭据与路由**。每个路由仍受其所属服务商条款约束；一个模型能服务多少请求由服务商决定，而非本插件决定。
- 它从不读取、写入或暴露密钥原文——只按名称引用 provider 路由。

价值在于**连续性**：当您合法使用的某个路由遇到 429、超时或失去授权时，模型改由您已有的另一个路由继续服务，而不是让整轮对话失败。

## 功能

- **模型组** —— 将服务于同一模型的多个 provider 路由组织在某一个虚拟 provider 名下，并按路由独立调优隔离参数。
- **轮询分配（round-robin）** —— 新请求在活动组的健康路由间均匀分配；请求在其 step 生命周期内固定到所选路由，保证中途重试落在同一 provider 上。
- **可重试故障切换** —— 遇到匹配的错误码（`RATE_LIMIT`、超时、传输、空响应……）时，step 前进到下一个路由，同时保持下游重试策略原有优先级。
- **429 / Retry-After 处理** —— 被限流的路由按服务商下发的 `Retry-After` 隔离（可用时），否则按指数退避（`base · 2ⁿ⁻¹`，有上限）隔离，到期后惰性恢复。
- **鉴权 / 配额隔离** —— 401/402/403 以及 auth/quota 类错误码会永久禁用对应路由，坏凭据不会污染整个组。
- **兜底** —— 链尾路由是自动安全网；全部路由不可用时强制唤醒最早到期的一条隔离，让真实错误清晰浮现而不是死锁。
- **可观测性** —— 只读状态端点（`/api/dsh-route-resilience/status`）以及持久化的 `llm/failover`、`llm/key-status` 会话事件。
- **Web 设置面板** —— Models 设置页内置 UI，可视化管理组、密钥与隔离参数，实时显示健康徽标（免重启生效）。

## 运行要求

- DeepSeek Harness `>= 0.1.0-rc.5`（已发布到 npm）、Cordis `>= 4.0.1`
- 作为**纯插件**运行——无需修改任何 DSH 核心源码。它只挂接标准扩展点：Agent Loop 事件（`agent/request`、`agent/request-error`、`agent/turn-stopping`）、设置服务、host web server、会话事件与客户端 UI slots。

## 安装

`dsh-route-resilience` 是标准的 DSH 插件，接线方式与克隆或安装的任何插件一致：

### 源码安装（当前推荐）

```bash
# 1. 克隆到 DSH plugins 目录
git clone https://github.com/lokic7123-star/dsh-route-resilience.git \
  /path/to/deepseek-harness-desktop/plugins/dsh-route-resilience

# 2. 在使用的 profile（如 ~/.dsh/profiles/web/package.json）中，
#    把 "dsh-route-resilience" 加入 dsh.profile.bundles，并添加 link: 依赖：
#      "dsh-route-resilience": "link:/path/to/deepseek-harness-desktop/plugins/dsh-route-resilience"
```

或在 DSH 仓库根目录用脚手架接线：

```powershell
.\new-plugin.ps1 -Target dsh -Name route-resilience   # 自动配置 bundles、link、Junction 与 runtime 闭包
```

### npm 安装（发布后可用）

```bash
npm install dsh-route-resilience
```

## 配置

### 设置命名空间

插件从 `dsh-route-resilience` 设置命名空间读取配置（保存即热更新，无需重启）：

```jsonc
{
  "groups": [
    {
      "id": "deepseek",          // 虚拟 provider 名，即 activeGroup
      "targets": [
        { "provider": "opencode-go-1", "model": "deepseek-chat" },
        { "provider": "opencode-go-2", "model": "deepseek-chat" }
      ],
      "retryableCodes": ["RATE_LIMIT", "TIMEOUT", "TRANSPORT"],
      "quarantineBaseMs": 60000,   // 可选，默认 60000
      "quarantineCapMs": 300000    // 可选，默认 300000
    }
  ],
  "activeGroup": "deepseek"       // 可选；未设置则直通
}
```

- 每个 `target.provider` 必须指向您的 provider 适配器（如 `llm-pi-ai`）中已配置的具体路由，且各路由持有各自的凭据引用。本插件只替换 `provider`/`model`，从不管理密钥。
- `retryableCodes` 默认值：`EMPTY_RESPONSE, RATE_LIMIT, SERVER, TIMEOUT, TRANSPORT`。
- `activeGroup` 未设置时插件以空闲状态安装，请求路由原样直通。

### Web UI

Models 设置页底部会注入一个 **路由韧性** 面板：实时显示健康状况（活跃 / 隔离中 / 已禁用，带恢复倒计时与链尾兜底标记），并支持添加、删除密钥、编辑组、错误码与隔离参数。添加密钥会新建一个绑定全新凭据引用的 provider 路由，密钥值在保存时写入凭据服务。

## 工作原理

### 路由

1. `agent/request` 时，`provider` 等于 `activeGroup` 的配置被解析到组内下一个健康路由（基于每组的轮询指针做 round-robin）；其余请求原样直通。
2. 所选路由在 step 生命周期内固定（`WeakMap<Agent, Map<turn/step, target>>`），保证在途重试落在同一 provider。
3. `agent/request-error` 时，先让下游重试策略决定；若其放弃，匹配的错误码把 step 切换到下一个路由（记录 `llm/failover` 事件）并返回重试。

### 健康状态机

| 路由状态 | 进入条件 | 恢复方式 |
| --- | --- | --- |
| `active` | 健康 / 恢复 | — |
| `quarantined` | `RATE_LIMIT` / HTTP 429 | 退避（或 `Retry-After`）到期后惰性恢复 |
| `disabled` | `AUTH` / `INVALID_CREDENTIAL` / `QUOTA` / HTTP 401·402·403 | 永不（仅重新配置或组清理可恢复） |

`pickStart` 会跳过不健康的路由；若全组都不健康，强制唤醒最早到期的一条隔离路由以维持服务；若全部被禁用，则使用第一个目标，让其真实错误自然浮现，而不是无限循环。

### 安全边界

- host 端从不读写密钥原文；健康与状态只暴露**路由名与状态**。
- 状态端点为只读，与服务端 UI 同源，远程浏览器由 host 的信任围栏隔离在 `/api/` 之外。
- 密钥值的跨边界点全插件仅一处：面板的"新密钥"输入框，写入凭据服务。

### 可观测性

- `GET /api/dsh-route-resilience/status` → `{ ok, data: { activeGroup, groups, health[], rotation, settingsRegistered } }`
- 会话事件：`llm/failover`（step 切换路由）与 `llm/key-status`（路由隔离 / 禁用 / 恢复），通过标准会话 API 追加。

## 开发

需要 Node `>= 20` 与任一包管理器（CI 使用 npm）。

```bash
npm install        # 安装构建工具 + 编译所需的 @deepseek-ai/* 包
npm run build      # host 端 tsc 编译（lib/index.js）+ client 端 tsdown 打包（lib/client.js）
npm test           # 路由器单元测试（node --import tsx --test tests/router.test.ts）
```

- 每次 push / PR，CI 都会运行构建、测试与 `npm audit`（见 `.github/workflows/`）。
- 项目自包含：编译与测试针对 npm 上公开发布的 `@deepseek-ai/*` 包，开发无需整个 DSH monorepo。

## 参与贡献

欢迎贡献，详见 [CONTRIBUTING.md](./CONTRIBUTING.md) 与[行为准则](./CODE_OF_CONDUCT.md)。

## 安全

发现漏洞？请私密上报，见 [SECURITY.md](./SECURITY.md)。

## 许可证

[MIT](./LICENSE)
