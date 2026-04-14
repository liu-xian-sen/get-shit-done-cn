---
name: gsd:from-gsd2
description: 将GSD-2（.gsd/）项目导入回GSD v1（.planning/）格式
argument-hint: "[--path <dir>] [--force]"
allowed-tools:
  - Read
  - Write
  - Bash
type: prompt
---

<objective>
将 GSD-2 项目（`.gsd/` 目录）反向迁移回 GSD v1（`.planning/`）格式。

将 GSD-2 层级（里程碑 → 切片 → 任务）映射到 GSD v1 层级（ROADMAP.md 中的里程碑章节 → 阶段 → 计划），保留完成状态、研究文件和摘要。
</objective>

<process>

1. **定位 .gsd/ 目录** — 检查当前工作目录（或 `--path` 参数）：
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" from-gsd2 --dry-run
   ```
   如果未找到 `.gsd/`，报告错误并停止。

2. **显示预演预览** — 向用户呈现完整的文件列表和迁移统计数据。在写入任何内容之前请求确认。

3. **确认后运行迁移**：
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" from-gsd2
   ```
   如果 `.planning/` 已存在且用户已确认覆盖，使用 `--force`。

4. **报告结果** — 显示 `filesWritten` 计数、`planningDir` 路径和预览摘要。

</process>

<notes>
- 迁移是非破坏性的：`.gsd/` 永远不会被修改或删除。
- 传递 `--path <dir>` 以迁移不在当前目录的项目。
- 切片按所有里程碑顺序编号（M001/S01 → phase 01，M001/S02 → phase 02，M002/S01 → phase 03 等）。
- 每个切片内的任务成为计划（T01 → plan 01，T02 → plan 02 等）。
- 已完成的切片和任务将其完成状态带入 ROADMAP.md 复选框和 SUMMARY.md 文件。
- GSD-2 的成本/令牌账本、数据库状态和 VS Code 扩展状态无法迁移。
</notes>
