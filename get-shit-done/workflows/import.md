# 导入工作流

外部计划导入，包含冲突检测和 Agent 委托。

- **--from**：导入外部计划 → 冲突检测 → 写入 PLAN.md → 通过 gsd-plan-checker 验证

未来：`--prd` 模式（将 PRD 提取为 PROJECT.md + REQUIREMENTS.md + ROADMAP.md）计划在后续 PR 中实现。

---

<step name="banner">

显示阶段横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 导入
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</step>

<step name="parse_arguments">

解析 `$ARGUMENTS` 以确定执行模式：

- 如果存在 `--from`：提取 FILEPATH（`--from` 后的下一个 token），设置 MODE=plan
- 如果存在 `--prd`：显示消息说明 `--prd` 尚未实现并退出：
  ```
  GSD > --prd 模式计划在未来版本中发布。使用 --from 导入计划文件。
  ```
- 如果未找到任何标志：显示用法并退出：

```
用法：/gsd-import --from <path>

  --from <path>   将外部计划文件导入为 GSD 格式
```

**验证文件路径：**

验证路径不包含路径遍历序列且文件存在：

```bash
case "{FILEPATH}" in
  *..* ) echo "SECURITY_ERROR: path contains traversal sequence"; exit 1 ;;
esac
test -f "{FILEPATH}" || echo "FILE_NOT_FOUND"
```

如果 FILE_NOT_FOUND：显示错误并退出：

```
╔══════════════════════════════════════════════════════════════╗
║  错误                                                        ║
╚══════════════════════════════════════════════════════════════╝

文件未找到：{FILEPATH}

**修复方法：** 验证文件路径后重试。
```

</step>

---

## 路径 A：MODE=plan (--from)

<step name="plan_load_context">

为冲突检测加载项目上下文：

1. 读取 `.planning/ROADMAP.md` — 提取阶段结构、阶段编号、依赖关系
2. 读取 `.planning/PROJECT.md` — 提取项目约束、技术栈、范围边界。
   **如果 PROJECT.md 不存在：** 跳过依赖它的约束检查并显示：
   ```
   GSD > 注意：未找到 PROJECT.md。将跳过针对项目约束的冲突检查。
   ```
3. 读取 `.planning/REQUIREMENTS.md` — 提取现有需求，用于重叠和矛盾检查。
   **如果 REQUIREMENTS.md 不存在：** 跳过需求冲突检查并继续。
4. Glob 所有阶段目录中的 CONTEXT.md 文件：
   ```bash
   find .planning/phases/ -name "*-CONTEXT.md" -o -name "CONTEXT.md" 2>/dev/null
   ```
   读取找到的每个 CONTEXT.md — 提取锁定的决策（`<decisions>` 块中的任何决策）

将加载的上下文存储，用于下一步的冲突检测。

</step>

<step name="plan_read_input">

读取 FILEPATH 处的导入文件。

确定格式：
- **GSD PLAN.md 格式**：有 YAML 元信息，包含 `phase:`、`plan:`、`type:` 字段
- **自由格式文档**：任何其他格式（markdown 规范、设计文档、任务列表等）

从导入内容中提取：
- **阶段目标**：此计划属于哪个阶段（来自元信息或从内容推断）
- **计划目标**：计划旨在完成什么
- **列出的任务**：计划中描述的单个工作项
- **修改的文件**：计划中提到的任何目标文件
- **依赖关系**：引用的任何先决条件

</step>

<step name="plan_conflict_detection">

针对已加载的项目上下文运行冲突检查。使用 [BLOCKER]、[WARNING] 和 [INFO] 标签以纯文本形式输出冲突报告。不要使用 markdown 表格（无 `|---|` 格式）。

### 阻塞检查（任意一项阻止导入）：

- 计划针对的阶段编号在 ROADMAP.md 中不存在 → [BLOCKER]
- 计划指定的技术栈与 PROJECT.md 约束相矛盾 → [BLOCKER]
- 计划与任何 CONTEXT.md `<decisions>` 块中的锁定决策相矛盾 → [BLOCKER]
- 计划与 REQUIREMENTS.md 中的现有需求相矛盾 → [BLOCKER]

### 警告检查（需要用户确认）：

- 计划与 REQUIREMENTS.md 中的现有需求覆盖部分重叠 → [WARNING]
- 计划有 `depends_on` 引用尚未完成的计划 → [WARNING]
- 计划修改的文件与现有未完成计划重叠 → [WARNING]
- 计划阶段编号与 ROADMAP.md 中的现有阶段编号冲突 → [WARNING]

### 信息检查（仅供参考，无需操作）：

- 计划使用当前项目技术栈中没有的库 → [INFO]
- 计划向 ROADMAP.md 结构添加新阶段 → [INFO]

显示完整的冲突检测报告：

```
## 冲突检测报告

### 阻塞项（{N}）

[BLOCKER] {简短标题}
  发现：{导入计划所说的}
  预期：{项目上下文要求的}
  → {解决的具体操作}

### 警告（{N}）

[WARNING] {简短标题}
  发现：{检测到的内容}
  影响：{可能出错的地方}
  → {建议的操作}

### 信息（{N}）

[INFO] {简短标题}
  注意：{相关信息}
```

**如果存在任何 [BLOCKER]：**

显示：
```
GSD > 已阻塞：{N} 个阻塞项必须在导入继续之前解决。
```

退出而不写任何文件。这是安全门——当阻塞项存在时不写入 PLAN.md。

**如果只有警告和/或信息（无阻塞项）：**


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` 标志）：** 如果 `$ARGUMENTS` 中存在 `--text` 或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当 TEXT_MODE 激活时，将每次 `AskUserQuestion` 调用替换为纯文本编号列表，并请用户键入选择编号。这对于 `AskUserQuestion` 不可用的非 Claude 运行时（OpenAI Codex、Gemini CLI 等）是必需的。
使用 AskUserQuestion，采用批准-修改-中止模式：
- question: "查看上面的警告。是否继续导入？"
- header: "批准？"
- options: 批准 | 中止

如果用户选择"中止"：以消息"导入已取消。"干净退出。

</step>

<step name="plan_convert">

将导入的内容转换为 GSD PLAN.md 格式。

确保 PLAN.md 具有所有必填的元信息字段：
```yaml
---
phase: "{NN}-{slug}"
plan: "{NN}-{MM}"
type: "feature|refactor|config|test|docs"
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: []
  artifacts: []
---
```

**拒绝源内容中的 PBR 命名约定：**
如果导入的计划引用了 PBR 计划命名（例如 `PLAN-01.md`、`plan-01.md`），在转换期间将所有引用重命名为 GSD `{NN}-{MM}-PLAN.md` 约定。

对输出文件名应用 GSD 命名约定：
- 格式：`{NN}-{MM}-PLAN.md`（例如 `04-01-PLAN.md`）
- 绝不使用 `PLAN-01.md`、`plan-01.md` 或任何其他格式
- NN = 阶段编号（零填充），MM = 阶段内计划编号（零填充）

确定目标目录：
```
.planning/phases/{NN}-{slug}/
```

如果目录不存在，创建它：
```bash
mkdir -p ".planning/phases/{NN}-{slug}/"
```

将 PLAN.md 文件写入目标目录。

</step>

<step name="plan_validate">

将验证委托给 gsd-plan-checker：

```
Task({
  subagent_type: "gsd-plan-checker",
  prompt: "验证：.planning/phases/{phase}/{plan}-PLAN.md — 检查元信息完整性、任务结构和 GSD 约定。报告任何问题。"
})
```

如果检查器返回错误：
- 向用户显示错误
- 要求用户在计划被视为已导入之前解决问题
- 不要删除已写入的文件——用户可以手动修复并重新验证

如果检查器返回干净：
- 显示："计划验证通过"

</step>

<step name="plan_finalize">

更新 `.planning/ROADMAP.md` 以反映新计划：
- 在正确的阶段部分下将计划添加到计划列表
- 包括计划名称和描述

如果适用，更新 `.planning/STATE.md`（例如，增加总计划数）。

提交导入的计划和更新的文件：
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs({phase}): import plan from {basename FILEPATH}" --files .planning/phases/{phase}/{plan}-PLAN.md .planning/ROADMAP.md
```

显示完成：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 导入完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

显示：已写入的计划文件名、阶段目录、验证结果、后续步骤。

</step>

---

## 反模式

不要：
- 在冲突检测报告中使用 markdown 表格（`|---|`）——使用纯文本 [BLOCKER]/[WARNING]/[INFO] 标签
- 将 PLAN.md 文件写为 `PLAN-01.md` 或 `plan-01.md` ——始终使用 `{NN}-{MM}-PLAN.md`
- 使用 `pbr:plan-checker` 或 `pbr:planner` ——使用 `gsd-plan-checker` 和 `gsd-planner`
- 写入 `.planning/.active-skill` ——这是 PBR 模式，在 GSD 中没有等效物
- 在任何地方引用 `pbr-tools`、`pbr:` 或 `PLAN-BUILD-RUN`
- 当阻塞项存在时写入任何 PLAN.md 文件——安全门必须保持
- 跳过对 --from 文件参数的路径验证
