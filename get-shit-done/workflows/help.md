<purpose>
显示完整的 GSD 命令参考。仅输出参考内容。不要添加特定于项目的分析、Git 状态、下一步建议，或除参考之外的任何评论。
</purpose>

<reference>
# GSD 命令参考 (GSD Command Reference)

**GSD** (Get Shit Done) 创建分层项目计划，专门为使用 Claude Code 的单人代理开发进行了优化。

## 快速开始

1. `/gsd:new-project` - 初始化项目（包括研究、需求和路线图）
2. `/gsd:plan-phase 1` - 为第一阶段创建详细计划
3. `/gsd:execute-phase 1` - 执行该阶段

## 保持更新

GSD 演进很快。请定期更新：

```bash
npx get-shit-done-cn@latest
```

## 核心工作流

```
/gsd:new-project → /gsd:plan-phase → /gsd:execute-phase → 重复
```

### 项目初始化

**`/gsd:new-project`**
通过统一流程初始化新项目。

一个命令带你从想法到准备规划：
- 深入提问以了解你正在构建的内容
- 可选的领域研究（生成 4 个并行的研究代理）
- 带有 v1/v2/超出范围划分的需求定义
- 包含阶段划分和成功标准的路线图创建

创建所有 `.planning/` 产物：
- `PROJECT.md` —— 愿景和需求
- `config.json` —— 工作流模式（交互/yolo）
- `research/` —— 领域研究（如果选定）
- `REQUIREMENTS.md` —— 带有 REQ-ID 的范围需求
- `ROADMAP.md` —— 映射到需求的各个阶段
- `STATE.md` —— 项目记忆

用法：`/gsd:new-project`

**`/gsd:map-codebase`**
为现有代码库（旧项目）建立映射。

- 使用并行的 Explore 代理分析代码库
- 创建包含 7 个专注文档的 `.planning/codebase/` 目录
- 涵盖技术栈、架构、结构、规范、测试、集成和关注点
- 在现有代码库上执行 `/gsd:new-project` 之前使用

用法：`/gsd:map-codebase`

### 阶段规划

**`/gsd:discuss-phase <编号>`**
在规划之前，帮助你阐明对某个阶段的愿景。

- 捕捉你想象中该阶段的工作方式
- 创建包含你的愿景、核心要素和边界的 CONTEXT.md
- 当你对某物的外观/感觉有想法时使用
- 可选的 `--batch` 标志可一次性询问 2-5 个相关问题，而不是逐个询问

用法：`/gsd:discuss-phase 2`
用法：`/gsd:discuss-phase 2 --batch`
用法：`/gsd:discuss-phase 2 --batch=3`

**`/gsd:research-phase <编号>`**
针对小众/复杂领域的全面生态系统研究。

- 发现标准技术栈、架构模式和陷阱
- 创建包含 “专家如何构建此内容” 知识的 RESEARCH.md
- 适用于 3D、游戏、音频、着色器、机器学习等专业领域
- 不仅仅是 “选择哪个库”，而是提供生态系统知识

用法：`/gsd:research-phase 3`

**`/gsd:list-phase-assumptions <编号>`**
在 Claude 开始之前，查看它打算做什么。

- 显示 Claude 对某个阶段的预期方法
- 如果 Claude 误解了你的愿景，让你能及时纠偏
- 不创建文件 —— 仅进行对话输出

用法：`/gsd:list-phase-assumptions 3`

**`/gsd:plan-phase <编号>`**
为特定阶段创建详细的执行计划。

- 生成 `.planning/phases/XX-phase-name/XX-YY-PLAN.md`
- 将阶段分解为具体的、可操作的任务
- 包含验证标准和成功衡量标准
- 支持每个阶段有多个计划（XX-01, XX-02 等）

用法：`/gsd:plan-phase 1`
结果：创建 `.planning/phases/01-foundation/01-01-PLAN.md`

**PRD 快捷路径：** 传递 `--prd path/to/requirements.md` 以完全跳过 discuss-phase。你的 PRD 将成为 CONTEXT.md 中锁定的决策。当你已经有明确的验收标准时非常有用。

### 执行

**`/gsd:execute-phase <阶段编号>`**
执行阶段中的所有计划，或运行特定波次。

- 按波次（来自 Frontmatter）对计划进行分组，并按顺序执行波次
- 每个波次内的计划通过 Task 工具并行运行
- 可选的 `--wave N` 标志仅执行第 `N` 波次，并在执行后停止（除非阶段已完全完成）
- 在所有计划完成后验证阶段目标
- 更新 REQUIREMENTS.md, ROADMAP.md, STATE.md

用法：`/gsd:execute-phase 5`
用法：`/gsd:execute-phase 5 --wave 2`

### 智能路由

**`/gsd:do <描述>`**
自动将自由格式文本路由到正确的 GSD 命令。

- 分析自然语言输入以找到最匹配的 GSD 命令
- 作为调度器工作 —— 它本身从不执行具体工作
- 通过要求你在最匹配的选项中进行选择来解决歧义
- 当你知道自己想要什么但不知道运行哪个 `/gsd:*` 命令时使用

用法：`/gsd:do 修复登录按钮`
用法：`/gsd:do 重构身份验证系统`
用法：`/gsd:do 我想开始一个新的里程碑`

### 快速模式 (Quick Mode)

**`/gsd:quick [--full] [--discuss] [--research]`**
在拥有 GSD 保证的情况下执行小型临时任务，但跳过可选代理。

快速模式使用相同的系统，但路径更短：
- 生成规划器 (planner) + 执行器 (executor)（默认跳过研究员、检查员和验证器）
- 快速任务存储在 `.planning/quick/` 中，与已规划的阶段分开
- 更新 STATE.md 跟踪（不更新 ROADMAP.md）

标志位可启用额外的质量步骤：
- `--discuss` —— 在规划前进行轻量级讨论以发现模糊区域
- `--research` —— 专注的研究代理在规划前调查方法
- `--full` —— 添加计划检查（最多 2 次迭代）和执行后验证

标志位可组合使用：`--discuss --research --full` 为单个任务提供完整的质量流水线。

用法：`/gsd:quick`
用法：`/gsd:quick --research --full`
结果：创建 `.planning/quick/NNN-slug/PLAN.md`, `.planning/quick/NNN-slug/SUMMARY.md`

---

**`/gsd:fast [描述]`**
内联执行琐碎任务 —— 无子代理，无规划文件，无额外开销。

适用于规模太小而无需规划的任务：拼写错误修复、配置更改、遗忘的提交、简单的添加。在当前上下文中运行，进行更改并提交，然后记录到 STATE.md 中。

- 不创建 PLAN.md 或 SUMMARY.md
- 不生成子代理（内联运行）
- ≤ 3 个文件编辑 —— 如果任务不琐碎，将重定向到 `/gsd:quick`
- 带有约定式提交消息的原子提交

用法：`/gsd:fast "修复 README 中的拼写错误"`
用法：`/gsd:fast "将 .env 添加到 gitignore"`

### 路线图管理

**`/gsd:add-phase <描述>`**
在当前里程碑的末尾添加新阶段。

- 追加到 ROADMAP.md
- 使用下一个连续编号
- 更新阶段目录结构

用法：`/gsd:add-phase "添加管理员仪表板"`

**`/gsd:insert-phase <在...之后> <描述>`**
在现有阶段之间插入作为小数阶段的紧急工作。

- 创建中间阶段（例如，7 和 8 之间的 7.1）
- 适用于在里程碑中期发现的必须完成的工作
- 保持阶段顺序

用法：`/gsd:insert-phase 7 "修复关键身份验证漏洞"`
结果：创建阶段 7.1

**`/gsd:remove-phase <编号>`**
移除未来的阶段并重新对后续阶段编号。

- 删除阶段目录及其所有引用
- 对所有后续阶段重新编号以填补空隙
- 仅适用于未来的（未开始的）阶段
- Git 提交会保留历史记录

用法：`/gsd:remove-phase 17`
结果：阶段 17 被删除，阶段 18-20 变为 17-19

### 里程碑管理

**`/gsd:new-milestone <名称>`**
通过统一流程开始新的里程碑。

- 深入提问以了解你接下来的构建内容
- 可选的领域研究（生成 4 个并行的研究代理）
- 带有范围划分的需求定义
- 包含阶段划分的路线图创建
- 可选的 `--reset-phase-numbers` 标志重启从阶段 1 开始的编号，并出于安全考虑先存档旧的阶段目录

为旧项目（已有 PROJECT.md）镜像了 `/gsd:new-project` 流程。

用法：`/gsd:new-milestone "v2.0 功能"`
用法：`/gsd:new-milestone --reset-phase-numbers "v2.0 功能"`

**`/gsd:complete-milestone <版本>`**
存档已完成的里程碑并为下一个版本做准备。

- 在 MILESTONES.md 中创建带有统计信息的条目
- 将完整详情存档到 milestones/ 目录
- 为发布创建 Git 标签
- 为下一个版本准备工作区

用法：`/gsd:complete-milestone 1.0.0`

### 进度跟踪

**`/gsd:progress`**
检查项目状态并智能地路由到下一个操作。

- 显示视觉进度条和完成百分比
- 从 SUMMARY 文件中总结近期工作
- 显示当前位置和下一步计划
- 列出关键决策和未解决的问题
- 提供执行下一个计划或在缺失时创建计划的选项
- 检测里程碑是否 100% 完成

用法：`/gsd:progress`

### 会话管理

**`/gsd:resume-work`**
从上一个会话恢复工作并完整还原上下文。

- 从 STATE.md 读取项目上下文
- 显示当前位置和近期进度
- 根据项目状态提供后续操作建议

用法：`/gsd:resume-work`

**`/gsd:pause-work`**
在阶段中途暂停工作时创建上下文移交。

- 创建包含当前状态的 .continue-here 文件
- 更新 STATE.md 的会话连续性部分
- 捕捉正在进行的工作上下文

用法：`/gsd:pause-work`

### 调试 (Debugging)

**`/gsd:debug [问题描述]`**
在上下文重置期间保持持久状态的系统化调试。

- 通过自适应提问收集症状
- 创建 `.planning/debug/[slug].md` 来跟踪调查过程
- 使用科学方法进行调查（证据 → 假设 → 测试）
- 在执行 `/clear` 后仍能存续 —— 不带参数运行 `/gsd:debug` 即可恢复
- 将已解决的问题存档到 `.planning/debug/resolved/`

用法：`/gsd:debug "登录按钮不起作用"`
用法：`/gsd:debug`（恢复活跃会话）

### 快速笔记

**`/gsd:note <文本>`**
零摩擦的想法捕捉 —— 一个命令，瞬间保存，无需提问。

- 将带时间戳的笔记保存到 `.planning/notes/`（或全局保存到 `~/.claude/notes/`）
- 三个子命令：append（默认，追加）、list（列表）、promote（晋升）
- “晋升” 可将笔记转换为结构化的待办事项
- 无需项目即可工作（回退到全局范围）

用法：`/gsd:note 重构 hook 系统`
用法：`/gsd:note list`
用法：`/gsd:note promote 3`
用法：`/gsd:note --global 跨项目想法`

### 待办事项管理

**`/gsd:add-todo [描述]`**
将当前对话中的想法或任务捕捉为待办事项。

- 从对话中提取上下文（或使用提供的描述）
- 在 `.planning/todos/pending/` 中创建结构化的待办事项文件
- 根据文件路径推断区域以进行分组
- 在创建前检查是否重复
- 更新 STATE.md 的待办事项计数

用法：`/gsd:add-todo`（从对话推断）
用法：`/gsd:add-todo 添加身份验证令牌刷新`

**`/gsd:check-todos [区域]`**
列出挂起的待办事项并选择一个进行处理。

- 列出所有挂起的待办事项，包括标题、区域和创建时长
- 可选的区域过滤器（例如 `/gsd:check-todos api`）
- 为选定的待办事项加载完整上下文
- 路由到相应操作（立即执行、添加到阶段、头脑风暴）
- 开始工作后将待办事项移动到 done/

用法：`/gsd:check-todos`
用法：`/gsd:check-todos api`

### 用户验收测试 (UAT)

**`/gsd:verify-work [阶段]`**
通过对话式 UAT 验证已构建的功能。

- 从 SUMMARY.md 文件中提取可测试的交付物
- 一次呈现一个测试（是/否响应）
- 自动诊断失败原因并创建修复计划
- 如果发现问题，已准备好重新执行

用法：`/gsd:verify-work 3`

### 交付工作 (Ship Work)

**`/gsd:ship [阶段]`**
根据已完成的阶段工作创建一个带有自动生成正文的 PR。

- 将分支推送到远程
- 使用来自 SUMMARY.md, VERIFICATION.md, REQUIREMENTS.md 的摘要创建 PR
- 可选地请求代码审查
- 使用交付状态更新 STATE.md

前提条件：阶段已验证，已安装 `gh` CLI 并已通过身份验证。

用法：`/gsd:ship 4` 或 `/gsd:ship 4 --draft`

---

**`/gsd:review --phase N [--gemini] [--claude] [--codex] [--all]`**
跨 AI 同行评审 —— 调用外部 AI CLI 独立评审阶段计划。

- 检测可用的 CLI (gemini, claude, codex)
- 每个 CLI 使用相同的结构化提示词独立评审计划
- 生成 REVIEWS.md，包含每个评审者的反馈和共识摘要
- 将评审反馈回规划：`/gsd:plan-phase N --reviews`

用法：`/gsd:review --phase 3 --all`

---

**`/gsd:pr-branch [目标]`**
通过过滤掉 .planning/ 提交来为拉取请求创建一个干净的分支。

- 对提交进行分类：仅代码（包含）、仅规划（排除）、混合（包含但不含 .planning/）
- 将代码提交拣选 (cherry-pick) 到一个干净的分支上
- 评审者仅看到代码更改，看不到 GSD 产物

用法：`/gsd:pr-branch` 或 `/gsd:pr-branch main`

---

**`/gsd:plant-seed [想法]`**
捕捉一个前瞻性的想法，并附带自动浮现的触发条件。

- “种子”保留了 “为什么”、“何时浮现” 以及相关代码的路径
- 在触发条件匹配时，在 `/gsd:new-milestone` 期间自动浮现
- 优于延期项 —— 触发条件会被检查，而不会被遗忘

用法：`/gsd:plant-seed "当我们构建事件系统时添加实时通知"`

---

**`/gsd:audit-uat`**
跨阶段审计所有待处理的 UAT 和验证项。
- 扫描每个阶段中挂起、跳过、阻塞和 human_needed 的项目
- 交叉引用代码库以检测陈旧的文档
- 生成按可测试性分组的、排好优先级的候选人工测试计划
- 在开始新的里程碑之前使用，以清除验证债务

用法：`/gsd:audit-uat`

### 里程碑审计

**`/gsd:audit-milestone [版本]`**
对照原始意图审计里程碑完成情况。

- 阅读所有阶段的 VERIFICATION.md 文件
- 检查需求覆盖率
- 生成集成检查器用于跨阶段接线
- 创建包含缺口和技术债的 MILESTONE-AUDIT.md

用法：`/gsd:audit-milestone`

**`/gsd:plan-milestone-gaps`**
创建阶段以闭合审计发现的缺口。

- 阅读 MILESTONE-AUDIT.md 并将缺口分组到各个阶段
- 按需求优先级（必须/应该/可以）排序
- 将缺口闭合阶段添加到 ROADMAP.md
- 已准备好在各个新阶段执行 `/gsd:plan-phase`

用法：`/gsd:plan-milestone-gaps`

### 配置

**`/gsd:settings`**
交互式配置工作流开关和模型配置文件。

- 切换研究员、计划检查员、验证器代理
- 选择模型配置文件（质量/平衡/预算/继承）
- 更新 `.planning/config.json`

用法：`/gsd:settings`

**`/gsd:set-profile <配置文件>`**
快速切换 GSD 代理的模型配置文件。

- `quality` —— 除验证外全部使用 Opus
- `balanced` —— 规划使用 Opus，执行使用 Sonnet（默认）
- `budget` —— 编写使用 Sonnet，研究/验证使用 Haiku
- `inherit` —— 所有代理使用当前会话模型（OpenCode `/model`）

用法：`/gsd:set-profile budget`

### 工具命令

**`/gsd:cleanup`**
存档来自已完成里程碑的累积阶段目录。

- 识别已完成里程碑中仍在 `.planning/phases/` 中的阶段
- 在移动任何内容前显示预览摘要
- 将阶段目录移动到 `.planning/milestones/v{X.Y}-phases/`
- 在多个里程碑之后使用，以减少 `.planning/phases/` 的混乱

用法：`/gsd:cleanup`

**`/gsd:help`**
显示此命令参考。

**`/gsd:update`**
更新 GSD 到最新版本并预览变更日志。

- 显示已安装版本与最新版本的对比
- 显示你错过的版本的变更日志条目
- 突出显示重大变更
- 在运行安装前进行确认
- 优于原始的 `npx get-shit-dget-shit-done-cn

用法：`/gsd:update`

**`/gsd:join-discord`**
加入 GSD Discord 社区。

- 获取帮助、分享你正在构建的内容、保持更新
- 与其他 GSD 用户联系

用法：`/gsd:join-discord`

## 文件与结构

```
.planning/
├── PROJECT.md            # 项目愿景
├── ROADMAP.md            # 当前阶段划分
├── STATE.md              # 项目记忆与上下文
├── RETROSPECTIVE.md      # 活动回顾（按里程碑更新）
├── config.json           # 工作流模式与关口
├── todos/                # 捕捉的想法和任务
│   ├── pending/          # 等待处理的待办事项
│   └── done/             # 已完成的待办事项
├── debug/                # 活跃的调试会话
│   └── resolved/         # 存档的已解决问题
├── milestones/
│   ├── v1.0-ROADMAP.md       # 存档的路线图快照
│   ├── v1.0-REQUIREMENTS.md  # 存档的需求
│   └── v1.0-phases/          # 存档的阶段目录（通过 /gsd:cleanup 或 --archive-phases）
│       ├── 01-foundation/
│       └── 02-core-features/
├── codebase/             # 代码库映射（旧项目）
│   ├── STACK.md          # 语言、框架、依赖
│   ├── ARCHITECTURE.md   # 模式、层级、数据流
│   ├── STRUCTURE.md      # 目录布局、关键文件
│   ├── CONVENTIONS.md    # 编码标准、命名规范
│   ├── TESTING.md        # 测试设置、模式
│   ├── INTEGRATIONS.md   # 外部服务、API
│   └── CONCERNS.md       # 技术债、已知问题
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

## 工作流模式

在 `/gsd:new-project` 期间设置：

**交互模式 (Interactive Mode)**

- 确认每个重大决策
- 在检查点暂停以供批准
- 在整个过程中提供更多指导

**YOLO 模式 (YOLO Mode)**

- 自动批准大多数决策
- 无需确认直接执行计划
- 仅在关键检查点停止

随时通过编辑 `.planning/config.json` 进行更改。

## 规划配置

在 `.planning/config.json` 中配置规划产物的管理方式：

**`planning.commit_docs`**（默认：`true`）
- `true`：规划产物提交到 Git（标准工作流）
- `false`：规划产物仅保留在本地，不提交

**`workflow.auto_commit`**（默认：`true`）
- `true`：执行阶段完成每个任务后自动执行 git commit（标准工作流）
- `false`：跳过自动提交，仅输出变更摘要供用户手动提交

当 `commit_docs: false` 时：
- 将 `.planning/` 添加到你的 `.gitignore`
- 适用于开源贡献、客户项目或保持规划私密性
- 所有规划文件仍正常工作，只是不被 Git 跟踪

**`planning.search_gitignored`**（默认：`false`）
- `true`：在广泛的 ripgrep 搜索中添加 `--no-ignore`
- 仅当 `.planning/` 被 Git 忽略且你希望项目范围内的搜索包含它时需要

示例配置：
```json
{
  "planning": {
    "commit_docs": false,
    "search_gitignored": true
  }
}
```

## 常见工作流

**开始新项目：**

```
/gsd:new-project        # 统一流程：提问 → 研究 → 需求 → 路线图
/clear
/gsd:plan-phase 1       # 为第一阶段创建计划
/clear
/gsd:execute-phase 1    # 执行阶段中的所有计划
```

**休息后恢复工作：**

```
/gsd:progress  # 查看你上次离开的地方并继续
```

**在里程碑中期添加紧急工作：**

```
/gsd:insert-phase 5 "关键安全修复"
/gsd:plan-phase 5.1
/gsd:execute-phase 5.1
```

**完成里程碑：**

```
/gsd:complete-milestone 1.0.0
/clear
/gsd:new-milestone  # 开始下一个里程碑（提问 → 研究 → 需求 → 路线图）
```

**在工作期间捕捉想法：**

```
/gsd:add-todo                    # 从对话上下文中捕捉
/gsd:add-todo 修复模态框 z-index  # 通过显式描述捕捉
/gsd:check-todos                 # 查看并处理待办事项
/gsd:check-todos api             # 按区域过滤
```

**调试问题：**

```
/gsd:debug "表单提交静默失败"  # 开始调试会话
# ... 调查进行中，上下文逐渐填满 ...
/clear
/gsd:debug                    # 从上次中断的地方恢复
```

## 获取帮助

- 阅读 `.planning/PROJECT.md` 了解项目愿景
- 阅读 `.planning/STATE.md` 了解当前上下文
- 检查 `.planning/ROADMAP.md` 了解阶段状态
- 运行 `/gsd:progress` 检查你目前的进度
</reference>