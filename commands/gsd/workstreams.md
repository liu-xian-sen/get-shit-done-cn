---
name: gsd:workstreams
description: 管理并行工作流——列出、创建、切换、状态、进度、完成和恢复
allowed-tools:
  - Read
  - Bash
---

# /gsd-workstreams

管理并行工作流以进行并发里程碑工作。

## 用法

`/gsd-workstreams [subcommand] [args]`

### 子命令

| 命令 | 描述 |
|---------|-------------|
| `list` | 列出所有工作流及其状态 |
| `create <name>` | 创建新的工作流 |
| `status <name>` | 单个工作流的详细状态 |
| `switch <name>` | 设置活跃工作流 |
| `progress` | 所有工作流的进度摘要 |
| `complete <name>` | 归档已完成的工作流 |
| `resume <name>` | 恢复工作流中的工作 |

## 步骤 1：解析子命令

解析用户输入以确定要执行的工作流操作。
如果未给出子命令，默认为 `list`。

## 步骤 2：执行操作

### list
运行：`node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" workstream list --raw --cwd "$CWD"`
以表格格式显示工作流，包含名称、状态、当前阶段和进度。

### create
运行：`node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" workstream create <name> --raw --cwd "$CWD"`
创建后，显示新工作流路径并建议下一步：
- `/gsd-new-milestone --ws <name>` 以设置里程碑

### status
运行：`node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" workstream status <name> --raw --cwd "$CWD"`
显示详细的阶段分解和状态信息。

### switch
运行：`node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" workstream set <name> --raw --cwd "$CWD"`
当运行时支持时，还为当前会话设置 `GSD_WORKSTREAM`。
如果运行时暴露了会话标识符，GSD 还会在会话本地存储活跃工作流，
以便并发会话不会互相覆盖。

### progress
运行：`node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" workstream progress --raw --cwd "$CWD"`
显示所有工作流的进度概览。

### complete
运行：`node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" workstream complete <name> --raw --cwd "$CWD"`
将工作流归档到 milestones/。

### resume
将工作流设为活跃并建议 `/gsd-resume-work --ws <name>`。

## 步骤 3：显示结果

将 gsd-tools 的 JSON 输出格式化为人类可读的显示。
在任何路由建议中包含 `${GSD_WS}` 标志。
