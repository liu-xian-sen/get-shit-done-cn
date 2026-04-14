---
name: gsd:intel
description: "查询、检查或刷新.planning/intel/中的代码库智能文件"
argument-hint: "[query <term>|status|diff|refresh]"
allowed-tools:
  - Read
  - Bash
  - Task
---

**停止——不要读取此文件。你已经在读取它了。此提示由 Claude Code 的命令系统注入到你的上下文中。使用 Read 工具读取此文件会浪费令牌。立即开始执行步骤 0。**

## 步骤 0 -- 横幅

**在任何工具调用之前**，显示此横幅：

```
GSD > INTEL
```

然后继续步骤 1。

## 步骤 1 -- 配置门

通过使用 Read 工具直接读取 `.planning/config.json` 来检查 intel 是否已启用。

**不要使用 gsd-tools config get-value 命令**——它在缺失键时会直接退出。

1. 使用 Read 工具读取 `.planning/config.json`
2. 如果文件不存在：显示以下禁用消息并**停止**
3. 解析 JSON 内容。检查 `config.intel && config.intel.enabled === true`
4. 如果 `intel.enabled` 不是显式的 `true`：显示以下禁用消息并**停止**
5. 如果 `intel.enabled` 是 `true`：继续步骤 2

**禁用消息：**

```
GSD > INTEL

Intel 系统已禁用。要激活：

  node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs config-set intel.enabled true

然后运行 /gsd-intel refresh 构建初始索引。
```

---

## 步骤 2 -- 解析参数

解析 `$ARGUMENTS` 以确定操作模式：

| 参数 | 操作 |
|----------|--------|
| `query <term>` | 运行行内查询（步骤 2a） |
| `status` | 运行行内状态检查（步骤 2b） |
| `diff` | 运行行内差异检查（步骤 2c） |
| `refresh` | 派生 intel-updater 代理（步骤 3） |
| 无参数或未知参数 | 显示用法消息 |

**用法消息**（无参数或无法识别的参数时显示）：

```
GSD > INTEL

用法：/gsd-intel <mode>

模式：
  query <term>  在 intel 文件中搜索术语
  status        显示 intel 文件的新鲜度和过期状态
  diff          显示自上次快照以来的变更
  refresh       从代码库分析重建所有 intel 文件
```

### 步骤 2a -- 查询

运行：

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs intel query <term>
```

解析 JSON 输出并显示结果：
- 如果输出包含 `"disabled": true`，显示步骤 1 中的禁用消息并**停止**
- 如果未找到匹配项，显示：`没有找到 '<term>' 的 intel 匹配项。尝试 /gsd-intel refresh 构建索引。`
- 否则，按 intel 文件分组显示匹配条目

显示结果后**停止**。不要派生代理。

### 步骤 2b -- 状态

运行：

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs intel status
```

解析 JSON 输出并显示每个 intel 文件的：
- 文件名
- 最后 `updated_at` 时间戳
- STALE 或 FRESH 状态（如果超过 24 小时或缺失则为 stale）

显示状态后**停止**。不要派生代理。

### 步骤 2c -- 差异

运行：

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs intel diff
```

解析 JSON 输出并显示：
- 自上次快照以来新增的条目
- 自上次快照以来删除的条目
- 自上次快照以来变更的条目

如果不存在快照，建议先运行 `refresh`。

显示差异后**停止**。不要派生代理。

---

## 步骤 3 -- 刷新（代理派生）

派生前显示：

```
GSD > 正在派生 intel-updater 代理分析代码库...
```

派生一个 Task：

```
Task(
  description="刷新代码库智能文件",
  prompt="你是 gsd-intel-updater 代理。你的工作是分析此代码库并在 .planning/intel/ 中写入/更新智能文件。

项目根目录：${CWD}
gsd-tools 路径：$HOME/.claude/get-shit-done/bin/gsd-tools.cjs

指令：
1. 分析代码库结构、依赖项、API 和架构
2. 将 JSON intel 文件写入 .planning/intel/（stack.json、api-map.json、dependency-graph.json、file-roles.json、arch-decisions.json）
3. 每个文件必须有一个包含 updated_at 时间戳的 _meta 对象
4. 使用 gsd-tools intel extract-exports <file> 分析源文件
5. 使用 gsd-tools intel patch-meta <file> 在写入后更新时间戳
6. 使用 gsd-tools intel validate 检查你的输出

完成时，输出：## INTEL UPDATE COMPLETE
如果出现失败，输出：## INTEL UPDATE FAILED 及详细信息。"
)
```

等待代理完成。

---

## 步骤 4 -- 刷新后摘要

代理完成后，运行：

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs intel status
```

显示摘要，包括：
- 哪些 intel 文件被写入或更新
- 最后更新时间戳
- intel 索引的整体健康状况

---

## 反模式

1. 不要为 query/status/diff 操作派生代理——这些是行内 CLI 调用
2. 不要直接修改 intel 文件——代理在刷新期间处理写入
3. 不要跳过配置门检查
4. 不要使用 gsd-tools config get-value CLI 进行配置门检查——它在缺失键时会退出
