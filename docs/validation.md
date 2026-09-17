# 首版构建与验证记录

验证日期：2026-09-15。版本：`dsh-sudoku-mini@0.1.0`。

## 实际交付

- DSH Web 悬浮入口与非模态数独面板：默认收起，桌面宽 340 px，按钮 40 px；Shadow DOM 隔离样式，复用宿主 React 注册全局 slot。
- 四档题库各 20 题，共 80 道自生成唯一解题目；题面通过合法变换随机化。`logic-v1` 评级包含单候选、隐藏单候选、区块排除、数对、X-Wing；全部专家题最高策略为 X-Wing，不宣称等同于 Sudoku.com 难度。
- 完整基础玩法：正式数字、笔记、复合撤销、擦除、冲突高亮、可选答案检查、提示与明确答案揭示、新题/重开确认、计时/暂停、自动保存、拖动、浅色/深色主题、局部键盘导航。
- 本地存档带题库/变换版本、固定格与撤销链校验；历史最多 200 步，序列化限制 64 KiB。存储访问失败不阻断游戏。
- 服务端插件仅为空接入壳，无 agent 工具、模型请求或会话修改。离线生成/求解脚本未进入客户端。

## 检查结果

| 检查 | 实际结果 |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | 成功，可使用现有缓存复现锁定依赖 |
| `pnpm typecheck` | 总体、服务端、客户端三组严格类型检查通过 |
| `pnpm test` | 4 个测试文件，共 19 项通过；覆盖规则、题库、历史、存档、计时与销毁 |
| `pnpm puzzles:validate` | 80 题结构、答案、唯一解及评级全部通过；每档 20 题 |
| `pnpm build` / `pnpm check:artifacts` | ESM 服务端、宿主工厂包装客户端及声明输出通过；运行时只请求共享 `react` |
| Playwright 独立预览 | 7 项交互 + 1 项性能测试通过；含 360 × 640 视口、刷新恢复、键盘隔离、模拟输出/审批 |
| Playwright 真实 DSH | 游戏加载、填数、撤销、设置焦点/层级、宿主 Escape、新建会话入口及单一挂载通过 |
| CLI 卸载后重启 | profile dependency/bundle 移除成功；浏览器 boot.entries、挂载点与按钮均无本插件，宿主正常加载 |

环境：Linux Ubuntu 20.04、Node.js `v24.18.0`、pnpm `11.25.0`、Playwright `1.55.1` Chromium。DSH 为固定版本 `0.1.5-rc.2`，Cordis `4.0.2`。临时测试字体仅在 `/tmp` 中用于中文截图，产品使用系统字体，没有远程字体依赖。

## 性能与清理

当前 `lib/client.js` 为 **48,647 bytes**，gzip **17,366 bytes**，含样式与全部题库，低于 60 KiB 预算。笔记数字节点在单格首次使用笔记时创建，避免首次打开时预建 729 个空数字节点。

初始化优化后的独立预览测量：连续开关 50 次、填数 100 次，首次打开约 36.2 ms，打开 p95 约 9.3 ms，填数 p95 约 1.3 ms。测量同步事件执行及强制布局，**不包含完整绘制延迟**；不是带真实模型输出的性能对比。原始结果生成于 `artifacts/performance.json`，每次执行会覆盖。

关闭后 interval 计数恢复到初始基线；基线 1 个属于开发预览的 Vite 心跳，不是游戏。重挂载 10 次保持一个 Shadow DOM host，无新增 interval；jsdom 测试另外验证自有定时器销毁为零、隐藏与手动暂停的组合。尚未做堆内存快照或全部监听器数量对比。

## 隔离安装与产物

实际 link 安装与资源发现记录见 [兼容记录](./compatibility.md)。发布命令 `pnpm pack --out artifacts/dsh-sudoku-mini-0.1.0.tgz` 自动执行题库、构建与产物校验；安装包包含 `lib/`、patch、README、文档和许可证，排除开发预览、测试与离线生成脚本。

tgz 已在第二个独立 profile 实际安装成功，并在真实 DSH 中完成浏览器回归；CLI 移除后重启，浏览器也确认插件入口和启动清单均已移除。按需笔记优化后的最终 tgz 再次实际安装，其客户端 SHA-256 与项目构建产物完全一致；真实 DSH 冒烟测试再次通过（1 项，2.9 秒）。共覆盖 8 项预览、1 项宿主交互、1 项卸载检查，详见兼容记录。测试服务及 profile 均位于 `/tmp/dsh-sudoku-integration`，未变更用户日常 DSH。

截图生成于以下本地产物，不纳入发布包：

- `artifacts/dsh-desktop.png`：真实 DSH 中的展开面板。
- `artifacts/dsh-settings.png`：真实宿主设置弹窗覆盖数独并获得焦点。
- `artifacts/preview-desktop.png`、`artifacts/preview-mobile.png`：独立预览布局。

## 尚未验收的项目

- **真实模型任务、模型流式回复、真实工具执行与权限审批**：隔离 profile 未配置 API 凭证；预览模拟场景不能证明这些行为。未测量真实宿主输入的所有快捷键与实际会话间切换。
- 真实移动设备、Safari/Firefox、虚拟键盘、200% 缩放，以及 1440 × 900 / 360 × 800 的完整视口矩阵。
- 真实宿主运行中禁用的销毁、全部长任务及堆内存增长检查；当前完成 CLI 卸载/重启及小组件销毁回归，未做 Performance trace。
- 用户实际 DSH 版本和其他插件组合；目前兼容结论仅限固定基线。

因此当前交付为可构建、可安装且已完成所列回归的首版实现；规划第 12 节中的全部发布验收条件尚未满足。后续验证应在有凭证的独立 DSH 中执行，游戏开启时运行一个 agent 任务，确认发送、停止与审批正常。

## 追加：2048 与工具宿主（2026-09-17）

功能菜单第二项由占位符改为可用的 2048 面板，第三项仍为占位。为支持多工具，`src/client/widget.ts` 拆分为「悬浮入口 + 面板宿主」，具体工具实现迁入 `src/client/tools/`，并新增 `ToolModule` 契约（`mount(container, ctx) → { destroy() }`）。同一时刻只挂载一个工具：切换或关闭时销毁上一个工具，因此数独计时器与监听都会随之回收。

2048 的规则全部为纯函数：`src/game2048/engine.ts` 负责滑动/合并/生成/胜负，`src/game2048/joystick.ts` 把指针采样折算为方向。摇杆按需求采用**纯速度阈值**触发（默认 `fireSpeed` 0.35 px/ms、最小间隔 140 ms），不设位移复武装、不设慢拖兜底；`rearmSpeed` 保留为可选刹车，默认关闭以保持最灵敏手感。触摸拖动使用较低阈值。

| 检查 | 实际结果 |
| --- | --- |
| `pnpm typecheck` | 总体、服务端、客户端三组严格类型检查通过 |
| `pnpm test` | 6 个测试文件、37 项通过；新增 `tests/g2048.test.ts`（引擎）与 `tests/joystick.test.ts`（阈值/滞回/夹紧） |
| `pnpm puzzles:validate` | 数独题库未改动，80 题仍全部通过 |
| `pnpm build` / `pnpm check:artifacts` | 通过；`lib/client.js` 68,387 bytes，gzip 22,687 bytes |
| Playwright 预览与真实 DSH | **本次未执行**，原因见下 |

本次 2048 的浏览器级行为未获实测：本机 Playwright 的 headless shell 未安装，改用 `channel: 'chromium'` 后 Chromium 能启动但无法完成任何导航（连 `data:text/html` 也超时），属于当前环境的浏览器运行限制，与本次改动无关。`tests/e2e/widget.spec.ts` 已同步更新（第二个功能按钮改为 2048、占位断言移到第三项，并新增摇杆拖动与方向键的 2048 用例），但**尚未在浏览器中跑过**。jsdom 测试覆盖了工具互斥挂载、计时器回收，以及经 `performance.now` 桩定的摇杆拖动确实触发移动；这些不能替代真实浏览器验证。

建议在可用浏览器的环境中补跑 `pnpm test:e2e`，并确认：摇杆在真实指针事件下的阈值手感、触摸设备（`pointerType === 'touch'`）的阈值、以及高刷新率下连续快拖的节奏是否符合预期。

另注：共享的确定性随机源放在 `src/shared/random.ts`。该目录原本拟命名为 `src/lib/`，但根 `.gitignore` 的 `lib/` 规则会匹配任意层级的 `lib`，导致源码被静默忽略，因此改名。
