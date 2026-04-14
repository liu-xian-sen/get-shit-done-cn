<purpose>
生成、更新和验证所有项目文档——包括规范文档类型和现有手写文档。编排器检测项目的文档结构，组装一个跟踪每个条目的工作清单，在多波次中并行调度文档写入 Agent 和文档验证 Agent，审查现有文档的准确性，识别文档缺口，并通过有限的修复循环纠正不准确内容。所有状态都持久化在工作清单中，以免在步骤间丢失任何工作项。输出：经过实时代码库验证的完整、结构感知文档。
</purpose>

<available_agent_types>
有效的 GSD 子 Agent 类型（请使用确切名称——不要退化为 'general-purpose'）：
- gsd-doc-writer — 写入和更新项目文档文件
- gsd-doc-verifier — 对照实时代码库验证文档中的事实声明
</available_agent_types>

<process>

<step name="init_context" priority="first">
加载 docs-update 上下文：

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" docs-init)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-doc-writer 2>/dev/null)
```

从 init JSON 中提取：
- `doc_writer_model` — 传递给每个生成 Agent 的模型字符串（不要硬编码模型名称）
- `commit_docs` — 完成后是否提交生成的文件
- `existing_docs` — 现有 Markdown 文件的 `{path, has_gsd_marker}` 对象数组
- `project_type` — 包含布尔信号的对象：`has_package_json`、`has_api_routes`、`has_cli_bin`、`is_open_source`、`has_deploy_config`、`is_monorepo`、`has_tests`
- `doc_tooling` — 包含布尔值的对象：`docusaurus`、`vitepress`、`mkdocs`、`storybook`
- `monorepo_workspaces` — 工作区 glob 模式数组（非 monorepo 则为空）
- `project_root` — 项目根目录的绝对路径
</step>

<step name="classify_project">
将 init JSON 中的 `project_type` 布尔信号映射到主类型标签，并收集条件文档信号。

**主类型分类（第一个匹配优先）：**

| 条件 | primary_type |
|------|-------------|
| `is_monorepo` 为 true | `"monorepo"` |
| `has_cli_bin` 为 true 且 `has_api_routes` 为 false | `"cli-tool"` |
| `has_api_routes` 为 true 且 `is_open_source` 为 false | `"saas"` |
| `is_open_source` 为 true 且 `has_api_routes` 为 false | `"open-source-library"` |
| （以上都不满足） | `"generic"` |

**条件文档信号（D-02 并集规则——在主类型分类后独立检查）：**

确定 primary_type 后，独立检查每个信号，不受主类型限制。同时是开源且有 API 路由的 CLI 工具仍会获得全部三个条件文档。

| 信号 | 条件文档 |
|------|---------|
| `has_api_routes` 为 true | 加入队列 API.md |
| `is_open_source` 为 true | 加入队列 CONTRIBUTING.md |
| `has_deploy_config` 为 true | 加入队列 DEPLOYMENT.md |

呈现分类结果：
```
项目类型：{primary_type}
已加入队列的条件文档：{列表或"无"}
```
</step>

<step name="build_doc_queue">
从始终启用的文档加上 classify_project 中的条件文档组装完整的文档队列。

**始终启用的文档（为每个项目加入队列，无例外）：**
1. README
2. ARCHITECTURE
3. GETTING-STARTED
4. DEVELOPMENT
5. TESTING
6. CONFIGURATION

**条件文档（仅在 classify_project 中信号匹配时添加）：**
- API（如果 `has_api_routes`）
- CONTRIBUTING（如果 `is_open_source`）
- DEPLOYMENT（如果 `has_deploy_config`）

**重要：CHANGELOG.md 永远不会加入队列。文档队列仅从上述 9 种已知文档类型构建。不要直接从 `existing_docs` 推导队列——existing_docs 仅在下一步中用于确定创建还是更新模式。**

**文档队列限制：** 最多 9 个文档。始终启用（6）+ 最多 3 个条件 = 最多 9 个。

**CONTRIBUTING.md 确认（仅限新文件）：**

如果 CONTRIBUTING.md 在条件队列中且在 init JSON 的 `existing_docs` 数组中不存在：

1. 如果 `$ARGUMENTS` 中存在 `--force`：跳过此检查，将 CONTRIBUTING.md 加入队列。

**文本模式（配置中 `workflow.text_mode: true` 或 `--text` 标志）：** 如果 `$ARGUMENTS` 中存在 `--text` 或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当 TEXT_MODE 激活时，将每次 `AskUserQuestion` 调用替换为纯文本编号列表，并请用户键入选择编号。这对于 `AskUserQuestion` 不可用的非 Claude 运行时（OpenAI Codex、Gemini CLI 等）是必需的。
2. 否则，使用 AskUserQuestion 确认：

```
AskUserQuestion([{
  question: "该项目似乎是开源的（检测到 LICENSE 文件）。CONTRIBUTING.md 尚不存在。您想创建一个吗？",
  header: "贡献指南",
  multiSelect: false,
  options: [
    { label: "是的，创建它", description: "生成包含项目指南的 CONTRIBUTING.md" },
    { label: "不，跳过", description: "此项目不需要 CONTRIBUTING.md" }
  ]
}])
```

如果用户选择"不，跳过"：从文档队列中移除 CONTRIBUTING.md。
如果 CONTRIBUTING.md 已存在于 `existing_docs`：完全跳过此提示，将其加入更新队列。

**现有非规范文档（审查队列）：**

组装上述规范文档队列后，扫描 init JSON 中的 `existing_docs` 数组，查找不匹配队列中任何规范路径（既不是主路径也不是 resolve_modes 表中的备用路径）的文件。这些是手写文档，如 `docs/api/endpoint-map.md` 或 `docs/frontend/pages/not-found.md`。

对于每个找到的非规范现有文档：
- 添加到单独的 `review_queue`
- 这些将在 verify_docs 步骤中传递给 gsd-doc-verifier 进行准确性检查
- 如果发现不准确，将在 `fix` 模式下调度给 gsd-doc-writer 进行精确纠正

如果找到非规范文档，在队列呈现中显示：

```
已加入准确性审查队列的现有文档：
  - docs/api/endpoint-map.md（手写）
  - docs/api/README.md（手写）
  - docs/frontend/pages/not-found.md（手写）
```

如果未找到，从队列呈现中省略此部分。

**文档缺口检测（缺失的非规范文档）：**

组装规范和审查队列后，分析代码库以识别应有文档但没有文档的区域。这确保命令创建完整的项目文档，而不仅仅是 9 种规范类型。

1. **扫描代码库中未记录的区域：**
   - 使用 Glob/Grep 发现重要源目录（例如 `src/components/`、`src/pages/`、`src/services/`、`src/api/`、`lib/`、`routes/`）
   - 与现有文档比较：对于每个主要源目录，检查文档树中是否存在相应文档
   - 查看项目现有的文档结构寻找模式——如果项目有 `docs/frontend/components/`、`docs/services/` 等，这些表明项目的文档约定

2. **基于项目约定识别缺口：**
   - 如果项目有带分组子目录的 `docs/` 目录，则每个有对应文档子目录但缺少文档文件的源模块区域都代表一个缺口
   - 如果项目有前端组件/页面但没有组件文档，标记这一点
   - 如果项目有服务模块但没有服务文档，标记这一点
   - 跳过规范文档已覆盖的区域（例如，如果 `docs/API.md` 已在规范队列中，不要标记缺少 API 文档）

3. **向用户呈现发现的缺口：**

```
AskUserQuestion([{
  question: "在代码库中发现了 {N} 个文档缺口。应该创建哪些？",
  header: "文档缺口",
  multiSelect: true,
  options: [
    { label: "{区域}", description: "{为什么需要文档——例如，'src/components/ 中有 5 个组件没有文档'}" },
    ...最多 4 个选项（如果超过 4 个则将相关缺口分组）
  ]
}])
```

4. 对于用户选择的每个缺口：
   - 以模式 = `"create"` 添加到生成队列
   - 将输出路径设置为匹配项目现有文档目录结构
   - gsd-doc-writer 将收到一个 `doc_assignment`，其中 `type: "custom"` 和对要记录内容的描述，使用项目源文件作为内容发现目标

如果未检测到缺口，完全省略此部分。

在继续之前向用户呈现组装好的队列：

呈现来自 resolve_modes 的模式解析表（如上所示），然后：

```
{如果找到非规范文档，以表格形式显示：}

已加入准确性审查队列的现有文档：

| 路径 | 类型 |
|------|------|
| {path} | 手写 |
| ... | ... |

CHANGELOG.md：已排除（超出范围）
```

模式解析表就是队列呈现——它显示每个文档的解析路径、模式和来源。不要以单独的格式重复列表。

然后使用 AskUserQuestion 确认：

```
AskUserQuestion([{
  question: "文档队列已组装（{N} 个文档）。是否继续生成？",
  header: "文档队列",
  multiSelect: false,
  options: [
    { label: "继续", description: "生成队列中的所有 {N} 个文档" },
    { label: "中止", description: "取消文档生成" }
  ]
}])
```

如果用户选择"中止"：退出工作流。否则继续到 resolve_modes。
</step>

<step name="resolve_modes">
对于组装队列中的每个文档，确定是创建（新文件）还是更新（现有文件）。

**文档类型到规范路径的映射（默认值）：**

| 类型 | 默认路径 | 备用路径 |
|------|---------|---------|
| `readme` | `README.md` | — |
| `architecture` | `docs/ARCHITECTURE.md` | `ARCHITECTURE.md` |
| `getting_started` | `docs/GETTING-STARTED.md` | `GETTING-STARTED.md` |
| `development` | `docs/DEVELOPMENT.md` | `DEVELOPMENT.md` |
| `testing` | `docs/TESTING.md` | `TESTING.md` |
| `api` | `docs/API.md` | `API.md` |
| `configuration` | `docs/CONFIGURATION.md` | `CONFIGURATION.md` |
| `deployment` | `docs/DEPLOYMENT.md` | `DEPLOYMENT.md` |
| `contributing` | `CONTRIBUTING.md` | — |

**结构感知路径解析：**

在应用默认路径表之前，检查项目现有的文档目录结构，以检测项目使用**分组子目录**还是**平铺文件**。这决定了所有新文档的放置方式。

**步骤 1：检测项目的文档组织模式。**

从 `existing_docs` 路径中列出 `docs/` 下的子目录。如果项目有 2+ 个子目录（例如 `docs/architecture/`、`docs/api/`、`docs/guides/`、`docs/frontend/`），则项目使用**分组结构**。如果文档只是直接在 `docs/` 中的平铺文件（例如 `docs/ARCHITECTURE.md`），则使用**平铺结构**。

**步骤 2：根据检测到的模式解析路径。**

**如果检测到分组结构：**

每种文档类型必须放在适当的子目录中——当项目组织为分组时，没有文档应该留在 `docs/` 的平铺层。使用以下解析逻辑：

| 类型 | 子目录解析（按优先级顺序） |
|------|--------------------------|
| `architecture` | 现有 `docs/architecture/` → 如不存在则创建 `docs/architecture/` |
| `getting_started` | 现有 `docs/guides/` → 现有 `docs/getting-started/` → 创建 `docs/guides/` |
| `development` | 现有 `docs/guides/` → 现有 `docs/development/` → 创建 `docs/guides/` |
| `testing` | 现有 `docs/testing/` → 现有 `docs/guides/` → 创建 `docs/testing/` |
| `api` | 现有 `docs/api/` → 如不存在则创建 `docs/api/` |
| `configuration` | 现有 `docs/configuration/` → 现有 `docs/guides/` → 创建 `docs/configuration/` |
| `deployment` | 现有 `docs/deployment/` → 现有 `docs/guides/` → 创建 `docs/deployment/` |

对于每种类型，从左到右检查解析链。使用第一个现有子目录。如果都不存在，创建最右边的选项。

子目录中的文件名应具有上下文意义——例如 `docs/guides/getting-started.md`、`docs/architecture/overview.md`、`docs/api/reference.md`——而非 `docs/architecture/ARCHITECTURE.md`。匹配该子目录中现有文件的命名风格（小写连字符、大写等）。

**如果检测到平铺结构（或没有 docs/ 目录）：**

按原样使用上述默认路径表（例如 `docs/ARCHITECTURE.md`、`docs/TESTING.md`）。

**步骤 3：存储每个解析路径并创建目录。**

对于每种文档类型，将解析路径存储为 `resolved_path`。然后创建所有必要的目录：
```bash
mkdir -p {来自解析路径的每个唯一目录}
```

**模式解析逻辑：**

对于队列中的每种文档类型：
1. 检查 `resolved_path` 是否出现在 init JSON 的 `existing_docs` 数组中
2. 如果在解析路径未找到，检查表中的默认和备用路径
3. 如果在任何路径找到：模式 = `"update"` — 使用 Read 工具加载当前文件内容（将作为 doc_assignment 块中的 `existing_content` 传递）。使用找到的路径作为输出路径（不要移动现有文档）。
4. 如果未找到：模式 = `"create"` — 无需加载现有内容。使用 `resolved_path`。

**确保 docs/ 目录存在：**
在继续下一步之前，如果 docs/ 目录和任何解析的子目录不存在，则创建它们：
```bash
mkdir -p docs/
```

**输出模式解析表：**

呈现一个表，显示队列中每个文档的解析路径、模式和来源：

```
模式解析：

| 文档 | 解析路径 | 模式 | 来源 |
|------|---------|------|------|
| readme | README.md | update | 在 README.md 找到 |
| architecture | docs/architecture/overview.md | create | 新目录 |
| getting_started | docs/guides/getting-started.md | update | 已找到，手写 |
| development | docs/guides/development.md | create | 匹配 docs/guides/ |
| testing | docs/guides/testing.md | create | 匹配 docs/guides/ |
| configuration | docs/guides/configuration.md | create | 匹配 docs/guides/ |
| api | docs/api/reference.md | create | 新目录 |
| deployment | docs/guides/deployment.md | update | 已找到，手写 |
```

此表必须向用户显示——这是文件写入位置以及现有文件是否会更新的主要确认。它作为队列呈现的一部分出现在 AskUserQuestion 确认之前。

跟踪每个已加入队列文档的解析模式和文件路径。对于更新模式的文档，存储加载的文件内容——它将在后续步骤中传递给 Agent。

**关键：持久化工作清单。**

resolve_modes 完成后，将所有工作项写入 `.planning/tmp/docs-work-manifest.json`。这是后续每个步骤的唯一真实来源——编排器必须在每个步骤读取此文件，而不是依赖记忆。

```bash
mkdir -p .planning/tmp
```

使用 Write 工具写入清单：

```json
{
  "canonical_queue": [
    {
      "type": "readme",
      "resolved_path": "README.md",
      "mode": "create|update|supplement",
      "preservation_mode": null,
      "wave": 1,
      "status": "pending"
    }
  ],
  "review_queue": [
    {
      "path": "docs/frontend/components/button.md",
      "type": "hand-written",
      "status": "pending_review"
    }
  ],
  "gap_queue": [
    {
      "description": "src/components/ 中的前端组件",
      "output_path": "docs/frontend/components/overview.md",
      "status": "pending"
    }
  ],
  "created_at": "{ISO 时间戳}"
}
```

后续每个步骤（dispatch、collect、verify、fix_loop、report）都必须先读取 `.planning/tmp/docs-work-manifest.json`，并更新其处理的条目的 `status` 字段。这防止编排器在多步骤工作流中"忘记"任何工作项。
</step>

<step name="preservation_check">
检查队列中的手写文档，并在调度前收集用户决策。

**跳过条件（按顺序检查）：**

1. 如果 `$ARGUMENTS` 中存在 `--force`：将所有文档视为模式：regenerate，跳到 detect_runtime_capabilities。
2. 如果 `$ARGUMENTS` 中存在 `--verify-only`：跳到 verify_only_report（不继续到 detect_runtime_capabilities）。
3. 如果队列中没有文档在 `existing_docs` 数组中 `has_gsd_marker: false`：跳到 detect_runtime_capabilities。

**对于每个 `has_gsd_marker` 为 false 的已加入队列文档（检测到手写文档）：**

如果可用，使用 `AskUserQuestion` 呈现以下选择，否则使用内联提示：

```
{filename} 似乎是手写的（未找到 GSD 标记）。

应该如何处理此文件？
  [1] preserve    -- 完全跳过。保持不变。
  [2] supplement  -- 仅附加缺失的部分。现有内容不变。
  [3] regenerate  -- 用全新的 GSD 生成文档覆盖。
```

记录每个决策。更新文档队列：
- `preserve` 决策：完全从队列中移除该文档
- `supplement` 决策：在 doc_assignment 块中将模式设置为 `supplement`；包含 `existing_content`（完整文件内容）
- `regenerate` 决策：将模式设置为 `create`（视为全新写入）

**当 AskUserQuestion 不可用时的回退：** 默认所有手写文档为 `preserve`（最安全的默认值）。显示消息：

```
AskUserQuestion 不可用——手写文档默认保留。
使用 --force 重新生成所有文档，或在 Claude Code 中重新运行以获得逐文件提示。
```

所有决策记录后，继续到 detect_runtime_capabilities。
</step>

<!-- 如果运行时不可用 Task 工具，跳过 dispatch/collect 波次，使用 sequential_generation 代替。-->

<step name="dispatch_wave_1" condition="Task 工具可用">
**首先读取工作清单：** `Read .planning/tmp/docs-work-manifest.json` — 使用此步骤中 `wave: 1` 的 `canonical_queue` 条目。

为波次 1 文档生成 3 个并行 gsd-doc-writer Agent：README、ARCHITECTURE、CONFIGURATION。

这些是没有交叉引用需求的基础文档，非常适合并行生成。

对所有三个使用 `run_in_background=true` 以启用并行执行。

**Agent 1：README**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="为目标项目生成 README.md",
  prompt="<doc_assignment>
type: readme
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | （如果模式是 update 或 supplement，在此处包含完整文件内容，否则省略此行）}
</doc_assignment>

{AGENT_SKILLS}

直接写入文档文件。仅返回确认——不要返回文档内容。"
)
```

**Agent 2：ARCHITECTURE**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="为目标项目生成 ARCHITECTURE.md",
  prompt="<doc_assignment>
type: architecture
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | （如果模式是 update 或 supplement，在此处包含完整文件内容，否则省略此行）}
</doc_assignment>

{AGENT_SKILLS}

直接写入文档文件。仅返回确认——不要返回文档内容。"
)
```

**Agent 3：CONFIGURATION**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="为目标项目生成 CONFIGURATION.md",
  prompt="<doc_assignment>
type: configuration
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | （如果模式是 update 或 supplement，在此处包含完整文件内容，否则省略此行）}
note: 对存储库中无法发现的任何基础设施声明应用 VERIFY 标记。
</doc_assignment>

{AGENT_SKILLS}

直接写入文档文件。仅返回确认——不要返回文档内容。"
)
```

**关键：** Agent 提示必须仅包含 `<doc_assignment>` 块、`${AGENT_SKILLS}` 变量和返回指令。不要在 Agent 提示中包含项目规划上下文、工作流说明或任何内部工具引用。

继续到 collect_wave_1。
</step>

<step name="collect_wave_1">
**首先读取工作清单：** `Read .planning/tmp/docs-work-manifest.json` — 收集后将每个波次 1 条目的 `status` 更新为 `"completed"` 或 `"failed"`。将更新后的清单写回磁盘。

使用 TaskOutput 工具等待所有 3 个波次 1 Agent 完成。

并行调用所有 3 个 Agent 的 TaskOutput（单条消息包含 3 个 TaskOutput 调用）：

```
TaskOutput 工具：
  task_id: "{README agent 结果中的 task_id}"
  block: true
  timeout: 300000

TaskOutput 工具：
  task_id: "{ARCHITECTURE agent 结果中的 task_id}"
  block: true
  timeout: 300000

TaskOutput 工具：
  task_id: "{CONFIGURATION agent 结果中的 task_id}"
  block: true
  timeout: 300000
```

**每个 Agent 的预期确认格式：**
```
## 文档生成完成
**类型：** {type}
**模式：** {mode}
**已写入文件：** `{path}`（{N} 行）
准备好供编排器汇总。
```

**收集后，使用每个清单条目中的 `resolved_path` 验证波次 1 文件是否存在于磁盘上：**
```bash
ls -la {resolved_path_1} {resolved_path_2} {resolved_path_3} 2>/dev/null
```

如果任何 Agent 失败或其文件缺失：
- 记录失败
- 继续处理成功的文档（不要因单个失败而停止波次 2）
- 缺失的文档将在最终报告中注明

继续到 dispatch_wave_2。
</step>

<step name="dispatch_wave_2" condition="Task 工具可用">
**首先读取工作清单：** `Read .planning/tmp/docs-work-manifest.json` — 使用此步骤中 `wave: 2` 的 `canonical_queue` 条目。

为所有已加入队列的波次 2 文档生成 Agent：GETTING-STARTED、DEVELOPMENT、TESTING，以及在 build_doc_queue 中加入队列的任何条件文档（API、DEPLOYMENT、CONTRIBUTING）。

波次 2 Agent 可以引用波次 1 输出进行交叉引用——在每个 doc_assignment 块中包含 `wave_1_outputs` 字段。

对所有波次 2 Agent 使用 `run_in_background=true` 以在该波次中启用并行执行。

**Agent：GETTING-STARTED**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="为目标项目生成 GETTING-STARTED.md",
  prompt="<doc_assignment>
type: getting_started
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | （如果模式是 update 或 supplement，在此处包含完整文件内容，否则省略此行）}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

直接写入文档文件。仅返回确认——不要返回文档内容。"
)
```

**Agent：DEVELOPMENT**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="为目标项目生成 DEVELOPMENT.md",
  prompt="<doc_assignment>
type: development
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | （如果模式是 update 或 supplement，在此处包含完整文件内容，否则省略此行）}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

直接写入文档文件。仅返回确认——不要返回文档内容。"
)
```

**Agent：TESTING**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="为目标项目生成 TESTING.md",
  prompt="<doc_assignment>
type: testing
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | （如果模式是 update 或 supplement，在此处包含完整文件内容，否则省略此行）}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

直接写入文档文件。仅返回确认——不要返回文档内容。"
)
```

**条件 Agent：API**（仅当 `has_api_routes` 为 true——仅在 API.md 已加入队列时生成）

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="为目标项目生成 API.md",
  prompt="<doc_assignment>
type: api
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | （如果模式是 update 或 supplement，在此处包含完整文件内容，否则省略此行）}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

直接写入文档文件。仅返回确认——不要返回文档内容。"
)
```

**条件 Agent：DEPLOYMENT**（仅当 `has_deploy_config` 为 true——仅在 DEPLOYMENT.md 已加入队列时生成）

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="为目标项目生成 DEPLOYMENT.md",
  prompt="<doc_assignment>
type: deployment
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | （如果模式是 update 或 supplement，在此处包含完整文件内容，否则省略此行）}
note: 对存储库中无法发现的任何基础设施声明应用 VERIFY 标记。
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

直接写入文档文件。仅返回确认——不要返回文档内容。"
)
```

**条件 Agent：CONTRIBUTING**（仅当 `is_open_source` 为 true——仅在 CONTRIBUTING.md 已加入队列时生成）

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="为目标项目生成 CONTRIBUTING.md",
  prompt="<doc_assignment>
type: contributing
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | （如果模式是 update 或 supplement，在此处包含完整文件内容，否则省略此行）}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

直接写入文档文件。仅返回确认——不要返回文档内容。"
)
```

**关键：** Agent 提示必须仅包含 `<doc_assignment>` 块、`${AGENT_SKILLS}` 变量和返回指令。不要在 Agent 提示中包含项目规划上下文、工作流说明或任何内部工具引用。

继续到 collect_wave_2。
</step>

<step name="collect_wave_2">
**首先读取工作清单：** `Read .planning/tmp/docs-work-manifest.json` — 收集后将每个波次 2 条目的 `status` 更新为 `"completed"` 或 `"failed"`。将更新后的清单写回磁盘。

使用 TaskOutput 工具等待所有波次 2 Agent 完成。

并行调用所有波次 2 Agent 的 TaskOutput（单条消息包含 N 个 TaskOutput 调用——每个已生成的波次 2 Agent 一个）：

```
TaskOutput 工具：
  task_id: "{GETTING-STARTED agent 结果中的 task_id}"
  block: true
  timeout: 300000

TaskOutput 工具：
  task_id: "{DEVELOPMENT agent 结果中的 task_id}"
  block: true
  timeout: 300000

TaskOutput 工具：
  task_id: "{TESTING agent 结果中的 task_id}"
  block: true
  timeout: 300000

# 为每个已生成的条件 Agent 添加一个 TaskOutput 调用（API、DEPLOYMENT、CONTRIBUTING）
```

**收集后，使用每个清单条目中的 `resolved_path` 验证所有波次 2 文件是否存在于磁盘上：**
```bash
ls -la {每个波次 2 条目的 resolved_path} 2>/dev/null
```

如果任何 Agent 失败或其文件缺失，记录失败并继续。缺失的文档将在最终报告中报告。

继续到 dispatch_monorepo_packages（如果 monorepo_workspaces 非空）或 commit_docs。
</step>

<step name="dispatch_monorepo_packages" condition="monorepo_workspaces 非空">
波次 2 收集后，为每个 monorepo 工作区生成每包 README。

**条件：** 仅当 init JSON 中的 `monorepo_workspaces` 非空时运行此步骤。

**从 glob 模式解析工作区包：**

```bash
# 将工作区 glob 扩展为实际包目录
for pattern in {monorepo_workspaces}; do
  ls -d $pattern 2>/dev/null
done
```

**对于每个包含 `package.json` 的已解析目录：**

确定模式：
- 如果 `{package_dir}/README.md` 存在：模式 = `update`，读取现有内容
- 否则：模式 = `create`

生成一个带有 `run_in_background=true` 的 `gsd-doc-writer` Agent：

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="为 {package_dir} 生成每包 README",
  prompt="<doc_assignment>
type: readme
mode: {create|update}
scope: per_package
package_dir: {包目录的绝对路径}
project_context: {将 project_root 设置为包目录的 INIT JSON}
{existing_content: | （如果模式是 update，在此处包含完整 README.md 内容，否则省略）}
</doc_assignment>

{AGENT_SKILLS}

直接写入 {package_dir}/README.md。仅返回确认——不要返回文档内容。"
)
```

通过 TaskOutput 收集所有包 Agent 的确认。在最终报告中注明失败。

**当 Task 工具不可用时的回退：** 在 `sequential_generation` 步骤之后按顺序内联生成每包 README。对于每个包含 `package.json` 的包目录，构建等效的 `doc_assignment` 块，并按照 gsd-doc-writer 指令生成 README。

继续到 commit_docs。
</step>

<step name="sequential_generation" condition="Task 工具不可用（例如 Antigravity、Gemini CLI、Codex、Copilot）">
**首先读取工作清单：** `Read .planning/tmp/docs-work-manifest.json` — 使用 `canonical_queue` 条目确定生成顺序。每个文档生成后更新 `status`。所有文档完成后将更新后的清单写回磁盘。

当 `Task` 工具不可用时，在当前上下文中按顺序生成文档。此步骤替代 dispatch_wave_1、collect_wave_1、dispatch_wave_2 和 collect_wave_2。

**重要：** 不要使用 `browser_subagent`、`Explore` 或任何基于浏览器的工具。仅使用文件系统工具（Read、Bash、Write、Grep、Glob 或运行时中可用的等效工具）。

开始前读取一次 `agents/gsd-doc-writer.md` 指令。按照该 Agent 的 create_mode 或 update_mode 指令，使用与并行路径相同的 doc_assignment 字段处理每个文档。

**波次 1（按顺序——在开始波次 2 之前完成所有三个）：**

对于每个波次 1 文档，构建等效的 doc_assignment 块并内联生成文件：

1. **README** — 来自 resolve_modes 的模式；对于 update/supplement 模式，包含 existing_content
   - 构建 doc_assignment：`type: readme`、`mode: {create|update|supplement}`、`preservation_mode: {value|null}`、`project_context: {INIT JSON}`、`existing_content:`（如果 update/supplement）
   - 按照 gsd-doc-writer create_mode / update_mode 指令探索代码库（Read、Grep、Glob、Bash）
   - 将文件写入解析路径（README.md）

2. **ARCHITECTURE** — 来自 resolve_modes 的模式；对于 update/supplement 模式，包含 existing_content
   - 构建 doc_assignment：`type: architecture`、`mode: {create|update|supplement}`、`preservation_mode: {value|null}`、`project_context: {INIT JSON}`、`existing_content:`（如果 update/supplement）
   - 按照 gsd-doc-writer 指令探索代码库
   - 将文件写入解析路径（docs/ARCHITECTURE.md，或如果在根目录找到则为 ARCHITECTURE.md）

3. **CONFIGURATION** — 来自 resolve_modes 的模式；对于 update/supplement 模式，包含 existing_content
   - 构建 doc_assignment：`type: configuration`、`mode: {create|update|supplement}`、`preservation_mode: {value|null}`、`project_context: {INIT JSON}`、`existing_content:`（如果 update/supplement）
   - 对存储库中无法发现的任何基础设施声明应用 VERIFY 标记
   - 按照 gsd-doc-writer 指令探索代码库
   - 将文件写入解析路径（docs/CONFIGURATION.md，或如果在根目录找到则为 CONFIGURATION.md）

**波次 2（按顺序——仅在所有波次 1 文档写入后开始）：**

波次 2 文档可以引用波次 1 输出，因为它们已经写入。在每个 doc_assignment 中包含 `wave_1_outputs`。

4. **GETTING-STARTED** — 来自 resolve_modes 的模式；包含 wave_1_outputs：[README.md, docs/ARCHITECTURE.md, docs/CONFIGURATION.md]
5. **DEVELOPMENT** — 来自 resolve_modes 的模式；包含 wave_1_outputs
6. **TESTING** — 来自 resolve_modes 的模式；包含 wave_1_outputs
7. **API**（仅在已加入队列时）— 来自 resolve_modes 的模式；包含 wave_1_outputs
8. **DEPLOYMENT**（仅在已加入队列时）— 对存储库中无法发现的任何基础设施声明应用 VERIFY 标记；包含 wave_1_outputs
9. **CONTRIBUTING**（仅在已加入队列时）— 来自 resolve_modes 的模式；包含 wave_1_outputs

**Monorepo 每包 README（仅当 `monorepo_workspaces` 非空时）：**

写入所有 9 个根级文档后，按顺序生成每包 README：

对于每个已解析的包目录（来自工作区 glob 扩展）包含 `package.json`：
- 确定模式：如果 `{package_dir}/README.md` 存在，模式 = `update`；否则模式 = `create`
- 构建 doc_assignment：`type: readme`、`mode: {create|update}`、`scope: per_package`、`package_dir: {绝对路径}`、`project_context: {将 project_root 设置为包目录的 INIT JSON}`、`existing_content:`（如果 update）
- 按照 gsd-doc-writer 的 per_package 范围指令处理
- 将文件写入 `{package_dir}/README.md`

继续到 verify_docs。
</step>

<step name="verify_docs">
对照实时代码库验证所有文档中的事实声明——包括规范文档（已生成）和非规范文档（现有手写文档）。

**关键：首先读取工作清单。**

```
Read .planning/tmp/docs-work-manifest.json
```

提取 `canonical_queue`（`status: "completed"` 的条目）和 `review_queue`（`status: "pending_review"` 的条目）。两个队列都在此步骤中验证。

**跳过条件：** 如果 `$ARGUMENTS` 中存在 `--verify-only`，此步骤已由 `verify_only_report` 处理（提前退出）。跳过。

**阶段 1：验证规范文档（已生成/更新的文档）**

对于 `canonical_queue` 中每个成功写入磁盘的文档：

1. 使用 `<verify_assignment>` 块生成 `gsd-doc-verifier` Agent（或者如果 Task 工具不可用则按顺序调用）：
   ```xml
   <verify_assignment>
   doc_path: {文档文件的相对路径，例如 README.md}
   project_root: {来自 init JSON 的 project_root}
   </verify_assignment>
   ```

2. 验证器完成后，从 `.planning/tmp/verify-{doc_filename}.json` 读取结果 JSON。

3. 更新清单：为每个已处理的规范文档将 `status` 设置为 `"verified"`。

**阶段 2：验证非规范文档（现有手写文档）**

这不是可选的。`review_queue` 中的每个文档都必须验证。

对于清单中 `review_queue` 中的每个文档：

1. 使用与上述相同的 `<verify_assignment>` 块生成 `gsd-doc-verifier` Agent。
2. 从 `.planning/tmp/verify-{doc_filename}.json` 读取结果 JSON。
3. 更新清单：为每个已处理的 review_queue 文档将 `status` 设置为 `"verified"`。

非规范文档如有失败则可进入 fix_loop。当非规范文档有 `claims_failed > 0` 时，以 `fix` 模式将其调度给 gsd-doc-writer，并附失败数组——写入器的修复模式对特定行进行精确纠正，不管文档类型如何（不需要模板）。写入器不得重构、改写或重新格式化失败声明以外的任何内容。

**阶段 3：呈现综合验证摘要**

将所有结果（规范 + 非规范）收集到单个 `verification_results` 数组中：

```
验证结果：

规范文档（已生成）：

| 文档 | 声明数 | 通过 | 失败 |
|------|--------|------|------|
| README.md | 12 | 10 | 2 |
| docs/architecture/overview.md | 8 | 8 | 0 |

现有文档（已审查）：

| 文档 | 声明数 | 通过 | 失败 |
|------|--------|------|------|
| docs/frontend/components/button.md | 5 | 4 | 1 |
| docs/services/api.md | 8 | 8 | 0 |

总计：已检查 {total_checked} 条声明，{total_failed} 个失败
```

将更新后的清单写回磁盘。

如果所有文档 `claims_failed === 0`：跳过 fix_loop，继续到 scan_for_secrets。
如果任何文档（规范或非规范）`claims_failed > 0`：继续到 fix_loop。
</step>

<step name="fix_loop">
**首先读取工作清单：** `Read .planning/tmp/docs-work-manifest.json` — 从 `.planning/tmp/verify-*.json` 中的验证结果识别所有（规范和非规范）`claims_failed > 0` 的文档。两个队列都有资格修复。

通过以修复模式将失败文档重新发送给文档写入器来纠正标记的不准确内容。根据 D-06，最多 2 次迭代。根据 D-05，在发现回退时立即停止。

**跳过条件：** 如果所有文档都通过了验证（无失败），跳过此步骤。

**迭代跟踪：**
- `MAX_FIX_ITERATIONS = 2`
- `iteration = 0`
- `previous_passed_docs` = 初始验证后 claims_failed === 0 的文档路径集合

**对于每次迭代（当 iteration < MAX_FIX_ITERATIONS 且存在失败文档时）：**

1. 对于最新 verification_results 中每个 `claims_failed > 0` 的文档：
   a. 从磁盘读取当前文件内容。
   b. 使用修复任务生成 `gsd-doc-writer` Agent（或按顺序调用）：
      ```xml
      <doc_assignment>
      type: {队列中的原始文档类型，例如 readme}
      mode: fix
      doc_path: {相对路径}
      project_context: {INIT JSON}
      existing_content: {从磁盘读取的当前文件内容}
      failures:
        - line: {行号}
          claim: "{声明}"
          expected: "{预期}"
          actual: "{实际}"
      </doc_assignment>
      ```
   c. 每个有失败的文档生成一个 Agent。不要将多个文档批量放入一个生成中。

2. 所有修复 Agent 完成后，重新验证所有文档（不仅仅是已修复的）：
   - 重新运行与 verify_docs 步骤相同的验证过程。
   - 从 `.planning/tmp/verify-{doc_filename}.json` 读取更新后的结果 JSON。

3. **回退检测（D-05）：**
   对于新 verification_results 中的每个文档：
   - 如果该文档在 `previous_passed_docs` 中（在上一轮通过）且现在 `claims_failed > 0`，这是一个回退。
   - 如果检测到回退：立即停止循环。呈现：
     ```
     检测到回退——停止修复循环。

     {doc_path} 之前通过了验证，但在修复迭代 {iteration + 1} 后有 {claims_failed} 个失败。

     这意味着修复引入了新错误。剩余失败需要手动审查。
     ```
     继续到 scan_for_secrets（不再尝试进一步修复）。

4. 用现在通过的文档更新 `previous_passed_docs`。
5. 递增 `iteration`。

**循环耗尽后（iteration === MAX_FIX_ITERATIONS 且仍有失败）：**

呈现剩余失败：
```
修复循环已完成（{MAX_FIX_ITERATIONS} 次迭代）。剩余失败：

| 文档 | 失败声明数 |
|------|-----------|
| {doc_path} | {count} |

这些失败需要手动纠正。请查看 .planning/tmp/verify-*.json 中的验证输出以获取详情。
```

继续到 scan_for_secrets。
</step>

<step name="verify_only_report">
**当 `$ARGUMENTS` 中存在 `--verify-only` 时到达。** 这是一个提前退出步骤——此步骤后不继续到 dispatch、generation、commit 或 report 步骤。

为 init JSON 中 `existing_docs` 里的每个文件以只读模式调用 gsd-doc-verifier Agent：

1. 对于 `existing_docs` 中的每个文档：
   a. 生成 `gsd-doc-verifier`（或如果 Task 工具不可用则按顺序调用）：
      ```xml
      <verify_assignment>
      doc_path: {doc.path}
      project_root: {来自 init JSON 的 project_root}
      </verify_assignment>
      ```
   b. 从 `.planning/tmp/verify-{doc_filename}.json` 读取结果 JSON。

2. 同时统计每个文档中的 VERIFY 标记数：在文件内容中 grep `<!-- VERIFY:`。

呈现综合摘要表：

```
--verify-only 审计：

| 文件 | 已检查声明 | 通过 | 失败 | VERIFY 标记 |
|------|-----------|------|------|------------|
| README.md | 12 | 10 | 2 | 0 |
| docs/ARCHITECTURE.md | 8 | 8 | 0 | 0 |
| docs/CONFIGURATION.md | 5 | 3 | 2 | 5 |
| ... | ... | ... | ... | ... |

总计：已检查 {total_checked} 条声明，{total_failed} 个失败，{total_markers} 个 VERIFY 标记需要手动审查
```

如果存在任何失败，显示详情：
```
失败的声明：
  README.md:34 - "src/cli/index.ts"（预期：文件存在，实际：文件未找到）
  docs/CONFIGURATION.md:12 - "npm run deploy"（预期：package.json 中的脚本，实际：脚本未找到）
```

显示说明：
```
自动修复失败：/gsd-docs-update（运行生成 + 修复循环）
从头重新生成所有文档：/gsd-docs-update --force
```

清理临时文件：删除 `.planning/tmp/verify-*.json` 文件。

结束工作流——不继续到任何 dispatch、commit 或 report 步骤。
</step>

<step name="scan_for_secrets">
关键安全检查：在提交之前扫描所有已生成/更新的文档文件，检查是否意外泄露了密钥。根据 D-07，这在修复循环完成后、commit_docs 之前运行一次。

从生成队列构建文件列表——包括所有已写入磁盘的文档（创建、更新、补充或修复）。不要硬编码静态列表；使用已生成或修改的文件的实际列表。

运行密钥模式检测：

```bash
# 检查已生成文档中常见的 API 密钥模式
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.)' \
  {空格分隔的已生成文档文件列表} 2>/dev/null \
  && SECRETS_FOUND=true || SECRETS_FOUND=false
```

**如果 SECRETS_FOUND=true：**

```
安全警告：在生成的文档中检测到潜在密钥！

在以下位置发现看起来像 API 密钥或令牌的模式：
{显示 grep 输出}

如果提交，这将暴露凭据。

所需操作：
1. 检查上面标记的行
2. 从文档文件中删除任何真实密钥
3. 重新运行 /gsd-docs-update 以重新生成干净的文档
```

然后使用 AskUserQuestion 确认：

```
AskUserQuestion([{
  question: "在生成的文档中检测到潜在密钥。您想如何继续？",
  header: "安全",
  multiSelect: false,
  options: [
    { label: "可以继续", description: "我已检查标记的行——没有真实密钥，提交文档" },
    { label: "中止提交", description: "跳过提交——我先清理文档" }
  ]
}])
```

如果用户选择"中止提交"：跳过 commit_docs，继续到 report。如果"可以继续"：继续到 commit_docs。

**如果 SECRETS_FOUND=false：**

继续到 commit_docs。
</step>

<step name="commit_docs">
仅当 init JSON 中的 `commit_docs` 为 `true` 时运行此步骤。如果 `commit_docs` 为 false，跳到 report。

组装实际已生成的文件列表（不包括失败或跳过的文件）：

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: generate project documentation" \
  --files README.md docs/ARCHITECTURE.md docs/CONFIGURATION.md docs/GETTING-STARTED.md docs/DEVELOPMENT.md docs/TESTING.md
# 附加任何已生成的条件文档：
# --files ... docs/API.md docs/DEPLOYMENT.md CONTRIBUTING.md
# 如果 monorepo dispatch 已运行，附加每包 README：
# --files ... packages/core/README.md packages/cli/README.md
```

仅包含成功写入磁盘的文件。不包含失败或跳过的文档。

继续到 report。
</step>

<step name="report">
**首先读取工作清单：** `Read .planning/tmp/docs-work-manifest.json` — 使用清单编译涵盖所有规范文档、review_queue 结果和 gap_queue 结果的完整报告。清单是已处理内容的真实来源。

向用户呈现完成摘要。

**摘要格式：**

```
文档生成完成。

项目类型：{primary_type}

已生成的文档：
| 文件 | 模式 | 行数 |
|------|------|------|
| README.md | create | 87 |
| docs/ARCHITECTURE.md | update | 124 |
| docs/GETTING-STARTED.md | create | 63 |
| docs/DEVELOPMENT.md | create | 71 |
| docs/TESTING.md | create | 58 |
| docs/CONFIGURATION.md | create | 45 |
[已生成的条件文档（如有）]

{如果生成了 monorepo 每包 README：}
每包 README：
| 包 | 模式 | 行数 |
|----|------|------|
| packages/core | create | 42 |
| packages/cli | create | 38 |

{如果有任何文档失败或被跳过：}
已跳过 / 失败：
  - docs/API.md：Agent 未完成

{如果 preservation_check 已运行：}
保留决策：
  - {filename}：{preserve|supplement|regenerate}

{如果生成了 docs/DEPLOYMENT.md 或 docs/CONFIGURATION.md：}
VERIFY 标记：在 docs/DEPLOYMENT.md 和/或 docs/CONFIGURATION.md 中放置了 {N} 个标记，用于需要手动验证的基础设施声明。

{如果 review_queue 非空：}

现有文档准确性审查：

| 文档 | 已检查声明 | 通过 | 失败 | 已修复 |
|------|-----------|------|------|--------|
| docs/api/endpoint-map.md | 5 | 4 | 1 | 1 |

{对于修复循环后仍有失败的情况：}
无法自动纠正剩余的不准确内容——建议对上面标记的项目进行手动审查。

{如果 commit_docs 为 true：}
所有已生成的文件已提交。
```

提醒用户可以对生成的文档进行事实核查：

```
运行 `/gsd-docs-update --verify-only` 可对照代码库对生成的文档进行事实核查。
```

结束工作流。
</step>

</process>

<success_criteria>
- [ ] docs-init JSON 已加载，所有字段已提取
- [ ] 项目类型已从 project_type 信号正确分类
- [ ] 文档队列包含所有始终启用的文档，以及仅匹配项目信号的条件文档
- [ ] CHANGELOG.md 未被生成或加入队列
- [ ] 每个文档以正确的模式生成（新文件用 create，现有文件用 update）
- [ ] 波次 1 文档（README、ARCHITECTURE、CONFIGURATION）在波次 2 开始前完成
- [ ] 已生成的文档不包含任何 GSD 方法论内容
- [ ] docs/DEPLOYMENT.md 和 docs/CONFIGURATION.md 对无法发现的声明使用 VERIFY 标记（如果已生成）
- [ ] 所有已生成的文件已提交（如果 commit_docs 为 true）
- [ ] 手写文档（无 GSD 标记）在调度前提示保留/补充/重新生成（除非使用 --force）
- [ ] --force 标志跳过保留提示并重新生成所有文档
- [ ] --verify-only 标志报告文档状态而不生成文件
- [ ] 为 monorepo 工作区生成了每包 README（如果适用）
- [ ] verify_docs 步骤对照实时代码库检查了所有已生成的文档
- [ ] fix_loop 最多运行 2 次迭代，并在回退时停止
- [ ] scan_for_secrets 在提交前运行，并在检测到模式时阻止
- [ ] --verify-only 调用 gsd-doc-verifier 进行完整事实检查（不仅仅是统计 VERIFY 标记数量）
</success_criteria>
