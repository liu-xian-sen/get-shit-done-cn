<purpose>
从 REVIEW.md 中自动修复问题。验证阶段、检查配置开关、核实 REVIEW.md 存在且有可修复的问题，启动 gsd-code-fixer agent，处理 --auto 迭代循环（上限 3 次），最后一次性提交 REVIEW-FIX.md，并呈现结果。
</purpose>

<required_reading>
在开始前，读取调用提示的 execution_context 引用的所有文件。
</required_reading>

<available_agent_types>
- gsd-code-fixer：对代码审查发现项应用修复
- gsd-code-reviewer：对源文件进行 bug 和问题审查
</available_agent_types>

<process>

<step name="initialize">
解析参数并加载项目状态：

```bash
PHASE_ARG="${1}"
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从初始化 JSON 中解析：`phase_found`、`phase_dir`、`phase_number`、`phase_name`、`padded_phase`、`commit_docs`。

**输入清洗（纵深防御）：**
```bash
# 验证 PADDED_PHASE 仅包含数字和可选点号（如 "02"、"03.1"）
if ! [[ "$PADDED_PHASE" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "错误：阶段编号格式无效：'${PADDED_PHASE}'。期望格式为数字（如 02、03.1）。"
  # 退出工作流
fi
```

**阶段验证（在配置开关检查之前）：**
如果 `phase_found` 为 false，报错并退出：
```
错误：未找到阶段 ${PHASE_ARG}。运行 /gsd-status 查看可用阶段。
```

此操作在配置开关检查**之前**执行，以便无论配置状态如何，用户错误都能立即浮现。

从 $ARGUMENTS 中解析可选标志：

```bash
FIX_ALL=false
AUTO_MODE=false
for arg in "$@"; do
  if [[ "$arg" == "--all" ]]; then FIX_ALL=true; fi
  if [[ "$arg" == "--auto" ]]; then AUTO_MODE=true; fi
done
```

计算范围变量：

```bash
if [ "$FIX_ALL" = "true" ]; then
  FIX_SCOPE="all"
else
  FIX_SCOPE="critical_warning"
fi
```

计算审查和修复报告路径：

```bash
REVIEW_PATH="${PHASE_DIR}/${PADDED_PHASE}-REVIEW.md"
FIX_REPORT_PATH="${PHASE_DIR}/${PADDED_PHASE}-REVIEW-FIX.md"
```
</step>

<step name="check_config_gate">
通过配置检查是否启用了代码审查：

```bash
CODE_REVIEW_ENABLED=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.code_review 2>/dev/null || echo "true")
```

如果 CODE_REVIEW_ENABLED 为 "false"：
```
代码审查修复已跳过（配置中 workflow.code_review=false）
```
退出工作流。

默认为 true — 仅在明确设为 false 时跳过。此检查在阶段验证**之后**执行，以便先显示无效阶段错误。

注意：此处复用 `workflow.code_review` 配置键，而非引入单独的 `workflow.code_review_fix` 键。原因：没有审查，修复毫无意义，因此使用单一开关合乎逻辑。如需独立控制，可在 v2 中添加单独的键。
</step>

<step name="check_review_exists">
验证 REVIEW.md 是否存在：

```bash
if [ ! -f "${REVIEW_PATH}" ]; then
  echo "错误：未找到第 ${PHASE_ARG} 阶段的 REVIEW.md。请先运行 /gsd-code-review ${PHASE_ARG}。"
  exit 1
fi
```

不要自动运行代码审查。需要用户明确操作，以确保审查意图清晰。
</step>

<step name="check_review_status">
解析 REVIEW.md 的 frontmatter 以检查状态，并提取 --auto 循环的上下文：

```bash
# 解析 status 字段
REVIEW_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match && /status:\s*(\S+)/.test(match[1])) {
    console.log(match[1].match(/status:\s*(\S+)/)[1]);
  } else {
    console.log('unknown');
  }
" 2>/dev/null)
```

如果状态为 "clean" 或 "skipped"：
```
第 ${PHASE_ARG} 阶段 REVIEW.md 中没有需要修复的问题（状态：${REVIEW_STATUS}）。
```
退出工作流。

如果状态为 "unknown"：
```
警告：无法解析 REVIEW.md 状态。继续尝试修复。
```

提取 --auto 重新审查的审查深度：

```bash
REVIEW_DEPTH=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match && /depth:\s*(\S+)/.test(match[1])) {
    console.log(match[1].match(/depth:\s*(\S+)/)[1]);
  } else {
    console.log('standard');
  }
" 2>/dev/null)
```

提取原始审查文件列表，用于 --auto 重新审查时的范围持久化：

```bash
# 提取审查文件列表 — 兼容 bash 3.2+（不使用 mapfile，处理路径中的空格）
REVIEW_FILES_ARRAY=()
while IFS= read -r line; do
  [ -n "$line" ] && REVIEW_FILES_ARRAY+=("$line")
done < <(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    const fm = match[1];
    // 尝试 YAML 数组格式：files_reviewed_list: [file1, file2]
    const bracketMatch = fm.match(/files_reviewed_list:\s*\[([^\]]+)\]/);
    if (bracketMatch) {
      bracketMatch[1].split(',').map(f => f.trim()).filter(Boolean).forEach(f => console.log(f));
    } else {
      // 尝试 YAML 列表格式：files_reviewed_list:\n  - file1\n  - file2
      let inList = false;
      for (const line of fm.split('\n')) {
        if (/files_reviewed_list:/.test(line)) { inList = true; continue; }
        if (inList && /^\s+-\s+(.+)/.test(line)) { console.log(line.match(/^\s+-\s+(.+)/)[1].trim()); }
        else if (inList && /^\S/.test(line)) { break; }
      }
    }
  }
" 2>/dev/null)
```

如果 REVIEW.md 的 frontmatter 包含 `files_reviewed_list` 字段，则将其用作重新审查范围。如果不存在，则回退到对完整阶段重新审查（与初始代码审查行为相同）。
</step>

<step name="spawn_fixer">
启动 gsd-code-fixer agent，传入配置：

```bash
# 为 agent 构建配置
echo "正在应用来自 ${REVIEW_PATH} 的修复..."
echo "修复范围：${FIX_SCOPE}"
```

使用 Task() 启动 agent：

```
Task(subagent_type="gsd-code-fixer", prompt="
<files_to_read>
${REVIEW_PATH}
</files_to_read>

<config>
phase_dir: ${PHASE_DIR}
padded_phase: ${PADDED_PHASE}
review_path: ${REVIEW_PATH}
fix_scope: ${FIX_SCOPE}
fix_report_path: ${FIX_REPORT_PATH}
iteration: 1
</config>

读取 REVIEW.md 发现项，应用修复，原子提交每个修复，写入 REVIEW-FIX.md。不要提交 REVIEW-FIX.md（编排器负责处理）。
")
```

**Agent 失败处理：**

如果 Task() 失败：
```
错误：代码修复 agent 失败：${error_message}
```

检查 FIX_REPORT_PATH 是否存在：
- 如果存在："部分成功 — 某些修复可能已提交。"
- 如果不存在："未应用任何修复。"

无论哪种情况：
```
某些修复提交可能已存在于 git 历史中 — 检查 git log 中的 fix(${PADDED_PHASE}) 提交。
您可以使用 /gsd-code-review-fix ${PHASE_ARG} 重试。
```

退出工作流（跳过 auto 循环）。
</step>

<step name="auto_iteration_loop">
仅在 AUTO_MODE 为 true 时运行。如果 AUTO_MODE 为 false，完全跳过此步骤。

```bash
if [ "$AUTO_MODE" = "true" ]; then
  # 迭代语义：初始修复（步骤 5）为第 1 次迭代。
  # 此循环运行第 2..MAX_ITERATIONS 次（重新审查 + 重新修复周期）。
  # 总修复次数 = MAX_ITERATIONS。循环使用 -lt（而非 -le）是有意为之。
  ITERATION=1
  MAX_ITERATIONS=3
  
  while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  --auto：开始第 ${ITERATION}/${MAX_ITERATIONS} 次迭代"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    
    # 使用与原始审查相同的深度和文件范围重新审查
    echo "正在以 ${REVIEW_DEPTH} 深度重新审查第 ${PHASE_ARG} 阶段..."
    
    # 在覆盖前备份之前的 REVIEW.md 和 REVIEW-FIX.md
    if [ -f "${REVIEW_PATH}" ]; then
      cp "${REVIEW_PATH}" "${REVIEW_PATH%.md}.iter${ITERATION}.md" 2>/dev/null || true
    fi
    if [ -f "${FIX_REPORT_PATH}" ]; then
      cp "${FIX_REPORT_PATH}" "${FIX_REPORT_PATH%.md}.iter${ITERATION}.md" 2>/dev/null || true
    fi
    
    # 如果原始审查有明确的文件列表，安全地将其传递给重新审查 agent
    FILES_CONFIG=""
    if [ ${#REVIEW_FILES_ARRAY[@]} -gt 0 ]; then
      FILES_CONFIG="files:"
      for f in "${REVIEW_FILES_ARRAY[@]}"; do
        FILES_CONFIG="${FILES_CONFIG}
  - ${f}"
      done
    fi
    
    # 启动 gsd-code-reviewer agent 进行重新审查
    # （这会用最新审查状态覆盖 REVIEW_PATH）
    Task(subagent_type="gsd-code-reviewer", prompt="
<config>
depth: ${REVIEW_DEPTH}
phase_dir: ${PHASE_DIR}
review_path: ${REVIEW_PATH}
${FILES_CONFIG}
</config>

以 ${REVIEW_DEPTH} 深度重新审查阶段。将发现项写入 ${REVIEW_PATH}。
不要提交输出 — 编排器负责处理。
")
    
    # 检查新的 REVIEW.md 状态
    NEW_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
      const fs = require('fs');
      const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (match && /status:\s*(\S+)/.test(match[1])) {
        console.log(match[1].match(/status:\s*(\S+)/)[1]);
      } else {
        console.log('unknown');
      }
    " 2>/dev/null)
    
    if [ "$NEW_STATUS" = "clean" ]; then
      echo ""
      echo "✓ 经过第 ${ITERATION} 次迭代后，所有问题已解决。"
      break
    fi
    
    # 仍有问题 — 再次启动修复器
    echo "问题仍然存在。正在应用第 ${ITERATION} 次迭代的修复..."
    
    Task(subagent_type="gsd-code-fixer", prompt="
<files_to_read>
${REVIEW_PATH}
</files_to_read>

<config>
phase_dir: ${PHASE_DIR}
padded_phase: ${PADDED_PHASE}
review_path: ${REVIEW_PATH}
fix_scope: ${FIX_SCOPE}
fix_report_path: ${FIX_REPORT_PATH}
iteration: ${ITERATION}
</config>

读取 REVIEW.md 发现项，应用修复，原子提交每个修复，写入 REVIEW-FIX.md（覆盖之前的）。不要提交 REVIEW-FIX.md。
")
    
    # 检查修复器是否成功
    if [ ! -f "${FIX_REPORT_PATH}" ]; then
      echo "警告：第 ${ITERATION} 次迭代的修复器未能生成修复报告。停止 auto 循环。"
      break
    fi
  done
  
  # 循环完成后
  if [ $ITERATION -ge $MAX_ITERATIONS ]; then
    echo ""
    echo "⚠ 已达到最大迭代次数（${MAX_ITERATIONS}）。剩余问题已记录在 REVIEW-FIX.md 中。"
  fi
fi
```

--auto 的关键设计决策（解决所有高级审查关注点）：
1. **重新审查范围**：使用原始 REVIEW.md frontmatter 中的 REVIEW_FILES_ARRAY，回退到完整阶段范围。范围在迭代间**不丢失**。使用可移植的 while-read 循环（兼容 bash 3.2+，处理路径中的空格）。
2. **产物语义**：REVIEW.md 被每次重新审查覆盖（最新审查状态）。REVIEW-FIX.md 被每次修复器迭代覆盖（包含迭代计数的最新修复状态）。每个产物**只有一个最终版本**，而非每次迭代的副本。备份文件（.iterN.md）保存历史记录，供后续分析使用（如果迭代质量下降）。
3. **提交时机**：修复提交在 agent 内部按发现项进行。REVIEW-FIX.md **直到步骤 7 才提交**（所有迭代完成后）。只有**一次** REVIEW-FIX.md 的文档提交，而非每次迭代一次。
</step>

<step name="commit_fix_report">
所有迭代完成后（或非 auto 模式下的单次处理），验证并提交 REVIEW-FIX.md：

```bash
if [ -f "${FIX_REPORT_PATH}" ]; then
  # 验证 REVIEW-FIX.md 具有包含 status 字段的有效 YAML frontmatter
  HAS_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
    const fs = require('fs');
    const content = fs.readFileSync(process.env.FIX_REPORT_PATH, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match && /status:/.test(match[1])) { console.log('valid'); } else { console.log('invalid'); }
  " 2>/dev/null)
  
  if [ "$HAS_STATUS" = "valid" ]; then
    echo "REVIEW-FIX.md 已创建于 ${FIX_REPORT_PATH}"
    
    if [ "$COMMIT_DOCS" = "true" ]; then
      node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
        "docs(${PADDED_PHASE}): add code review fix report" \
        --files "${FIX_REPORT_PATH}"
    fi
  else
    echo "警告：REVIEW-FIX.md 的 frontmatter 无效（缺少 status 字段）。不提交。"
    echo "Agent 可能产生了格式错误的输出。请手动检查：${FIX_REPORT_PATH}"
  fi
else
  echo "警告：未在 ${FIX_REPORT_PATH} 找到 REVIEW-FIX.md。"
  echo "Agent 可能在写入报告前失败。"
  echo "检查 git log 中是否有已应用的 fix(${PADDED_PHASE}) 提交。"
fi
```

此提交在工作流结束时**只发生一次**，在所有迭代完成后（如果是 --auto 模式）。不是每次迭代都提交。
</step>

<step name="present_results">
解析 REVIEW-FIX.md frontmatter，并向用户呈现格式化摘要。

首先检查修复报告是否存在：

```bash
if [ ! -f "${FIX_REPORT_PATH}" ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "  ⚠ 未生成修复报告"
  echo ""
  echo "───────────────────────────────────────────────────────────────"
  echo ""
  echo "修复 agent 可能在完成前失败。"
  echo "检查 git log 中是否有 fix(${PADDED_PHASE}) 提交。"
  echo ""
  echo "重试：/gsd-code-review-fix ${PHASE_ARG}"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  exit 1
fi
```

提取 frontmatter 字段：

```bash
# 仅提取 YAML frontmatter 块（第一对 --- 之间的内容）
FIX_FRONTMATTER=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.FIX_REPORT_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) process.stdout.write(match[1]);
" 2>/dev/null)

# 仅从 frontmatter 中解析字段（不解析完整文件）
FIX_STATUS=$(echo "$FIX_FRONTMATTER" | grep "^status:" | cut -d: -f2 | xargs)
FINDINGS_IN_SCOPE=$(echo "$FIX_FRONTMATTER" | grep "^findings_in_scope:" | cut -d: -f2 | xargs)
FIXED_COUNT=$(echo "$FIX_FRONTMATTER" | grep "^fixed:" | cut -d: -f2 | xargs)
SKIPPED_COUNT=$(echo "$FIX_FRONTMATTER" | grep "^skipped:" | cut -d: -f2 | xargs)
ITERATION_COUNT=$(echo "$FIX_FRONTMATTER" | grep "^iteration:" | cut -d: -f2 | xargs)
```

向用户显示格式化的内联摘要：

```bash
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  代码审查修复完成：第 ${PHASE_NUMBER} 阶段（${PHASE_NAME}）"
echo ""
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "  修复范围：     ${FIX_SCOPE}"
echo "  发现项：       ${FINDINGS_IN_SCOPE}"
echo "  已修复：       ${FIXED_COUNT}"
echo "  已跳过：       ${SKIPPED_COUNT}"
if [ "$AUTO_MODE" = "true" ]; then
  echo "  迭代次数：     ${ITERATION_COUNT}"
fi
echo "  状态：         ${FIX_STATUS}"
echo ""
echo "───────────────────────────────────────────────────────────────"
echo ""
```

如果状态为 "all_fixed"：
```bash
if [ "$FIX_STATUS" = "all_fixed" ]; then
  echo "✓ 所有问题已解决。"
  echo ""
  echo "完整报告：${FIX_REPORT_PATH}"
  echo ""
  echo "下一步："
  echo "  /gsd-verify-work  — 验证阶段完成"
  echo ""
fi
```

如果状态为 "partial" 或 "none_fixed"：
```bash
if [ "$FIX_STATUS" = "partial" ] || [ "$FIX_STATUS" = "none_fixed" ]; then
  echo "⚠ 部分问题无法自动修复。"
  echo ""
  echo "完整报告：${FIX_REPORT_PATH}"
  echo ""
  echo "下一步："
  echo "  cat ${FIX_REPORT_PATH}                     — 查看修复报告"
  echo "  /gsd-code-review ${PHASE_NUMBER}           — 重新审查代码"
  echo "  /gsd-verify-work                           — 验证阶段完成"
  echo ""
fi
```

```bash
echo "═══════════════════════════════════════════════════════════════"
```
</step>

</process>

<platform_notes>
**Windows：** 此工作流使用 bash 特性（数组、变量展开、while 循环）。在 Windows 上需要 Git Bash 或 WSL。不支持原生 PowerShell。CI 矩阵（Ubuntu/macOS/Windows）在 Windows runner 上使用 Git Bash 运行，提供 bash 兼容性。
</platform_notes>

<success_criteria>
- [ ] 阶段在配置开关检查之前已验证
- [ ] 配置开关已检查（workflow.code_review）
- [ ] REVIEW.md 存在性已验证（缺失时报错）
- [ ] REVIEW.md 状态已检查（clean/skipped 时跳过）
- [ ] Agent 以正确配置启动（review_path、fix_scope、fix_report_path）
- [ ] Agent 失败已处理，具有部分成功感知（某些修复提交可能已存在）
- [ ] --auto 迭代循环遵守 3 次迭代上限
- [ ] --auto 重新审查使用持久化的文件范围（迭代间不丢失）
- [ ] REVIEW-FIX.md 在所有迭代后**只提交一次**（不是每次迭代）
- [ ] 缺少修复报告时在 present_results 中给出明确错误信息
- [ ] 结果内联呈现，附带下一步建议
</success_criteria>
