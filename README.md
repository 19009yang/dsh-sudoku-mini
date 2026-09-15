# dsh-sudoku-mini

DeepSeek Harness Web 的小型数独插件。页面右侧提供一个悬浮入口，展开约 340 px 的非模态游戏面板；不会注册 agent 工具或修改会话。

支持简单、中等、困难和专家四档，共 80 道本地唯一解题目，以及数字输入、笔记、撤销、擦除、提示、暂停、自动保存、拖动和深色主题。题库自生成；难度按本项目 `logic-v1` 逻辑评级，专家题含 X-Wing，不等同于 Sudoku.com 的官方难度。

## 安装

接入基线：`@deepseek-ai/dsh 0.1.5-rc.2`、Cordis `4.0.2`。实际验证情况见 [兼容记录](docs/compatibility.md)。构建工具需要 Node.js `^22.19.0 || >=24.11.0` 和 pnpm `11.25.0`。本环境 pnpm 12 的依赖元数据缓存校验失败，因此实施时固定为已验证的 pnpm 11。

```sh
pnpm install
pnpm puzzles:validate
pnpm typecheck
pnpm test
pnpm build
pnpm check:artifacts

# 在本项目目录安装到 DSH Web profile
dsh plugin --profile web add .
dsh web --no-open
```

安装后重新启动 DSH Web，再刷新浏览器。建议先在独立测试 profile 中试用，不要在运行中的 agent 实例里做启停实验。

发布包构建：

```sh
pnpm pack --out artifacts/dsh-sudoku-mini-0.1.0.tgz
dsh plugin --profile web add /绝对路径/artifacts/dsh-sudoku-mini-0.1.0.tgz
```

卸载：

```sh
dsh plugin --profile web remove dsh-sudoku-mini
```

## 操作

- 点击悬浮按钮展开/收起；拖动按钮或桌面标题可移动，更多设置里可重置位置。
- 选择空格后按 `1–9`，或点击数字栏；方向键移动选择。
- `N` 切换笔记，`Delete`/`Backspace` 擦除，`Ctrl/Cmd + Z` 撤销；这些按键只在棋盘聚焦时生效。
- `Escape` 先关闭内部确认，再收起面板；`Tab` 可离开面板返回宿主。
- “提示”优先解释单候选与隐藏单候选；无法直接推导时明确提供答案揭示，不冒充逻辑说明。
- 默认仅标出行、列、宫重复且不限错误次数；更多设置可开启答案校验。
- 关闭面板、页面隐藏或手动暂停时停止计时；手动暂停不会因为切回页面而自动解除。
- 新游戏或换难度会在有进度时确认；更多设置中的“重开当前题”保留原题。

进度仅保存于当前浏览器 origin 的 `localStorage`，跨 DSH 会话继续同一局；不会云同步。多标签页独立游玩，刷新时恢复最后一次成功保存的快照。存储禁用/配额不足时降级为本次内存游戏，损坏或不兼容存档会提示并开始新局。

## 开发与验证

```sh
pnpm dev                         # 独立开发预览，不是 DSH 宿主
pnpm exec playwright install chromium --no-shell
pnpm test:e2e
pnpm puzzles:generate            # 离线生成，确定随机种子，最长 10 分钟
```

浏览器测试的预览页用于验证输入隔离、模拟流式输出与模态层级，不能替代真实 DSH 场景。实测结果及未验收项目见 [验证记录](docs/validation.md)，完整构建方案见 [实施规划](docs/implementation-plan.md)，宿主接口证据见 [接入调研](docs/dsh-plugin-research.md)。

真实 DSH 浏览器测试需提供独立实例的带认证地址，测试 profile 须为空且不含 API 凭证：

```sh
DSH_TEST_URL='http://127.0.0.1:端口/?token=临时令牌' pnpm test:e2e
# 在 CLI 卸载并重启该隔离实例后单独验证入口已消失
DSH_UNINSTALLED_TEST_URL='http://127.0.0.1:端口/?token=新临时令牌' \
  pnpm exec playwright test tests/e2e/dsh-uninstall.spec.ts
```

不要把日常使用实例的地址用于这组首次启动流程测试。当前已验证固定版本的加载和游戏交互；真实模型任务与工具执行仍需在配置凭证的环境验收。

数独游戏使用独立 Shadow DOM，规则/历史通过单一 reducer 修改。客户端复用宿主 React，仅用于薄适配器；在线游玩不执行题库生成、回溯求解或请求模型。

许可证：ISC。
