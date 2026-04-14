<purpose>
验证已完成阶段的威胁缓解措施。确认 PLAN.md 威胁登记册中的处置措施已落实。更新 SECURITY.md。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<available_agent_types>
有效的 GSD 子 agent 类型（使用确切名称 — 不要回退到 'general-purpose'）：
- gsd-security-auditor — 验证威胁缓解措施覆盖情况
</available_agent_types>

<process>

## 0. 初始化

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_AUDITOR=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-security-auditor 2>/dev/null)
```

解析：`phase_dir`、`phase_number`、`phase_name`、`phase_slug`、`padded_phase`。

```bash
AUDITOR_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-security-auditor --raw)
SECURITY_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.security_enforcement --raw 2>/dev/null || echo "true")
```

若 `SECURITY_CFG` 为 `false`：退出并提示 "安全执行已禁用。通过 /gsd-settings 启用。"

显示横幅：`GSD > 安全阶段 {N}: {name}`

## 1. 检测输入状态

```bash
SECURITY_FILE=$(ls "${PHASE_DIR}"/*-SECURITY.md 2>/dev/null | head -1)
PLAN_FILES=$(ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null)
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
```

- **状态 A**（`SECURITY_FILE` 非空）：审计现有文件
- **状态 B**（`SECURITY_FILE` 为空，`PLAN_FILES` 和 `SUMMARY_FILES` 非空）：从产出物运行
- **状态 C**（`SUMMARY_FILES` 为空）：退出 — "第 {N} 阶段尚未执行。请先运行 /gsd-execute-phase {N}。"

## 2. 发现

### 2a. 读取阶段产出物

读取 PLAN.md — 提取 `<threat_model>` 块：信任边界、STRIDE 登记册（`threat_id`、`category`、`component`、`disposition`、`mitigation_plan`）。

### 2b. 读取摘要威胁标记

读取 SUMMARY.md — 提取 `## Threat Flags` 条目。

### 2c. 构建威胁登记册

每条威胁：`{ threat_id, category, component, disposition, mitigation_pattern, files_to_check }`

## 3. 威胁分类

对每条威胁进行分类：

| 状态 | 判定标准 |
|------|---------|
| 已关闭 | 已找到缓解措施，或在 SECURITY.md 中记录了已接受风险，或已记录转移 |
| 未关闭 | 以上情况均不满足 |

构建：`{ threat_id, category, component, disposition, status, evidence }`

若 `threats_open: 0` → 直接跳至第 6 步。

## 4. 呈现威胁计划


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` 参数）：** 若 `$ARGUMENTS` 中包含 `--text` 或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。TEXT_MODE 激活时，将所有 `AskUserQuestion` 调用替换为纯文本编号列表，要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需设置，因为这些运行时不支持 `AskUserQuestion`。
通过 AskUserQuestion 显示威胁表格并提供选项：
1. "验证所有未关闭威胁" → 第 5 步
2. "全部接受 — 记录到已接受风险日志" → 添加到 SECURITY.md 已接受风险，将所有设为已关闭，第 6 步
3. "取消" → 退出

## 5. 生成 gsd-security-auditor

```
Task(
  prompt="Read ~/.claude/agents/gsd-security-auditor.md for instructions.\n\n" +
    "<files_to_read>{PLAN, SUMMARY, impl files, SECURITY.md}</files_to_read>" +
    "<threat_register>{threat register}</threat_register>" +
    "<config>asvs_level: {SECURITY_ASVS}, block_on: {SECURITY_BLOCK_ON}</config>" +
    "<constraints>不修改实现文件。验证缓解措施是否存在 — 不扫描新威胁。上报实现差距。</constraints>" +
    "${AGENT_SKILLS_AUDITOR}",
  subagent_type="gsd-security-auditor",
  model="{AUDITOR_MODEL}",
  description="验证第 {N} 阶段的威胁缓解措施"
)
```

处理返回结果：
- `## SECURED` → 记录关闭情况 → 第 6 步
- `## OPEN_THREATS` → 记录已关闭和未关闭的威胁，向用户呈现接受/阻止选项 → 第 6 步
- `## ESCALATE` → 呈现给用户 → 第 6 步

## 6. 写入/更新 SECURITY.md

**状态 B（创建）：**
1. 从 `~/.claude/get-shit-done/templates/SECURITY.md` 读取模板
2. 填写：前置信息、威胁登记册、已接受风险、审计追踪
3. 写入 `${PHASE_DIR}/${PADDED_PHASE}-SECURITY.md`

**状态 A（更新）：**
1. 更新威胁登记册状态，追加到审计追踪：

```markdown
## 安全审计 {date}
| 指标 | 数量 |
|------|------|
| 发现的威胁 | {N} |
| 已关闭 | {M} |
| 未关闭 | {K} |
```

**强制门禁：** 若所有选项用尽后 `threats_open > 0`（用户未接受，未全部验证关闭）：

```
GSD > 第 {N} 阶段安全阻塞
{K} 个威胁未关闭 — 阶段推进已阻塞，直到 threats_open: 0
▶ 修复缓解措施后重新运行：/gsd-secure-phase {N}
▶ 或在 SECURITY.md 中记录已接受风险后重新运行。
```

不要输出下一阶段路由。在此停止。

## 7. 提交

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-${PHASE}): add/update security threat verification"
```

## 8. 结果 + 路由

**已安全（threats_open: 0）：**
```
GSD > 第 {N} 阶段威胁安全
threats_open: 0 — 所有威胁均已处置。
▶ /gsd-validate-phase {N}    验证测试覆盖
▶ /gsd-verify-work {N}       运行 UAT
```

显示 `/clear` 提醒。

</process>

<success_criteria>
- [ ] 已检查安全执行状态 — 若为 false 则退出
- [ ] 已检测输入状态（A/B/C）— 状态 C 干净退出
- [ ] 已解析 PLAN.md 威胁模型并构建登记册
- [ ] 已纳入 SUMMARY.md 威胁标记
- [ ] threats_open: 0 → 直接跳至第 6 步
- [ ] 已呈现包含威胁表格的用户门禁
- [ ] 已向审计器传递完整上下文并生成 agent
- [ ] 已处理三种返回格式（SECURED/OPEN_THREATS/ESCALATE）
- [ ] SECURITY.md 已创建或更新
- [ ] threats_open > 0 阻塞阶段推进（不输出下一阶段路由）
- [ ] 成功时呈现结果及路由
</success_criteria>
