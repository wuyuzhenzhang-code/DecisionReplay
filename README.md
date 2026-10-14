# Decision Replay｜投资决策复盘工作台

第 2 题「投资决策复盘与学习」。面向希望改善历史决策过程的个人投资者。

产品聚焦一个 A 股标的、一次买入及可选的一次全部卖出；以可复用清单完成学习闭环，避免在短时 MVP 中堆叠券商、监控与复杂研究功能。

## 当前交付状态与源码

- 产品 URL：https://decision-replay-lab-1013.wuyuzhenzhang.chatgpt.site/
- 现有开发仓库（需认证的 Git 端点）：https://git.chatgpt-team.site/a09fd4fe-9b8a-4e7a-8294-7be0308c8b27/appgprj_6aceccd0685481919c19f66332747a68.git
- 开发者访问：当前账户具备 Sites owner 权限，已获得短期仓库写入授权；本执行环境连接 Git HTTPS 失败，未完成本轮远程读写。
- 公开评审仓库：https://github.com/wuyuzhenzhang-code/DecisionReplay，用户于本轮明确授权创建并公开；GitHub 页面已显示 Public，官方连接器返回 pull/push 权限。无需向评审提供开发者令牌。最终上传提交及逐文件树一致性以提交包 RELEASE_MANIFEST.json 为准。公开原文读取已通过不含凭据的 raw.githubusercontent.com URL 实测；未进行另一台机器的登出主页测试。
- 最终功能代码提交：`6db3146227f107fab2b3392172fcef26185c01ec`（main，本地已提交，未推送）。业务代码保持不变；本次交接文档单独提交。提交包 RELEASE_MANIFEST.json 给出最终归档提交 SHA（避免文档自引用提交哈希）。
- 线上仍为 V5：`eedc86e6b032f2322948ba1e944dca6e33a97ca7`，部署 `appgdep_6acfc0b9190c8191bf4ed1a7365471da`。**本次修复尚未部署**。

接手复核时间 2026-10-14T19:10:32.718Z：重新运行 64 项测试、类型检查和生产构建，全部通过；本地清单流程与 JSON 下载再导入已验证。修复版部署和真实模型复验仍未完成；公开评审入口本轮已创建，**不能宣称已经达到全部提交条件**。详见 [FINAL_ACCEPTANCE.md](FINAL_ACCEPTANCE.md)；恢复现有 Git 历史、发布顺序及最少需补充的信息见 [HANDOFF.md](HANDOFF.md)。

## 六步体验

加载示例 / 新建 / 导入 → 补充原始理由与事件 → 选择节点与事前/事后视角 → 生成复盘并点开依据 → 编辑保存学习清单 → 用于下一次决策并导出。

## 启动

要求 Node.js 22.13+（建议 Node.js 24）和 pnpm 11.25。使用版本锁定文件安装。

```sh
pnpm install --frozen-lockfile
# 在项目目录创建仅供服务端读取的 .env.local，变量名见 .env.example
node --env-file=.env.local scripts/run-framework.mjs dev
```

没有模型凭据也可以启动：`pnpm dev`，界面明确显示未配置，规则演示可运行。

环境变量：`OPENAI_API_KEY`（真实 AI）、`OPENAI_MODEL`（默认 gpt-5-mini）、`FUYAO_API_KEY`（真实历史日线）。全部仅供服务端使用，不填入浏览器，不提交 `.env.local`。

## 架构与分工

- React / TypeScript + Vinext，保留 Sites Cloudflare Worker 构建集成；服务端 API 为 `/api/replay` 与 `/api/market`。
- `lib/replay.ts`：交易与证据校验、计算、CSV、时点筛选、报告校验、导出。
- `lib/adapters.ts`：扶摇契约、HTTP/业务错误、空数据与字段变化处理。
- `lib/market-service.ts`：凭证配置与接口验证分离，15 分钟缓存、并发去重、失效凭证清缓存。
- `components/market-panel.tsx`：行情连接状态、日期区间、配置说明、测试与取数操作。
- `lib/chart.ts` / `components/price-chart.tsx`：先按视角筛选，再计算图表范围；交易日等距与自然日间距、原始证据、数据表及放大视图。
- `lib/ai.ts`：Responses API 真实模型调用、结构化输出、最多一次校验失败重生成。
- `app/api/replay/route.ts`：大小限制、同源与频率保护、服务端重新构建模型上下文。
- 浏览器：案例、理由版本、备注、清单、最新报告本地保存。清单保留 formedAt/carriedAt/contentUpdatedAt、来源案例/视角；当前学习管理与历史事前资格分开。复制不重置形成时间，缺时旧数据不自动历史放行；originalCaseId 保留导入前身份。修改案例会增加版本并使旧报告过期；清单保留来源结论摘录；切换案例或视角会中止请求并避免串写。

代码负责数值和时间，AI 负责有证据约束的语言分析。真实 AI 与规则演示有独立按钮和输出标签，不静默降级。追问继续使用相同的时点筛选与证据集合。

## 时间隔离与数据

默认 Asia/Shanghai / CNY。事前模型输入不含未来交易、排除事件、事后回忆、案例标题或备注。只有日期的同日资料保守排除。时间边界为所选交易节点（含该节点的成交记录）。原始理由与后续版本保留记录时间和系统保存时间；用户声明“当时记录”不代表已经核验。

示例全部合成。真实行情使用扶摇 REST，明确请求不复权；修复前 V5 在 2026-10-14 的本地与生产环境已独立完成真实取数、价格对照及事前/事后真实 AI 复盘；本次修复版尚未完成这些真实复验，详见 [LIVE_MARKET_ACCEPTANCE.md](LIVE_MARKET_ACCEPTANCE.md)。用户证据导入一律标记未核验。iFinD 未接通，不编造新闻。详细来源、单位、费用与历史修订限制见 [DATA_AND_LIMITATIONS.md](DATA_AND_LIMITATIONS.md)。

## 异常与边界

费用缺失阻止净收益，除非用户显式选择不含费用。部分卖出、多证券、多批交易、先卖后买、负值与无效日期有错误提示。未知或已发生公司行动不计算收益。未卖出不展示已实现盈亏，也不猜估值。权限不足、限流、超时、空数据、字段变化、无效模型 JSON、非法引用均显式失败，保留已有证据。

重要结论带 evidence_ids、fact/inference/uncertain 和原始片段支持关系；服务器逐字核验片段，并按有限原文权限重建动机、权重、心理与因果判断。数字与公式说明由代码控制。一般语义、证据真实性和因果仍需人工抽查。禁止确定性预测、收益承诺或买卖指令；产品没有下单能力。

持久化仅限当前浏览器；清除浏览器数据会丢失案例。分析时当前允许证据会发送至服务端和 OpenAI。导出 JSON 可重新导入；报告需重新生成以避免伪造验证结果。建议使用匿名案例。

## 测试、构建与部署

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm build
# 先启动本地服务；此项会真实调用模型并产生正常 API 用量
node --experimental-strip-types scripts/live-check.mjs
```

`pnpm build` 产出 `dist/client` 和 `dist/server`。Sites 部署必须保留 `.openai/hosting.json` 中的项目 ID，通过 Sites 官方源代码同步与发布流程推送同一份源码并上传构建归档。生产密钥应通过 Sites 的服务端 secret 设置配置，不能打进归档。

既有 OPENAI_API_KEY 保留。FUYAO_API_KEY 已保存到被忽略的本地私密环境文件与 Sites 服务端 Secret；修复前 V5 本地及线上实际接口验收均通过；本轮本地行情网络失败、AI 未配置，生产尚未更新。配置存在不等于接口已验证，界面仍由后端实际请求判定状态。站点持链接访问，现有 Git 地址仍是认证端点。详见 [MARKET_SETUP.md](MARKET_SETUP.md)。

新版参考 [TradeZella](https://www.tradezella.com/) 的深色导航、紫色强调、卡片留白与分析优先层级，保留本项目的中文复盘流程、事前隔离和证据追踪，没有复制其商标或页面资源。详细设计取舍见 [UI_UX_CHANGES.md](UI_UX_CHANGES.md)。

自动测试、浏览器验证、实际模型与上线结果见 [TEST_REPORT.md](TEST_REPORT.md)。AI 使用与具体修正见 [AI_USAGE_AND_VALIDATION.md](AI_USAGE_AND_VALIDATION.md)。约两分钟中文演示脚本见 [DEMO_SCRIPT.md](DEMO_SCRIPT.md)。未录制视频。

## 未做事项

后台提醒、券商/交易接入、新闻搜索、分批成本、做空衍生品、复杂公司行动、云同步、企业级身份和跨实例限流、绝对无未来信息保证、视频录制。行情账户的固定额度、全部覆盖与再展示许可尚未确认；已实测能力仅为历史日线。实际交付未完成项以最新验收报告为准。

本轮生产诊断：V5 的 GET /api/replay 报告两个服务均已配置；2026-10-14T19:05:42.802Z 强制真实历史日线查询成功返回 3 条。这仅定位环境差异，不计入修复版通过；本轮未额外调用旧版模型。Git 同步仍在 HTTP 认证前连接失败，未保存或部署新版。

## 公开评审与连接诊断更新（2026-10-14T19:34:31.731Z）

公开仓库是经过扫描的源码快照；原 Sites 仓库及其历史保留，增量 bundle 可恢复原历史。GitHub 快照的提交 SHA 与 Sites 本地提交 SHA 不同，内容树需一致，二者映射记录在交付清单。业务代码仍为 6db3146227f107fab2b3392172fcef26185c01ec，未因网络故障修改业务逻辑。

当前命令运行于用户的本地 Windows Work Mode 执行进程。DNS 成功，TCP connect 返回 EACCES（Git 域名 4 ms；GitHub 1 ms）；使用新短期凭据的 Sites 官方只读 ls-remote 退出 1，连接失败 74 ms，尚未进入 TLS/HTTP/认证。当前任务明确 network restricted，且 sandbox 审批关闭；这不否定账号联网开关已开启。没有修改网络策略、代理、证书校验或凭据。详见 [CONNECTIVITY_ACCEPTANCE.md](CONNECTIVITY_ACCEPTANCE.md)。

连接器写入实测：create_tree 返回 HTTP 403 / Resource not accessible by integration。账户元数据中的 push=true 不能证明集成具有写入授权。已通过同一账号的 GitHub 官方上传页面提交源码，未创建令牌或扩大连接器权限。最终全量文件核对与提交映射以 RELEASE_MANIFEST.json 为准。

公开原文读取记录（2026-10-14T19:43:50.661Z）：https://raw.githubusercontent.com/wuyuzhenzhang-code/DecisionReplay/refs/heads/main/lib/grounding.ts 实际显示本次 grounding 校验源码，未传入令牌、密码或带凭据的 URL。此结果与已登录 GitHub 主站访问分开记录；检索通道 DisabledError 仅是该检索通道失败。
