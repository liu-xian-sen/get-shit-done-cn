<purpose>
苏格拉底式构思工作流。通过探索性问题引导开发者探讨一个想法，在有益时提供中途研究，然后将结晶后的输出路由到 GSD 制品。
</purpose>

<required_reading>
在开始前，读取调用提示的 execution_context 中引用的所有文件。

@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/references/domain-probes.md
</required_reading>

<available_agent_types>
有效的 GSD 子 Agent 类型（请使用确切名称——不要退化为 'general-purpose'）：
- gsd-phase-researcher — 研究具体问题并返回简洁发现
</available_agent_types>

<process>

## 步骤 1：开启对话

如果提供了主题，确认并开始探索：
```
## 探索：{topic}

让我们一起思考这个问题。我会提出问题帮助澄清想法，
然后再决定是否创建制品。
```

如果没有主题，询问：
```
## 探索

您在思考什么？可以是功能想法、架构问题、
您正在尝试解决的问题，或您还不确定的事情。
```

## 步骤 2：苏格拉底式对话（2-5 轮）

使用 `questioning.md` 和 `domain-probes.md` 中的原则引导对话：

- **每次只问一个问题**（绝不一次提出一组问题）
- 问题应探究：约束、权衡、用户、范围、依赖、风险
- 当话题涉及已知领域时，在上下文中使用特定领域的探针
- 留意信号："或"/"versus"/"权衡"表明值得探索的竞争优先级
- 在继续之前反映你所听到的内容以确认理解

**对话应该感觉自然，而非程式化。** 避免僵硬的顺序。跟随开发者的关注点——如果他们对某个方面感到兴奋，就深入探讨。

## 步骤 3：中途研究提议（2-3 轮后）

如果对话浮现了研究可以解答的事实性问题、技术比较或未知点，提议：

```
这涉及到 [具体问题]。在继续之前要我做一次快速研究吗？
大约需要 30 秒，可能会带来有用的上下文。

[是的，研究这个] / [不，继续探索]
```

如果是，生成一个研究 Agent：
```
Task(
  prompt="快速研究：{specific_question}。返回 3-5 个关键发现，不超过 200 字。",
  subagent_type="gsd-phase-researcher"
)
```

分享发现并继续对话。

如果话题不需要研究，完全跳过此步骤。**不要强迫它。**

## 步骤 4：结晶输出（3-6 轮后）

当对话达到自然结论或开发者发出准备就绪的信号时，提议输出。分析对话以识别讨论内容，并从以下建议**最多 4 个输出**：

| 类型 | 目标位置 | 建议时机 |
|------|---------|---------|
| 笔记 | `.planning/notes/{slug}.md` | 值得记住的观察、上下文、决策 |
| 待办 | `.planning/todos/pending/{slug}.md` | 从对话中识别出的具体可行任务 |
| 种子 | `.planning/seeds/{slug}.md` | 有触发条件的前瞻性想法 |
| 研究问题 | `.planning/research/questions.md`（追加） | 需要更深入调查的开放性问题 |
| 需求 | `REQUIREMENTS.md`（追加） | 从讨论中涌现的明确需求 |
| 新阶段 | `ROADMAP.md`（追加） | 值得独立阶段的足够大范围 |

呈现建议：
```
根据我们的对话，我建议捕获以下内容：

1. **笔记：** "认证策略决策" — 您关于 JWT 与会话的推理
2. **待办：** "评估 Passport.js 与自定义中间件" — 您想进行的比较
3. **种子：** "OAuth2 提供商支持" — 触发条件：当用户管理阶段开始时

要创建这些吗？您可以选择特定的或修改它们。

[全部创建] / [让我选择] / [跳过——只是探索]
```

**未经用户明确选择，绝不写入制品。**

## 步骤 5：写入选定的输出

对于每个选定的输出，写入文件：

- **笔记：** 创建 `.planning/notes/{slug}.md`，附元数据（title、date、context）
- **待办：** 创建 `.planning/todos/pending/{slug}.md`，附元数据（title、date、priority）
- **种子：** 创建 `.planning/seeds/{slug}.md`，附元数据（title、trigger_condition、planted_date）
- **研究问题：** 追加到 `.planning/research/questions.md`
- **需求：** 追加到 `.planning/REQUIREMENTS.md`，附下一个可用的 REQ ID
- **阶段：** 通过 SlashCommand 使用现有的 `/gsd-add-phase` 命令

如果启用了 `commit_docs`，则提交：
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: capture exploration — {topic_slug}" --files {file_list}
```

## 步骤 6：收尾

```
## 探索完成

**主题：** {topic}
**输出：** 已创建 {count} 个制品
{已创建文件列表}

继续探索请使用 `/gsd-explore`，或开始工作请使用 `/gsd-next`。
```

</process>

<success_criteria>
- [ ] 苏格拉底式对话遵循 questioning.md 原则
- [ ] 每次只问一个问题，不批量提问
- [ ] 研究按上下文提供（不强制）
- [ ] 从对话中提议最多 4 个输出
- [ ] 用户明确选择要创建哪些输出
- [ ] 文件写入正确的目标位置
- [ ] 提交遵守 commit_docs 配置
</success_criteria>
