# 接手复核（2026-10-14T19:10:32.718Z）

本次接手重新运行：64/64（0 失败、0 跳过），TypeScript 与生产构建均退出 0，日志为 evidence/takeover-tests.log、takeover-typecheck.log、takeover-build.log。以下本地浏览器结果对应同一功能 SHA 的较早验收，未重新算作本次线上通过。

Git 官方源码助手仍在 HTTPS 认证前连接失败；新部署未执行，最终结论 B。详见 FINAL_ACCEPTANCE.md、DELIVERY_DIAGNOSTICS.json 和 HANDOFF.md。

---

## 较早验收与说明（保留原时间和版本）

# 测试报告｜当前修复候选版

记录时间：2026-10-14T18:48:06.873Z。功能提交：6db3146227f107fab2b3392172fcef26185c01ec。完整状态以 FINAL_ACCEPTANCE.md 为准；历史记录见 docs/history/V5_TEST_REPORT.md。

## 当前结果

- Windows / Node.js 24.19.0；原项目依赖未变。
- node --experimental-strip-types --test tests/*.test.ts：**64 测试通过，0 失败，0 跳过**；原有 37 + 新增 27。
- node node_modules/typescript/bin/tsc --noEmit：退出 0。
- node scripts/run-framework.mjs build：退出 0，产出 Sites Worker/client；路由静态分类提示是框架警告，不代表线上已验收。
- git diff --check：通过。

## 分类与区分

确定性测试覆盖净盈亏、未来证据排除、片段来源、语义权限、繁简转换、清单形成/带入/修改时间、导入身份与 JSON 往返。模拟外部接口覆盖 HTTP/业务错误、超时、重试、缓存与虚假引用；新增两项明确注入 fake fetch 的模拟模型测试覆盖 analyze 整条管线。这些都不计作真实模型抽查。

本地 HTTP 200；规则接口事前和事后分别 200、validateReport 无错误。真实行情尝试 503/network；真实 AI 尝试 503/not_configured，未向 OpenAI 发送实际模型请求。原始失败句专用脚本同样在配置门禁停止。

## 本地浏览器实际操作

- 规则事后复盘→编辑清单→新案例弹窗展示全文及原形成时间：通过。
- 当前案例事后形成三项：历史事前零项：通过。
- 构造导入案例三项：早于决策形成/带入项显示一项；晚期和旧缺时间两项排除：通过。
- 当前学习管理保留全部三项：通过。
- 勾选→刷新恢复→导出 JSON 实际下载到文件→解析→再导入仍显示原早期项及勾选：通过。
- 本地页面构造成交净盈亏 -17 元，说明明确收盘价不参与：通过。
- 新建表单最初 Playwright 日期填写未落值，被校验拦截；改用原生日期控件设置后保存成功。新决策时间前已形成并带入的两项可见，缺形成时间旧项排除。未修改代码绕过校验。
- 真实 AI、真实行情、本次部署和修复版线上浏览器链路：未通过/未验证，原因见最终验收。

## 下载记录纠正

旧 V2/V5 记录保留“下载按钮触发但完成未确认”。用户本轮明确提供后续独立基线：旧版 JSON 已实际下载并解析成功。二者是不同验收时间；后者补充了旧版状态，不算修复版验收。本轮另在本地修复版取得实际下载文件并解析，包含三项清单、原形成时间、originalCaseId 和勾选状态。

## 初次失败与修正

新增测试首次运行有四项 fixture 传参类型错误；修正测试夹具后重跑，最终 64/64。官方构建助手在当前环境缺失，使用仓库原有 build 命令成功构建；未假装已完成发布归档。Git HTTPS 连接失败不是代码测试通过。

## 复验命令

运行单元测试、tsc 和 build；启动本地服务后运行 scripts/check-deployment.mjs。仅在授权的可联网环境、有既有服务端凭据时使用：

`TEST_URL=<目标地址> node --experimental-strip-types scripts/final-model-check.mjs --live`

此脚本最多两次产品请求，每次可能有一次内部重生成；保存报告供逐段语义抽查，不能仅凭脚本退出码宣称无幻觉。Windows 用 PowerShell 设置 TEST_URL 环境变量后执行 Node 命令。
