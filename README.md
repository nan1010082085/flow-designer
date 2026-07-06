# @flow

流程引擎前端 -- BPMN 流程设计器、流程管理、任务收件箱。

## 项目简介

Schema Form Platform 的流程引擎前端，基于 Vue Flow 可视化编排 BPMN 流程图，提供流程定义管理、实例监控、任务审批收件箱、统计报表等能力。支持 SSO 单点登录和微前端嵌入两种访问模式。

核心引擎逻辑在 `@schema-platform/flow-shared`（Token 执行模型、节点类型定义、流程校验），本项目专注 UI 层。

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Vue 3.5 + TypeScript 5.7 |
| UI | Element Plus 2.9 |
| 流程图 | Vue Flow + @dagrejs/dagre 布局 |
| 图表 | ECharts 6.1 |
| 路由 | Vue Router 4（支持 memory history 微前端模式） |
| 状态 | Pinia |
| 构建 | Vite 5 |

## 端口配置

| 环境 | 端口 |
|---|---|
| 开发 | 5200 |

## 主要功能

### 流程设计器

- Vue Flow 可视化画布，25 种 BPMN 标准节点
- 拖拽编排 + 自动布局（dagre）
- 节点属性配置面板（nodePanels/ — UserTask、ServiceTask、ScriptTask、Gateway、SubProcess 等）
- 画布缩放 / 小地图 / 背景网格
- 节点复制/粘贴、剪贴板操作
- 流程导出、缩略图生成
- 流程校验（FlowValidator）
- 模拟执行（useSimulation）

### 审批流能力

- **审批操作**：通过 / 驳回 / 委派 / 转办 / 催办 / 撤回
- **加签/减签**：动态调整审批人
- **审批评论**：任务级评论输入与展示
- **批量审批**：批量通过 / 批量驳回（含目标节点选择）
- **审批日志**：统一使用 `getApprovalLogs` 数据源，展示耗时统计
- **审批人高级规则**：排除发起人 / 去重 / 自动跳过
- **全局驳回策略**：跟随流程全局配置显示
- **任务到期时间**：dueDate 展示 + 过期高亮
- **任务排序**：按创建时间 / 优先级 / 到期时间

### FlowFormRenderer 容器

- 操作栏（节点名称 + 动态按钮） + iframe 加载 Editor 发布页面
- postMessage 通信协议（fg:set-mode / fg:set-data / fg:get-data / fg:validate）
- 带 requestId 的请求-响应配对（超时 5s）
- 操作按钮根据 `BpmnNodeConfig.allowedActions` 配置动态渲染
- 驳回/转办/委派对话框内置

### 子流程引擎

- **SubProcess**：内嵌子流程，支持 inputMapping / outputMapping 变量转换
- **CallActivity**：调用外部流程定义，分页选择目标流程
- **父子实例关联**：parentInstanceId / childInstanceIds 自动维护
- **等待-恢复机制**：子流程 Token 等待 → 完成后自动恢复父流程
- **任务分配**：指派方式配置（用户 / 角色 / 表达式）
- **超时配置**：超时时间 + 超时动作（通知 / 自动通过 / 自动转交）
- **错误处理**：错误策略（终止 / 重试 / 跳过） + 重试次数/间隔

### 流程管理

- 流程定义列表（创建 / 编辑 / 删除 / 发布）
- 流程实例列表 + 详情查看（含流程图可视化：节点状态高亮、边动画）
- 流程监控仪表盘
- 流程统计报表
- 流程模板管理

### 权限与表单

- **FlowSettingsDialog**：编辑 / 发起 / 查看权限 + UserPicker
- **SchemaPreview**：editableFields 字段级 disabled 控制、schemaId 加载
- **SchemaSelector**：节点关联表单 schema
- **字段条件联动**：show / hide / readonly + 条件表达式
- **变量系统**：useVariableDefinitions + VariableSelector + VariableHighlightInput

### 任务收件箱

- 待办任务列表 / 已办任务列表
- 审批操作（通过 / 驳回 / 委派 / 转办 / 催办）
- 批量审批
- 实时通知（useRealtimeNotifications composable，WebSocket 预留）

### 嵌入式页面（供 Editor 微应用容器使用）

- `/embed/preview` — 流程预览
- `/embed/approval-log` — 审批日志
- `/embed/task-list` — 任务列表

### 扩展

- SSO 单点登录（OAuth2 授权码模式）
- 微前端嵌入（qiankun memory history）
- AI 能力集成（通过节点配置面板与 ai 交互）

## 项目结构

```
src/
├── api/                    # API 接口（flowApi.ts）
├── components/
│   ├── nodes/              # 25 种 BPMN 节点渲染组件
│   ├── nodePanels/         # 节点属性配置面板
│   ├── edges/              # 自定义边组件
│   ├── panels/             # 通用面板组件
│   ├── FlowDesigner.vue    # 流程设计器主组件
│   ├── FlowCanvas.vue      # Vue Flow 画布
│   ├── FlowToolbar.vue     # 工具栏
│   ├── FlowPalette.vue     # 节点面板（拖拽源）
│   ├── FlowPropertyPanel.vue # 属性面板
│   ├── FlowFormRenderer.vue  # 审批表单容器（iframe + postMessage）
│   ├── ApprovalList.vue    # 审批记录列表
│   ├── FlowSettingsDialog.vue # 流程权限设置
│   ├── SchemaPreview.vue   # 表单预览（editableFields）
│   └── ...
├── composables/            # 组合式 API
│   ├── useAutoLayout.ts
│   ├── useSimulation.ts
│   ├── useFlowExport.ts
│   ├── useVariableDefinitions.ts
│   ├── useRealtimeNotifications.ts
│   └── ...
├── stores/                 # Pinia Store
│   ├── flowGraph.ts        # 流程图状态
│   ├── flowDesigner.ts     # 设计器状态
│   ├── flowInstance.ts     # 流程实例 + 任务操作
│   ├── flowDefinition.ts   # 流程定义
│   ├── flowMonitor.ts      # 监控数据
│   └── ...
├── views/                  # 页面视图
│   ├── embed/              # 嵌入式页面
│   └── ...
├── __tests__/              # 测试文件（36 个文件，457 个测试用例）
└── styles/                 # 全局样式
```

## 常用命令

```bash
pnpm dev      # 启动开发服务器（端口 5200）
pnpm build    # vue-tsc + vite build
pnpm test     # vitest run
pnpm test:coverage  # 测试覆盖率
```
