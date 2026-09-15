# DSH 接入兼容记录

验证日期：2026-09-15。目标宿主为 npm `@deepseek-ai/dsh@0.1.5-rc.2`；Node.js `v24.18.0`。研究基线和安装产物的 CLI 版本一致，不代表兼容所有 DSH 版本。

## 实际接口与构建协议

- 从已安装的 `@deepseek-ai/dsh-client-ui-layout@0.1.5-rc.2/lib/types/client/index.d.ts` 核实 `shell.overlay` 为 `kind: list`、`scope: root`；它是追加独立界面的全局槽位。[固定基线官方源码](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-layout/src/client/index.ts)
- 从 `@deepseek-ai/dsh-client-ui-renderer@0.1.5-rc.2` 与 `@deepseek-ai/dsh-client-ui-slots@0.1.5-rc.2` 的发布声明核实 `Context.slots.register` 接受 `name/id/order`，返回幂等 `() => void` disposer。客户端依赖 `slots`、`layout`，由 `ctx.effect` 管理注销，React effect 管理 widget 销毁。[官方 slots 源码](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-slots/src/index.ts)
- npm renderer/layout 将 slots 仅列为开发依赖，外部插件必须直接声明 `@deepseek-ai/dsh-client-ui-slots` 和声明引用所需的 `@deepseek-ai/dsh-client-store` 开发依赖；两个 `0.1.5-rc.2` 包已在隔离环境成功从 npm 安装。[官方 renderer 包](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-renderer/package.json)
- 从 npm 宿主客户端 bundle 核实共享 React、`react/jsx-runtime`、ReactDOM、Cordis、slots/store 等模块；当前适配器仅运行时请求 `react`，不创建第二个 ReactDOM root。浏览器产物为 `window.__ModuleLoader__.load({ id: 'dsh-sudoku-mini', factory })` 注册工厂。[官方共享表](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/web/src/platform.ts)、[官方构建包装](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/tsdown.client.ts)
- 发布的 AppFrame 浮层 CSS 为 `z-index:20; pointer-events:none; position:absolute; inset:0`，直接子元素恢复 `auto`。适配器及 Shadow DOM host 再明确设为 `none`，按钮/面板开启 `auto`。[官方样式](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-layout/src/client/AppFrame.module.css)
- 发布的 settings、chat/context、image lightbox 的全局 Escape 监听器使用冒泡阶段；数独只在自有 ShadowRoot 消费识别的按键，不监听全局键盘。该源码检查不能替代浏览器验证。[官方设置面板](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-settings-general/src/client/SettingsRoot.tsx)

## 隔离宿主实际结果

运行环境在 `/tmp/dsh-sudoku-integration`，用户日常 DSH profile 未变更。独立安装的 CLI `--version` 输出 `0.1.5-rc.2`，`web --help` 正常。隔离环境使用 pnpm `11.25.0`；安装依赖时通过独立 `pnpm-workspace.yaml` 的 `allowBuilds` 放行宿主所需的 subprocess helper、koffi、node-pty、protobufjs 构建，未修改项目的 pnpm 配置。

本地插件链接安装命令实际执行成功：

```sh
DSH_HOME=/tmp/dsh-sudoku-integration/home \
  node /tmp/dsh-sudoku-integration/node_modules/@deepseek-ai/dsh/lib/bin.js \
  plugin --profile web add link:/home/wanyi/dsh-sudoku-mini
```

CLI 自动将插件加入隔离 Web profile 的 dependencies 与 `dsh.profile.bundles`。随后实际启动命令：

```sh
DSH_HOME=/tmp/dsh-sudoku-integration/home \
  node /tmp/dsh-sudoku-integration/node_modules/@deepseek-ai/dsh/lib/bin.js \
  web --no-open --host 127.0.0.1 --port 5178
```

宿主输出正常启动 URL；临时 token 不记录到仓库。此工作环境的受限执行器中启动曾无输出且本机连接失败，允许本机隔离服务执行后启动成功。已通过本机 HTTP 认证重定向实际读取页面，页面的 `__DSH_BOOT__.entries` 与组合 `/plugins` 预加载清单均包含 `dsh-sudoku-mini`，声明的包依赖为 renderer/layout。至此验证了安装、bundle 合成、客户端资源发现和正常宿主启动，尚不能仅据此断言 React slot 已成功渲染。

## 实际 tgz 安装验证

第一轮运行时代码构建后，将 `artifacts/dsh-sudoku-mini-0.1.0.tgz` 实际安装到第二个独立 `DSH_HOME=/tmp/dsh-sudoku-integration/package-home`，不替换前述链接 profile：

```sh
DSH_HOME=/tmp/dsh-sudoku-integration/package-home \
  node /tmp/dsh-sudoku-integration/node_modules/@deepseek-ai/dsh/lib/bin.js \
  plugin --profile web add /home/wanyi/dsh-sudoku-mini/artifacts/dsh-sudoku-mini-0.1.0.tgz
```

实际输出 `Packages: +1`、`dsh-sudoku-mini file:...tgz`，pnpm `11.25.0` 在 920 ms 内完成。新的 profile dependencies 指向 tgz，`dsh.profile.bundles` 自动追加本包；安装后的 `lib/client.js` 为 48,606 bytes，`lib/index.js` 与声明文件均存在。按前述启动命令将端口改为 `5179` 后，第二个宿主实际输出正常启动 URL；临时 token 不记录。安装显示 peer 依赖提示：官方生成 profile 使用 `autoInstallPeers:false`，本地 profile 未另装 Cordis，CLI 模块 fallback 提供宿主 Cordis；该提示未阻止安装或宿主启动。浏览器是否工作以实际回归结果为准。

固定版的插件清单界面是只读 inventory；卡片的 `aria-expanded` 只控制详情，并非插件开关。安装和卸载使用 CLI `plugin ... add/remove`；profile patch 的 `disabled` 才是 Loader 停用配置。没有假定不存在的 Web 卸载按钮。[官方清单源码](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.tsx)

第一轮 tgz 实例的真实 DSH 浏览器回归已实际通过 9 项检查（5.4 秒），包含 slot/资源加载、填数与撤销、宿主 Settings 的焦点和 Escape、新建会话；详见 [验收记录](./validation.md)。随后在第二个隔离 profile 实际执行 `plugin --profile web remove dsh-sudoku-mini`，输出删除 tgz dependency 并在 729 ms 完成。卸载后的 profile 已无本包 dependency，`dsh.profile.bundles` 恢复只含官方 base/web-app。实际重启后浏览器确认宿主 Settings 正常，`__DSH_BOOT__.entries` 不含本包，两个数独挂载标记和悬浮按钮数量均为 0，无 pageerror，完成卸载验收。

完成按需创建笔记 DOM 的初始化优化后，重新构建的最终 tgz 复制到唯一临时文件名 `/tmp/dsh-sudoku-integration/dsh-sudoku-mini-final.tgz`，复制前后 SHA-256 相同，以避免同名包缓存混淆。实际重新安装在 805 ms 完成，最终安装后的客户端为 48,647 bytes（构建记录 gzip 17,366 bytes），与项目 `lib/client.js` 的 SHA-256 完全一致；第二个隔离宿主在 `5179` 正常重启。最终浏览器冒烟结果见验收记录。

最终 tgz 的真实 DSH 冒烟已实际通过（1 passed，2.9 秒），覆盖插件加载、填数撤销及宿主交互。两台临时 DSH 服务已停止，`5178`、`5179` 均通过本机重新绑定确认已释放；用户日常 profile 未更改。此后仅更新交付文档再打包，客户端运行时代码保持相同。

## 浏览器与 agent 验证边界

浏览器交互、会话切换、设置/审批层级、卸载清理及性能测量以 `docs/validation.md` 的实际执行记录为准。服务正常启动和客户端 manifest 正确不能替代这些验收。

本次未配置用户 API 凭证；真实 DeepSeek 请求、模型流式回复与真实工具执行没有因服务启动而自动得到验证。发布前应在自己的 DSH 环境实际运行一个 agent 任务，同时打开游戏、填数、撤销并确认宿主发送、停止与审批正常。
