<purpose>
轻量级代码库评估。为单个关注领域生成一个 gsd-codebase-mapper agent，
在 `.planning/codebase/` 中生成针对性文档。
</purpose>

<required_reading>
开始前，读取调用提示的 execution_context 中引用的所有文件。
</required_reading>

<available_agent_types>
有效的 GSD 子 agent 类型（使用确切名称 — 不要回退到 'general-purpose'）：
- gsd-codebase-mapper — 映射项目结构和依赖关系
</available_agent_types>

<process>

## 关注领域与文档映射

| 关注领域 | 生成的文档 |
|---------|-----------|
| `tech` | STACK.md, INTEGRATIONS.md |
| `arch` | ARCHITECTURE.md, STRUCTURE.md |
| `quality` | CONVENTIONS.md, TESTING.md |
| `concerns` | CONCERNS.md |
| `tech+arch` | STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md |

## 第 1 步：解析参数并确定关注领域

从用户输入中解析 `--focus <area>` 参数。若未指定，默认使用 `tech+arch`。

验证关注领域是否为以下之一：`tech`、`arch`、`quality`、`concerns`、`tech+arch`。

若无效：
```
未知关注领域："{input}"。有效选项：tech, arch, quality, concerns, tech+arch
```
退出。

## 第 2 步：检查现有文档

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init map-codebase 2>/dev/null || echo "{}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

根据上方映射表，查找所选关注领域将生成的文档。

对每个目标文档，检查其是否已存在于 `.planning/codebase/` 中：
```bash
ls -la .planning/codebase/{DOCUMENT}.md 2>/dev/null
```

若存在，显示其修改日期并询问：
```
发现已有文档：
  - STACK.md（修改于 2026-04-03）
  - INTEGRATIONS.md（修改于 2026-04-01）

是否覆盖并重新扫描？[y/N]
```

若用户选择否，退出。

## 第 3 步：创建输出目录

```bash
mkdir -p .planning/codebase
```

## 第 4 步：生成 mapper agent

为所选关注领域生成一个 `gsd-codebase-mapper` agent：

```
Task(
  prompt="扫描此代码库，关注领域：{focus}。将结果写入 .planning/codebase/。仅生成：{document_list}",
  subagent_type="gsd-codebase-mapper",
  model="{resolved_model}"
)
```

## 第 5 步：报告

```
## 扫描完成

**关注领域：** {focus}
**生成的文档：**
{带行数的已写入文档列表}

使用 `/gsd-map-codebase` 进行涵盖 4 个领域的全面并行扫描。
```

</process>

<success_criteria>
- [ ] 关注领域正确解析（默认：tech+arch）
- [ ] 检测到已有文档并显示修改日期
- [ ] 覆盖前提示用户确认
- [ ] 以正确的关注领域生成单个 mapper agent
- [ ] 输出文档写入 .planning/codebase/
</success_criteria>
