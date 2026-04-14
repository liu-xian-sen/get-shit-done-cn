# Workstream 标志（`--ws`）

## 概述

`--ws <name>` 标志将 GSD 操作限定到特定的工作流，使多个 Claude Code 实例能够在同一代码库上并行进行里程碑工作。

## 解析优先级

1. `--ws <name>` 标志（显式，最高优先级）
2. `GSD_WORKSTREAM` 环境变量（每实例）
3. 临时存储中的会话范围活跃工作流指针（每运行时会话 / 终端）
4. `.planning/active-workstream` 文件（不存在会话密钥时的旧版共享回退）
5. `null` —— 平坦模式（无工作流）

## 为何存在会话范围指针

共享的 `.planning/active-workstream` 文件在同一仓库中多个 Claude/Codex 实例同时活跃时从根本上是不安全的。一个会话可能静默地将另一个会话的 `STATE.md`、`ROADMAP.md` 和阶段路径重新指向。

GSD 现在优先使用以运行时/会话身份为键的会话范围指针（`GSD_SESSION_KEY`、`CODEX_THREAD_ID`、`CLAUDE_CODE_SSE_PORT`、终端会话 ID 或控制 TTY）。这在保持向后兼容性的同时，让并发会话保持隔离。

## 会话身份解析

当 GSD 解析上面步骤 3 中的会话范围指针时，使用以下顺序：

1. 显式的运行时/会话环境变量，如 `GSD_SESSION_KEY`、`CODEX_THREAD_ID`、
   `CLAUDE_SESSION_ID`、`CLAUDE_CODE_SSE_PORT`、`OPENCODE_SESSION_ID`、
   `GEMINI_SESSION_ID`、`CURSOR_SESSION_ID`、`WINDSURF_SESSION_ID`、
   `TERM_SESSION_ID`、`WT_SESSION`、`TMUX_PANE` 和 `ZELLIJ_SESSION_NAME`
2. 如果 shell/运行时已暴露终端路径，则使用 `TTY` 或 `SSH_TTY`
3. 尽力而为的单次 `tty` 探测，但仅在 stdin 是交互式时

如果这些都没有产生稳定的身份，GSD 不会继续探测。它直接回退到旧版共享的 `.planning/active-workstream` 文件。

这在无头或精简环境中很重要：当 stdin 已经是非交互式时，GSD 有意跳过调用 `tty`，因为该路径无法发现稳定的会话身份，并且只会在路由关键路径上增加可避免的失败。

## 指针生命周期

会话范围指针有意保持轻量级和尽力而为：

- 为一个会话清除工作流只删除该会话的指针文件
- 如果这是仓库的最后一个指针，GSD 也删除现在为空的每项目临时目录
- 如果同级会话指针仍然存在，临时目录保持原样
- 当指针引用不再存在的工作流目录时，GSD 将其视为过时状态：删除该指针文件，并解析为 `null`，直到会话再次显式设置活跃工作流

GSD 目前不为历史临时目录运行后台垃圾收集器。清理是在指针被清除或自愈时进行的机会性操作，更广泛的临时清洁工作留给操作系统临时清理或未来的维护工作。

## 路由传播

所有工作流路由命令包含 `${GSD_WS}`，它：
- 当工作流活跃时展开为 `--ws <name>`
- 在平坦模式下展开为空字符串（向后兼容）

这确保工作流范围自动贯穿整个工作流链：
`new-milestone → discuss-phase → plan-phase → execute-phase → transition`

## 目录结构

```
.planning/
├── PROJECT.md          # 共享
├── config.json         # 共享
├── milestones/         # 共享
├── codebase/           # 共享
├── active-workstream   # 仅旧版共享回退
└── workstreams/
    ├── feature-a/      # 工作流 A
    │   ├── STATE.md
    │   ├── ROADMAP.md
    │   ├── REQUIREMENTS.md
    │   └── phases/
    └── feature-b/      # 工作流 B
        ├── STATE.md
        ├── ROADMAP.md
        ├── REQUIREMENTS.md
        └── phases/
```

## CLI 用法

```bash
# 所有 gsd-tools 命令接受 --ws
node gsd-tools.cjs state json --ws feature-a
node gsd-tools.cjs find-phase 3 --ws feature-b

# 会话本地切换，无需每条命令都加 --ws
GSD_SESSION_KEY=my-terminal-a node gsd-tools.cjs workstream set feature-a
GSD_SESSION_KEY=my-terminal-a node gsd-tools.cjs state json
GSD_SESSION_KEY=my-terminal-b node gsd-tools.cjs workstream set feature-b
GSD_SESSION_KEY=my-terminal-b node gsd-tools.cjs state json

# 工作流 CRUD
node gsd-tools.cjs workstream create <name>
node gsd-tools.cjs workstream list
node gsd-tools.cjs workstream status <name>
node gsd-tools.cjs workstream complete <name>
```
