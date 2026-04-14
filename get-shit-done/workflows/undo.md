<purpose>
安全的 git 回退工作流。使用阶段清单通过依赖检查和确认门禁回退 GSD 阶段或计划的提交。使用 git revert --no-commit（绝不使用 git reset）以保留历史记录。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/gate-prompts.md
</required_reading>

<process>

<step name="banner" priority="first">
显示阶段横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 撤销
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="parse_arguments">
从 $ARGUMENTS 解析撤销模式：

- `--last N` → MODE=last，COUNT=N（整数，若 N 缺失默认为 10）
- `--phase NN` → MODE=phase，TARGET_PHASE=NN（两位数阶段编号）
- `--plan NN-MM` → MODE=plan，TARGET_PLAN=NN-MM（阶段-计划 ID）

若未提供有效参数，显示使用说明并退出：

```
用法：/gsd-undo --last N | --phase NN | --plan NN-MM

模式：
  --last N      显示最后 N 个 GSD 提交供交互选择
  --phase NN    回退阶段 NN 的所有提交
  --plan NN-MM  回退计划 NN-MM 的所有提交

示例：
  /gsd-undo --last 5
  /gsd-undo --phase 03
  /gsd-undo --plan 03-02
```
</step>

<step name="gather_commits">
根据 MODE 收集候选提交。

**MODE=last：**

运行：
```bash
git log --oneline --no-merges -${COUNT}
```

筛选符合 `type(scope): message` 模式的 GSD 常规提交（如 `feat(04-01):`、`docs(03):`、`fix(02-03):`）。

显示匹配提交的编号列表：
```
最近的 GSD 提交：
  1. abc1234 feat(04-01): implement auth endpoint
  2. def5678 docs(03-02): complete plan summary
  3. ghi9012 fix(02-03): correct validation logic
```


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` 参数）：** 若 `$ARGUMENTS` 中包含 `--text` 或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。TEXT_MODE 激活时，将所有 `AskUserQuestion` 调用替换为纯文本编号列表，要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需设置，因为这些运行时不支持 `AskUserQuestion`。
使用 AskUserQuestion 询问：
- question: "要回退哪些提交？输入编号（如 1,3）或 'all'"
- header: "选择"

将用户选择解析为 COMMITS 列表。

---

**MODE=phase：**

若存在，读取 `.planning/.phase-manifest.json`。

若文件存在且 `manifest.phases?.[TARGET_PHASE]?.commits` 是非空数组：
  - 使用 `manifest.phases[TARGET_PHASE].commits` 条目作为 COMMITS（每个条目是一个提交哈希）

若文件不存在，或 `manifest.phases?.[TARGET_PHASE]` 缺失：
  - 显示："清单中没有阶段 ${TARGET_PHASE} 的条目（或文件缺失），回退到 git log 搜索"
  - 备选方案：运行 git log 并筛选目标阶段范围：
    ```bash
    git log --oneline --no-merges --all | grep -E "\(0*${TARGET_PHASE}(-[0-9]+)?\):" | head -50
    ```
  - 将匹配的提交用作 COMMITS

---

**MODE=plan：**

运行：
```bash
git log --oneline --no-merges --all | grep -E "\(${TARGET_PLAN}\)" | head -50
```

将匹配的提交用作 COMMITS。

---

**空值检查：**

若收集后 COMMITS 为空：
```
未找到 ${MODE} ${TARGET} 的提交。无需回退。
```
干净退出。
</step>

<step name="dependency_check">
**仅适用于 MODE=phase 或 MODE=plan。**

对于 MODE=last，完全跳过此步骤。

---

**MODE=phase：**

内联读取 `.planning/ROADMAP.md`。

搜索依赖目标阶段的其他阶段。查找以下模式：
- "Depends on: Phase ${TARGET_PHASE}"
- "Depends on: ${TARGET_PHASE}"
- "depends_on: [${TARGET_PHASE}]"

对找到的每个依赖阶段 N：
1. 检查 `.planning/phases/${N}-*/` 目录是否存在
2. 若目录存在，检查其中是否有任何 PLAN.md 或 SUMMARY.md 文件

若任何下游阶段已开始工作，收集警告：
```
⚠  检测到下游依赖：
   第 ${N} 阶段依赖第 ${TARGET_PHASE} 阶段且已开始工作。
```

---

**MODE=plan：**

从 TARGET_PLAN 中提取阶段编号（NN-MM 的 NN 部分）和计划编号（MM 部分）。

查找同一阶段目录（`.planning/phases/${NN}-*/`）中的后续计划。对每个后续计划（编号 > MM 的计划）：
1. 读取该计划的 PLAN.md
2. 检查其 `<files>` 章节或 `consumes` 字段是否引用了目标计划的输出

若任何后续计划引用了目标计划的输出，收集警告：
```
⚠  检测到阶段内依赖：
   第 ${NN} 阶段的计划 ${LATER_PLAN} 引用了计划 ${TARGET_PLAN} 的输出。
```

---

若存在任何警告（来自任一模式）：
- 显示所有警告
- 使用 AskUserQuestion 按批准-修改-中止模式：
  - question: "下游工作依赖于将被回退的目标。仍要继续吗？"
  - header: "确认"
  - options: 继续 | 中止

若用户选择"中止"：退出并提示 "已取消回退。未做任何修改。"
</step>

<step name="confirm_revert">
使用来自 gate-prompts.md 的批准-修改-中止模式显示确认门禁。

显示：
```
以下提交将按逆时间顺序回退：

  {hash} — {message}
  {hash} — {message}
  ...

共计：{N} 个提交待回退
```

使用 AskUserQuestion：
- question: "确认回退？"
- header: "批准？"
- options: 批准 | 中止

若选择"中止"：显示 "已取消回退。未做任何修改。" 并退出。
若选择"批准"：询问原因：

```
AskUserQuestion(
  header: "原因",
  question: "回退的简短原因（用于提交信息）：",
  options: []
)
```

将响应存储为 REVERT_REASON。继续执行 execute_revert。
</step>

<step name="execute_revert">
**硬性约束：使用 git revert --no-commit。绝不使用 git reset（以下记录的冲突清理情况除外）。**

**工作树检查（在任何回退之前先运行）：**

运行 `git status --porcelain`。若输出非空，显示有改动的文件并中止：
```
工作树有未提交的改动。请在运行 /gsd-undo 前提交或暂存它们。
```
立即退出 — 不继续执行任何回退操作。

---

将 COMMITS 按逆时间顺序排序（最新在前）。若提交来自 git log（已是最新在前），则顺序已正确。

对 COMMITS 中的每个提交哈希：
```bash
git revert --no-commit ${HASH}
```

若任何回退失败（合并冲突或错误）：
1. 显示错误信息
2. 运行清理 — 处理首次调用和序列中间失败的情况：
   ```bash
   # 先尝试 git revert --abort（适用于这是第一个失败的回退）
   git revert --abort 2>/dev/null
   # 若之前的 --no-commit 回退已干净暂存，revert --abort 可能是空操作。
   # 清理已暂存和工作树的改动：
   git reset HEAD 2>/dev/null
   git restore . 2>/dev/null
   ```
3. 显示：
   ```
   ╔══════════════════════════════════════════════════════════════╗
   ║  错误                                                        ║
   ╚══════════════════════════════════════════════════════════════╝

   提交 ${HASH} 回退失败。
   可能原因：与后续改动存在合并冲突。

   **修复方法：** 手动解决冲突，或逐个回退提交。
   所有待执行的回退已中止 — 工作树已清洁。
   ```
4. 带错误退出。

所有回退成功暂存后，创建单个提交：

对于 MODE=phase：
```bash
git commit -m "revert(${TARGET_PHASE}): undo phase ${TARGET_PHASE} — ${REVERT_REASON}"
```

对于 MODE=plan：
```bash
git commit -m "revert(${TARGET_PLAN}): undo plan ${TARGET_PLAN} — ${REVERT_REASON}"
```

对于 MODE=last：
```bash
git commit -m "revert: undo ${N} selected commits — ${REVERT_REASON}"
```
</step>

<step name="summary">
显示完成横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 撤销完成 ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

显示摘要：
```
  ✓ 已回退 ${N} 个提交
  ✓ 已创建单个回退提交：${REVERT_HASH}
```

显示后续步骤：
```
───────────────────────────────────────────────────────────────

## ▶ 后续步骤

**检查状态** — 验证回退后项目处于预期状态

/clear 然后：

/gsd-progress

───────────────────────────────────────────────────────────────

**其他可用命令：**
- `/gsd-execute-phase ${PHASE}` — 若需要重新执行
- `/gsd-undo --last 1` — 若出了问题，撤销此次回退本身

───────────────────────────────────────────────────────────────
```
</step>

</process>

<success_criteria>
- [ ] 三种模式的参数均正确解析
- [ ] --phase 模式使用 manifest.phases[TARGET_PHASE].commits 读取 .planning/.phase-manifest.json
- [ ] --phase 模式在清单条目缺失时回退到 git log
- [ ] 依赖检查在下游阶段已开始时发出警告（MODE=phase）
- [ ] 依赖检查在后续计划引用目标计划输出时发出警告（MODE=plan）
- [ ] 若工作树有未提交改动，脏树检查中止操作
- [ ] 执行任何回退前显示确认门禁
- [ ] 回退使用 git revert --no-commit 按逆时间顺序执行
- [ ] 所有回退暂存后创建单个提交
- [ ] 错误处理清理首次调用和序列中间冲突情况
- [ ] 此工作流中绝不使用 git reset --hard
</success_criteria>
