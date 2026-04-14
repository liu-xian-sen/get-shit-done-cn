<purpose>
审查阶段中更改的源文件，查找 bug、安全问题和代码质量问题。计算文件范围（--files 覆盖 > SUMMARY.md > git diff 回退），检查配置开关，启动 gsd-code-reviewer agent，提交 REVIEW.md，并向用户呈现结果。
</purpose>

<required_reading>
在开始前，读取调用提示的 execution_context 引用的所有文件。
</required_reading>

<available_agent_types>
- gsd-code-reviewer：审查源文件中的 bug 和质量问题
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

**--depth 标志：**
```bash
DEPTH_OVERRIDE=""
for arg in "$@"; do
  if [[ "$arg" == --depth=* ]]; then
    DEPTH_OVERRIDE="${arg#--depth=}"
  fi
done
```

**--files 标志：**
```bash
FILES_OVERRIDE=""
for arg in "$@"; do
  if [[ "$arg" == --files=* ]]; then
    FILES_OVERRIDE="${arg#--files=}"
  fi
done
```

如果设置了 FILES_OVERRIDE，则按逗号拆分为数组：
```bash
if [ -n "$FILES_OVERRIDE" ]; then
  IFS=',' read -ra FILES_ARRAY <<< "$FILES_OVERRIDE"
fi
```
</step>

<step name="check_config_gate">
通过配置检查是否启用了代码审查：

```bash
CODE_REVIEW_ENABLED=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.code_review 2>/dev/null || echo "true")
```

如果 CODE_REVIEW_ENABLED 为 "false"：
```
代码审查已跳过（配置中 workflow.code_review=false）
```
退出工作流。

默认为 true — 仅在明确设为 false 时跳过。此检查在阶段验证**之后**执行，以便先显示无效阶段错误。
</step>

<step name="resolve_depth">
按优先级确定审查深度：

1. 来自 --depth 标志的 DEPTH_OVERRIDE（最高优先级）
2. 配置值：`node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.code_review_depth 2>/dev/null`
3. 默认值："standard"

```bash
if [ -n "$DEPTH_OVERRIDE" ]; then
  REVIEW_DEPTH="$DEPTH_OVERRIDE"
else
  CONFIG_DEPTH=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.code_review_depth 2>/dev/null || echo "")
  REVIEW_DEPTH="${CONFIG_DEPTH:-standard}"
fi
```

**验证深度值：**
```bash
case "$REVIEW_DEPTH" in
  quick|standard|deep)
    # 有效
    ;;
  *)
    echo "警告：无效的深度 '${REVIEW_DEPTH}'。有效值：quick、standard、deep。使用 'standard'。"
    REVIEW_DEPTH="standard"
    ;;
esac
```
</step>

<step name="compute_file_scope">
三层范围确定，具有明确优先级：

**第一层 — --files 覆盖（最高优先级）：**

如果设置了 FILES_OVERRIDE（来自 --files 标志）：
```bash
if [ -n "$FILES_OVERRIDE" ]; then
  REVIEW_FILES=()
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
  
  for file_path in "${FILES_ARRAY[@]}"; do
    # 安全：验证路径在仓库内（防止路径遍历）
    ABS_PATH=$(realpath -m "${file_path}" 2>/dev/null || echo "${file_path}")
    if [[ "$ABS_PATH" != "$REPO_ROOT"* ]]; then
      echo "错误：文件路径在仓库外，已跳过：${file_path}"
      continue
    fi
    
    # 验证路径存在（相对于仓库根目录）
    if [ -f "${REPO_ROOT}/${file_path}" ] || [ -f "${file_path}" ]; then
      REVIEW_FILES+=("$file_path")
    else
      echo "警告：文件未找到，已跳过：${file_path}"
    fi
  done
  
  echo "文件范围：来自 --files 覆盖的 ${#REVIEW_FILES[@]} 个文件"
fi
```

提供 --files 时，完全跳过 SUMMARY/git 范围确定。

**第二层 — SUMMARY.md 提取（主要方式）：**

如果未提供 --files：
```bash
if [ -z "$FILES_OVERRIDE" ]; then
  SUMMARIES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
  REVIEW_FILES=()
  
  if [ -n "$SUMMARIES" ]; then
    for summary in $SUMMARIES; do
      # 使用 node 可靠解析 YAML，提取 key_files.created 和 key_files.modified
      # 避免因缩进差异导致 awk 解析脆弱
      EXTRACTED=$(node -e "
        const fs = require('fs');
        const content = fs.readFileSync('$summary', 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) { process.exit(0); }
        const yaml = match[1];
        const files = [];
        let inSection = null;
        for (const line of yaml.split('\n')) {
          if (/^\s+created:/.test(line)) { inSection = 'created'; continue; }
          if (/^\s+modified:/.test(line)) { inSection = 'modified'; continue; }
          if (/^\s+\w+:/.test(line) && !/^\s+-/.test(line)) { inSection = null; continue; }
          if (inSection && /^\s+-\s+(.+)/.test(line)) {
            files.push(line.match(/^\s+-\s+(.+)/)[1].trim());
          }
        }
        if (files.length) console.log(files.join('\n'));
      " 2>/dev/null)
      
      # 将提取的文件添加到 REVIEW_FILES 数组
      if [ -n "$EXTRACTED" ]; then
        while IFS= read -r file; do
          if [ -n "$file" ]; then
            REVIEW_FILES+=("$file")
          fi
        done <<< "$EXTRACTED"
      fi
    done
    
    if [ ${#REVIEW_FILES[@]} -eq 0 ]; then
      echo "警告：找到 SUMMARY 产物但不包含文件路径。回退到 git diff。"
    fi
  fi
fi
```

**第三层 — Git diff 回退：**

如果未找到 SUMMARY.md 文件或未从中提取到文件：
```bash
if [ ${#REVIEW_FILES[@]} -eq 0 ]; then
  # 从阶段提交计算差异基础 — 如果找不到可靠的基础则失败关闭
  PHASE_COMMITS=$(git log --oneline --all --grep="${PADDED_PHASE}" --format="%H" 2>/dev/null)
  
  if [ -n "$PHASE_COMMITS" ]; then
    DIFF_BASE=$(echo "$PHASE_COMMITS" | tail -1)^
    
    # 验证父提交是否存在（仓库的第一个提交没有父提交）
    if ! git rev-parse "${DIFF_BASE}" >/dev/null 2>&1; then
      DIFF_BASE=$(echo "$PHASE_COMMITS" | tail -1)
    fi
    
    # 运行 git diff 并排除特定文件
    DIFF_FILES=$(git diff --name-only "${DIFF_BASE}..HEAD" -- . \
      ':!.planning/' ':!ROADMAP.md' ':!STATE.md' \
      ':!*-SUMMARY.md' ':!*-VERIFICATION.md' ':!*-PLAN.md' \
      ':!package-lock.json' ':!yarn.lock' ':!Gemfile.lock' ':!poetry.lock' 2>/dev/null)
    
    while IFS= read -r file; do
      [ -n "$file" ] && REVIEW_FILES+=("$file")
    done <<< "$DIFF_FILES"
    
    echo "文件范围：来自 git diff 的 ${#REVIEW_FILES[@]} 个文件（基础：${DIFF_BASE}）"
  else
    # 失败关闭 — 未找到可靠的差异基础。不使用任意的 HEAD~N。
    echo "警告：未找到 '${PADDED_PHASE}' 的阶段提交。无法确定可靠的差异范围。"
    echo "使用 --files 标志明确指定文件：/gsd-code-review ${PHASE_ARG} --files=file1,file2,..."
  fi
fi
```

**后处理（所有层）：**

1. **应用排除规则：** 移除与规划产物匹配的路径
```bash
FILTERED_FILES=()
for file in "${REVIEW_FILES[@]}"; do
  # 跳过规划目录和特定产物
  if [[ "$file" == .planning/* ]] || \
     [[ "$file" == ROADMAP.md ]] || \
     [[ "$file" == STATE.md ]] || \
     [[ "$file" == *-SUMMARY.md ]] || \
     [[ "$file" == *-VERIFICATION.md ]] || \
     [[ "$file" == *-PLAN.md ]]; then
    continue
  fi
  FILTERED_FILES+=("$file")
done
REVIEW_FILES=("${FILTERED_FILES[@]}")
```

2. **过滤已删除文件：** 移除磁盘上不存在的路径
```bash
EXISTING_FILES=()
DELETED_COUNT=0
for file in "${REVIEW_FILES[@]}"; do
  if [ -f "$file" ]; then
    EXISTING_FILES+=("$file")
  else
    DELETED_COUNT=$((DELETED_COUNT + 1))
  fi
done
REVIEW_FILES=("${EXISTING_FILES[@]}")

if [ $DELETED_COUNT -gt 0 ]; then
  echo "从审查范围中过滤了 $DELETED_COUNT 个已删除文件"
fi
```

3. **去重：** 移除重复路径（可移植 — 兼容 bash 3.2+，处理路径中的空格）
```bash
DEDUPED=()
while IFS= read -r line; do
  [ -n "$line" ] && DEDUPED+=("$line")
done < <(printf '%s\n' "${REVIEW_FILES[@]}" | sort -u)
REVIEW_FILES=("${DEDUPED[@]}")
```

4. **排序：** 按字母顺序排序以保证 agent 输入可重复（已由 sort -u 排序）

**记录最终范围并在文件过多时警告：**
```bash
if [ -n "$FILES_OVERRIDE" ]; then
  TIER="--files 覆盖"
elif [ -n "$SUMMARIES" ] && [ ${#REVIEW_FILES[@]} -gt 0 ]; then
  TIER="SUMMARY.md"
else
  TIER="git diff"
fi
echo "文件范围：来自 ${TIER} 的 ${#REVIEW_FILES[@]} 个文件"

# 如果文件数量非常多则警告 — 可能超出 agent 上下文或导致审查过于粗略
if [ ${#REVIEW_FILES[@]} -gt 50 ]; then
  echo "警告：${#REVIEW_FILES[@]} 个文件是较大的审查范围。"
  echo "考虑使用 --files 缩小范围，或使用 --depth=quick 进行更快的检查。"
  if [ "$REVIEW_DEPTH" = "deep" ]; then
    echo "对于大文件数量，从 deep 切换到 standard 深度。"
    REVIEW_DEPTH="standard"
  fi
fi
```
</step>

<step name="check_empty_scope">
如果 REVIEW_FILES 为空：
```
第 ${PHASE_ARG} 阶段中没有更改的源文件。跳过审查。
```
退出工作流。不要启动 agent 或创建 REVIEW.md。
</step>

<step name="spawn_reviewer">
计算审查输出路径：
```bash
REVIEW_PATH="${PHASE_DIR}/${PADDED_PHASE}-REVIEW.md"
```

计算 agent 上下文需要的 DIFF_BASE：
```bash
PHASE_COMMITS=$(git log --oneline --all --grep="${PADDED_PHASE}" --format="%H" 2>/dev/null)
if [ -n "$PHASE_COMMITS" ]; then
  DIFF_BASE=$(echo "$PHASE_COMMITS" | tail -1)^
else
  DIFF_BASE=""
fi
```

为 agent 构建 files_to_read 块：
```bash
FILES_TO_READ=""
for file in "${REVIEW_FILES[@]}"; do
  FILES_TO_READ+="- ${file}\n"
done
```

为 agent 构建 config 块：
```bash
CONFIG_FILES=""
for file in "${REVIEW_FILES[@]}"; do
  CONFIG_FILES+="  - ${file}\n"
done
```

启动 gsd-code-reviewer agent：

```
Task(subagent_type="gsd-code-reviewer", prompt="
<files_to_read>
${FILES_TO_READ}
</files_to_read>

<config>
depth: ${REVIEW_DEPTH}
phase_dir: ${PHASE_DIR}
review_path: ${REVIEW_PATH}
${DIFF_BASE:+diff_base: ${DIFF_BASE}}
files:
${CONFIG_FILES}
</config>

以 ${REVIEW_DEPTH} 深度审查列出的源文件。将发现项写入 ${REVIEW_PATH}。
不要提交输出 — 编排器负责处理。
")
```

**Agent 失败处理：**

如果 Task() 调用失败（agent 错误、超时或异常）：
```
错误：代码审查 agent 失败：${error_message}

未创建 REVIEW.md。您可以使用 /gsd-code-review ${PHASE_ARG} 重试，或检查 agent 日志。
```

不要继续执行 commit_review 步骤。不要创建部分或空的 REVIEW.md。退出工作流。
</step>

<step name="commit_review">
agent 成功完成后，验证 REVIEW.md 已创建且具有有效结构：

```bash
if [ -f "${REVIEW_PATH}" ]; then
  # 验证 REVIEW.md 具有包含 status 字段的有效 YAML frontmatter
  HAS_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
    const fs = require('fs');
    const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match && /status:/.test(match[1])) { console.log('valid'); } else { console.log('invalid'); }
  " 2>/dev/null)
  
  if [ "$HAS_STATUS" = "valid" ]; then
    echo "REVIEW.md 已创建于 ${REVIEW_PATH}"
    
    if [ "$COMMIT_DOCS" = "true" ]; then
      node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
        "docs(${PADDED_PHASE}): add code review report" \
        --files "${REVIEW_PATH}"
    fi
  else
    echo "警告：REVIEW.md 存在但 frontmatter 无效或缺失（无 status 字段）。"
    echo "Agent 可能产生了格式错误的输出。不提交。请手动检查：${REVIEW_PATH}"
  fi
else
  echo "警告：Agent 已完成但未在 ${REVIEW_PATH} 找到 REVIEW.md。这可能表示 agent 存在问题。"
  echo "没有 REVIEW.md 可提交。请使用 /gsd-code-review ${PHASE_ARG} 重试"
fi
```
</step>

<step name="present_results">
读取 REVIEW.md 的 YAML frontmatter 以提取发现项计数。

首先提取 `---` 分隔符之间的 frontmatter，避免匹配审查正文中的值：

```bash
# 仅提取 YAML frontmatter 块（第一对 --- 之间的内容）
FRONTMATTER=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) process.stdout.write(match[1]);
" 2>/dev/null)

# 仅从 frontmatter 中解析字段（不解析完整文件）
STATUS=$(echo "$FRONTMATTER" | grep "^status:" | cut -d: -f2 | xargs)
FILES_REVIEWED=$(echo "$FRONTMATTER" | grep "^files_reviewed:" | cut -d: -f2 | xargs)
CRITICAL=$(echo "$FRONTMATTER" | grep "critical:" | head -1 | cut -d: -f2 | xargs)
WARNING=$(echo "$FRONTMATTER" | grep "warning:" | head -1 | cut -d: -f2 | xargs)
INFO=$(echo "$FRONTMATTER" | grep "info:" | head -1 | cut -d: -f2 | xargs)
TOTAL=$(echo "$FRONTMATTER" | grep "total:" | head -1 | cut -d: -f2 | xargs)
```

向用户显示内联摘要：

```
═══════════════════════════════════════════════════════════════

  代码审查完成：第 ${PHASE_NUMBER} 阶段（${PHASE_NAME}）

───────────────────────────────────────────────────────────────

  深度：           ${REVIEW_DEPTH}
  已审查文件：     ${FILES_REVIEWED}
  
  发现项：
    严重：     ${CRITICAL}
    警告：     ${WARNING}
    信息：     ${INFO}
    ──────────
    总计：     ${TOTAL}

───────────────────────────────────────────────────────────────
```

如果状态为 "clean"：
```
✓ 未发现问题。所有 ${FILES_REVIEWED} 个文件在 ${REVIEW_DEPTH} 深度下通过审查。

完整报告：${REVIEW_PATH}
```

如果总发现项 > 0：
```
⚠ 发现问题。查看报告了解详情。

完整报告：${REVIEW_PATH}

下一步：
  /gsd-code-review-fix ${PHASE_NUMBER}  — 自动修复问题
  cat ${REVIEW_PATH}                     — 查看完整报告
```

如果 critical > 0 或 warning > 0，内联列出前 3 个问题：
```bash
echo "主要问题："
grep -A 3 "^### CR-\|^### WR-" "${REVIEW_PATH}" | head -n 12
```

**关于测试的注意事项：** 此命令和工作流的自动化测试计划在第 4 阶段（流水线集成与测试，需求 INFR-03）中进行。第 2 阶段专注于正确实现；第 4 阶段添加跨平台的回归覆盖。

═══════════════════════════════════════════════════════════════
</step>

</process>

<platform_notes>
**Windows：** 此工作流使用 bash 特性（数组、进程替换）。在 Windows 上需要 Git Bash 或 WSL。不支持原生 PowerShell。CI 矩阵（Ubuntu/macOS/Windows）在 Windows runner 上使用 Git Bash 运行，提供 bash 兼容性。

**macOS：** macOS 自带 bash 3.2（GPL 许可）。此工作流**不**使用 `mapfile`（仅 bash 4+ 支持）— 所有数组构建使用兼容 bash 3.2 的可移植 `while IFS= read -r` 循环。`--files` 路径验证使用 `realpath -m`，需要 GNU coreutils（通过 `brew install coreutils` 安装）。没有 coreutils 时，路径验证回退到失败关闭行为（拒绝无法验证的路径），因此安全性得以维护，但有效的相对路径可能被拒绝。如果 macOS 上 `--files` 验证意外失败，请安装 coreutils 或使用绝对路径。
</platform_notes>

<success_criteria>
- [ ] 阶段在配置开关检查之前已验证
- [ ] 配置开关已检查（workflow.code_review）
- [ ] 深度已解析并验证（quick|standard|deep）
- [ ] 文件范围以 3 层计算：--files > SUMMARY.md > git diff
- [ ] 格式错误/缺失的 SUMMARY.md 已优雅处理并回退
- [ ] 已删除的文件从范围中过滤
- [ ] 文件已去重和排序
- [ ] 空范围导致跳过（不启动 agent）
- [ ] Agent 以明确的文件列表、深度、review_path、diff_base 启动
- [ ] Agent 失败已处理，不产生部分提交
- [ ] REVIEW.md 创建后已提交
- [ ] 结果内联呈现，附带下一步建议
</success_criteria>
