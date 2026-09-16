# dsh-sudoku-mini

## 项目简介

DeepSeek Harness Web 的悬浮小工具插件。点击圆形入口会顺时针展开三个功能按钮；当前第一个功能打开约 340 px 的数独游戏面板，另外两个位置预留后续扩展。数独提供简单、中等、困难、专家四档，共 80 道本地唯一解题目，支持笔记、撤销、提示、暂停、自动保存和深色主题。

游戏不调用模型，也不修改 agent 会话；关闭面板后停止游戏计时。

## 安装

需要 Node.js `^22.19.0 || >=24.11.0` 和 pnpm `11.25.0`。已验证的 DeepSeek Harness 版本为 `0.1.5-rc.2`。

在项目根目录构建安装包；已有安装包时可跳过这一步：

```bash
pnpm install
pnpm pack --out artifacts/dsh-sudoku-mini-0.1.0.tgz
```

继续在项目根目录执行以下命令，安装插件并启动 Web 页面。通过 `npx` 调用 CLI，无需预先安装 `dsh` 命令；这里使用的是 `@deepseek-ai/dsh`，不是系统 `apt` 中的同名工具。

```bash
DSH_SUDOKU_PACKAGE="$(pwd)/artifacts/dsh-sudoku-mini-0.1.0.tgz"
cd ~
npx -y @deepseek-ai/dsh@0.1.5-rc.2 plugin --profile web add "$DSH_SUDOKU_PACKAGE"
npx -y @deepseek-ai/dsh@0.1.5-rc.2 web --no-open
```

首次执行会下载 CLI。打开终端输出的 URL，即可看到圆形悬浮工具入口；已运行的 DSH Web 需重新启动并刷新页面。

卸载插件后重新启动 DSH Web：

```bash
cd ~
npx -y @deepseek-ai/dsh@0.1.5-rc.2 plugin --profile web remove dsh-sudoku-mini
```

## 使用方法

- 点击圆形悬浮入口展开或收起功能菜单，再点击“数独”打开游戏面板；拖动入口或桌面面板标题可移动位置。
- 选择空格后按 `1–9`，或点击数字栏填数；方向键移动选择。
- 点击“笔记”或按 `N` 切换候选数输入；`Delete` / `Backspace` 擦除，`Ctrl/Cmd + Z` 撤销。游戏快捷键仅在棋盘聚焦时生效。
- 点击“提示”查看推导说明；需要直接揭示答案时会先确认。
- 点击“暂停”暂停游戏；关闭面板或切换到后台也会暂停计时。
- 使用难度下拉框或“新游戏”换题；有填写或笔记时会先确认。“更多”中可重开当前题、检查答案、切换主题及重置位置。
- 功能菜单展开时按 `Escape` 可将其收起；数独面板内按 `Escape` 会先关闭内部确认，再收起面板。按 `Tab` 可返回宿主界面。

进度自动保存在当前浏览器、当前 DSH 站点，刷新后可继续。不同浏览器或站点之间不共享进度；存储不可用时仍可游玩，但刷新后无法恢复本次进度。
