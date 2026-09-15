# DeepSeek Harness 数独插件接入研究

研究日期：2026-09-15。本文为代码构建规划提供官方接口证据；不代表插件已经实现、安装或在 dsh 中运行通过。

## 1. 研究基线与可信度

使用官方仓库 `deepseek-ai/deepseek-harness`。建议第一轮接入验证固定在提交 `c291e7961a515f6d7af9304e7fd1d257929aef26`，其 CLI 包声明版本为 `0.1.5-rc.2`；本次已在该提交再次核实浮层槽位、构建包装、模块基线、manifest 类型和插件安装逻辑。这是可重现研究基线，不能据此断言它是当前最新提交或 npm 最新版本。[官方提交](https://github.com/deepseek-ai/deepseek-harness/commit/c291e7961a515f6d7af9304e7fd1d257929aef26)、[CLI package.json](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/apps/cli/package.json#L1-L15)

该基线中的 `@deepseek-ai/cordis` 为 `4.0.2`，与当前项目已声明的 `^4.0.2` 对应；锁文件与宿主实际安装版本仍需在实施阶段确定。[Cordis package.json](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/vendor/cordis/package.json#L1-L15)

官方 README 明确项目处于 developer preview，接口会发生不兼容变化，因此规划不能只写“兼容 dsh 最新版”。[官方 README](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.md#developer-preview)

## 2. 已核实：直接使用宿主的全局浮层槽位

`packages/client/ui-layout/src/client/index.ts` 声明：

```ts
'shell.overlay': { kind: 'list'; scope: 'root' }
```

官方注释把它定义为覆盖所有列、位于滚动容器外的 frame-wide floating layer，并明确允许使用新 `id` 追加独立界面。该槽位由布局插件声明，不应重新声明，也不应占用已有 `root`、`sidebar` 或 `rightbar` 单一槽位。[浮层声明与布局注册](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-layout/src/client/index.ts#L77-L87)

`AppFrame.tsx` 将 `shell.overlay` 与中心区、右侧区分别渲染；浮层不是某个 Session 的子界面。由此推断：在布局插件保持挂载、浮层组件自身不使用 Session key 的前提下，切换会话不会要求重建数独状态；此项仍需实际会话切换测试。[AppFrame 渲染位置](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-layout/src/client/AppFrame.tsx#L181-L219)

浮层宿主 CSS 是 `position: absolute; inset: 0; z-index: 20; pointer-events: none`；其直接子元素被设为 `pointer-events: auto`。实施时必须让插件宿主元素只占按钮/面板的实际范围，或者显式把透明容器设为 `pointer-events: none`、交互子元素恢复 `auto`。不能添加覆盖整页、可接收点击的透明容器。[宿主浮层 CSS](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-layout/src/client/AppFrame.module.css#L84-L93)

## 3. 已核实：注册、依赖与清理

客户端插件导出 `apply(ctx)`，通过 `ctx.slots.register(options, Component)` 注册。列表槽位的 options 必须提供 `name` 和独立 `id`；可选 `order`、`label`、`priority`。返回值为幂等 disposer。此次该核心源码使用官方 `master` 页面核实，固定基线对应文件的网页抓取未成功；实施前应对固定版本的声明文件再次核对签名。[SlotCore.register 与 KindOptions](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-slots/src/index.ts#L470-L541)、[返回清理函数的接口](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-slots/src/index.ts#L699-L767)

推荐接入形状，以下是规划草图，不是已编译代码：

```ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'

export const inject = ['slots', 'layout']

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.slots.register({
    name: 'shell.overlay',
    id: 'dsh-sudoku-mini',
    order: 100,
  }, SudokuOverlay))
}
```

`slots` 注入保证注册服务可用；建议同时等待 `layout`，让声明 `shell.overlay` 的布局插件先激活。`layout` 在本插件中只作为就绪依赖，不调用其导航、侧栏或会话操作。类型导入用于加载声明合并，擦除后不产生浏览器运行时 `require`。[布局插件 provide/register 顺序](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-layout/src/client/index.ts#L122-L160)

官方教程确认 `ctx.effect()` 返回的 disposer 会在插件卸载时执行。数独自己添加的原生 DOM 监听器、定时器、ResizeObserver 等必须由自己的 disposer 清理；由 React adapter 的 effect cleanup 调用 widget.destroy()，slot disposer 则负责移除组件注册。[官方插件清理教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md#automatic-cleanup)

## 4. 已核实：宿主负责资源发现与分发

普通浏览器插件无需自行注册 server 静态资源 API。官方 `dsh-client-modules` 会扫描已启用的 Loader 条目，读取包的 `dsh.client` 与 `./client` export，组合启动图并通过 `/plugins` 分发构建后的 bundle。缺少构建文件会造成激活失败，服务不会替插件现场编译。[官方模块接入说明](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/modules/README.md#declaring-a-client-plugin)

因此本项目 Node 入口可以是无副作用的空 `apply()`，仅作为宿主 Loader 可加载入口；官方布局插件本身也采用该形式。[官方 Node 空入口](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-layout/src/index.ts)

## 5. 已核实：package.json 与配置层

官方 manifest 类型定义 `dsh.bundle.patch` 为相对于包根的补丁路径，`dsh.client.platform` 对 Web 为 `web`。`dsh.client.inject` 是包名依赖信息，**不是** `apply` 的 Cordis 服务注入；`external` 是超出隐式共享基线的精确模块请求。[官方 manifest 类型](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/util/package-manifest/src/types.ts#L24-L75)

本项目建议同时声明 bundle 和 client 角色，示意：

```json
{
  "name": "dsh-sudoku-mini",
  "version": "0.1.0",
  "description": "Compact Sudoku overlay for DeepSeek Harness Web UI",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "default": "./lib/index.js"
    },
    "./client": {
      "types": "./lib/types/client/index.d.ts",
      "default": "./lib/client.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["lib", "cordis.patch.yml"],
  "engines": { "node": ">=22.19.0", "dsh": "0.1.5-rc.2" },
  "peerDependencies": { "@deepseek-ai/cordis": "4.0.2" },
  "dsh": {
    "manifestVersion": 1,
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-ui-renderer",
        "@deepseek-ai/dsh-client-ui-layout"
      ]
    }
  }
}
```

以上为产物接入 manifest 草图，开发依赖和 scripts 由实施规划另定；精确 engines 表达建议的第一轮验证目标，源码类型说明 `engines.dsh` 在 reader 强制检查前只是声明。官方浏览器包 `. / ./client / ./package.json` export 结构可作为参考；npm 外部项目不能照抄 monorepo 的 `workspace:^` 版本值。[官方布局包结构](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-layout/package.json#L12-L61)

补丁层只追加本项目条目：

```yaml
- insert:
    - id: sudoku-mini
      name: dsh-sudoku-mini
```

这是依据官方首个插件教程的 `insert` 语法和官方 Web roster 的包名加载方式形成的配置草图。插件必须注册在 Web 宿主树，而非某个 agent preset 内。[官方补丁教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md#register-it-in-cordisyml)、[官方 Web roster](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/web-app/cordis.patch.yml#L153-L190)

## 6. 已核实：浏览器构建不是普通 ESM 页面入口

官方动态客户端 preset 使用 browser CJS，包装成工厂注册。关键输出结构为：

```js
window.__ModuleLoader__.load({
  id: 'dsh-sudoku-mini',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    // 构建器生成的 CJS 内容
    return module.exports
  }
})
```

外部包在当前仓库中实现自己的精简 tsdown 配置，并复现协议；不直接导入上游 `packages/client/tsdown.client.ts`，该 preset 会扫描上游 `packages/*/*/package.json`。Node 入口另建为 ESM；两个构建阶段不能互相清空输出。首版避免代码分块和浏览器原生 `import()`，产物为一个 `lib/client.js`，关闭状态只保留轻量按钮；数独业务初始化可延后到首次打开。[官方客户端构建 preset：clientConfig、workspaceManifest 与包装](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/tsdown.client.ts#L327-L542)

共享基线包含 `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。本项目薄 React adapter 所需的 React 应 external，由工厂内 `require` 获取宿主同一实例；类型导入不会产生请求。首版 adapter 内挂原生 TS widget，无需自行创建第二个 ReactDOM root。[官方共享模块表](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/web/src/platform.ts)

ShadowRoot CSS 文本插入、原生 widget 生命周期是本项目设计决策，不是 dsh 专用 API。需自行构建 CSS 字符串资源，不能假设普通 tsdown 自动支持上游的 `.css?inline` 插件。

## 7. 已核实：本地安装与启用

CLI `plugin.ts` 会在指定 profile 下转发 pnpm 参数，并按实际安装状态将带 `dsh.bundle.patch` 的依赖追加到 `dsh.profile.bundles`。相对 `.`、`../path`、`file:`、`link:` 路径会锚定到 CLI 调用目录；因此在本项目构建完成后，本地接入命令可采用：

```sh
dsh plugin --profile web add .
dsh web --no-open
```

测试时优先使用隔离的 `DSH_HOME` 或从 Web 模板建立独立 profile，以免改动日常工作环境。上面是规划命令，本次未执行；卸载可使用对应 `remove dsh-sudoku-mini`，同一逻辑会移除依赖管理的 bundle 项。[官方插件命令实现](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/apps/cli/src/plugin.ts#L27-L125)、[官方 CLI 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/README.md#entry-modes)

## 8. 实施前仍需核实的事项

| 事项 | 当前状态 | 实施时如何关闭不确定性 |
|---|---|---|
| 用户日常 dsh 版本 | 当前环境未发现 dsh 可执行文件 | 记录实际宿主版本及启动方式，与研究基线逐项对照 |
| `0.1.5-rc.2` npm 安装及包 export | 已核实源码声明，未验证 registry 产物 | 在隔离环境安装目标版本，验证类型声明、exports 和 client bundle |
| 当前 tsdown `^0.23.0`、TS `^7.0.2` 可运行性 | 仅为项目声明 | 安装锁定依赖后执行 typecheck 与双入口 build；不要把声明视作已验证工具链 |
| SlotCore 固定版本 register 类型 | master 已读，固定提交抓取失败 | 从固定版本包内 `.d.ts` 核对 options/组件 props/disposer |
| root 浮层跨会话保持游戏 | 从槽位 scope 与 AppFrame 推断 | 实际开局后切换会话、目录及设置页面验证 |
| Shadow DOM 键盘与宿主快捷键兼容 | 项目设计，未运行验证 | 测试游戏聚焦和 agent 输入聚焦；只消费游戏识别的按键，覆盖输入法及 Shadow DOM 事件路径 |
| 宿主错误边界与插件卸载行为 | 无运行证据 | 注入 widget 失败、反复启用/禁用，确认不破坏宿主输入和 agent 流式输出 |
| 背景 agent 正常工作 | 不能仅由 UI 架构保证 | 真实任务运行时打开/关闭/操作游戏，检查网络请求、长任务及结果流 |

研究范围只涉及 DeepSeek Harness 接入；数独规则、题库生成、难度与 UI 规格由主构建规划定义。
