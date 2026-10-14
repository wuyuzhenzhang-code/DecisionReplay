# 接手复核（2026-10-14T19:10:32.718Z）

本次生产 V5 强制真实历史日线连接测试成功：2026-10-14T19:05:42.802Z，返回 3 条，request ID f224e0d566574fc7bfe2a143706db39a。该请求绕过应用缓存，仅用于环境诊断，不计作修复版验收；不分发原始价格响应。生产两项 Secret 保留，运行时配置均为 true。

Git 官方源码助手仍在 HTTPS 认证前连接失败；新部署未执行，最终结论 B。详见 FINAL_ACCEPTANCE.md、DELIVERY_DIAGNOSTICS.json 和 HANDOFF.md。

---

## 较早验收与说明（保留原时间和版本）

# 本次修复环境状态

记录时间 2026-10-14T18:48:06.873Z。保留既有生产 OpenAI 与扶摇凭据，未重新创建或修改。当前本地服务 GET /api/replay 显示 aiConfigured=false、marketConfigured=true；扶摇实际请求 503/network。不能据此否定旧生产授权，也不能宣称本次成功。当前环境无法连接 Sites Git；发布与新版线上复验受阻。详见 FINAL_ACCEPTANCE.md。

---

# 历史配置说明（当前状态以上文为准）

# 扶摇真实行情配置
当前：2026-10-14 已完成官方登录、专用密钥签发、本地私密环境配置及 Sites 服务端 Secret 配置（修订 4）。本地与生产均独立取得 3 条有效日线并完成价格对照与真实 AI 复盘，详见 [LIVE_MARKET_ACCEPTANCE.md](LIVE_MARKET_ACCEPTANCE.md)。已有 OpenAI Secret 保留，无需重建。以下步骤供日后轮换或重建使用。

## 1. 官方登录与权限
打开 [API Key 管理](https://fuyao.aicubes.cn/admin/) 完成本人登录。核对 A 股历史日线 GET /api/a-share/prices/historical 权限、日期覆盖、频率/额度、更新时间和公开站点展示许可。登录不等于接口授权。
参考 [快速开始](https://fuyao.aicubes.cn/docs/quickstart/) 和 [行情文档](https://fuyao.aicubes.cn/docs/api-reference/prices/)。公开资料描述最长十年窗口与动态限流，但不能确定本账户固定 QPS、费用或展示许可；如需开通，以官方缺失权限与报价为准，本次未自动购买。

## 2. 安全配置
在官方页创建或使用已有密钥，不要发到聊天、截图或导出文件。
- 本地：源码根目录 .env.local 添加 FUYAO_API_KEY=实际密钥。用 node --env-file=.env.local scripts/run-framework.mjs dev 启动并重启已有服务。原模型密钥在另一已批准文件时，可用两个 --env-file 参数分别加载，不必复制模型密钥。
- 线上：当前 Decision Replay 的 Sites 设置 → 环境变量，加入 FUYAO_API_KEY，标记 Secret/机密，保存后重新发布。代码从 cloudflare:workers 的 env.FUYAO_API_KEY 读取；仅保存变量不代表现有 Worker 已更新。
.env.local、.dev.vars、Wrangler 私密状态均排除入库；仅 .env.example 保留变量和占位符。禁止 NEXT_PUBLIC_* 或浏览器存储密钥。

## 3. 分别验证本地与生产
1. 初始应显示“已配置，待验证”。点击“测试连接”，查询 600000.SH / 2025-02-05 至 02-07，只有非空有效结果才算验证成功；记录条数和请求编号。
2. 新建/选择自己的非合成单证券案例，确认日期，获取真实历史行情。数据表逐点核对日期、收盘、单位、日线、不复权及发生/可用/获取时间。
3. 切换事前/事后，确认未来价格不影响事前图表、坐标、指标与 AI；盈亏仍用用户成交和费用。
4. 同一区间再获取，证据数量稳定；生成复盘、检查引用、导出 JSON/Markdown 核对来源。
无权限去官方申请；失效更新 Secret 并重新发布；限流等待并核对额度；空区间核对停牌、非交易日及覆盖。不得使用假数据冒充成功。
以上私密输入由所有者完成，无需把明文贴到聊天。完成官方登录后可继续由 Codex 检查非秘密状态并执行验收。

