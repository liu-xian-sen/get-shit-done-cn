# AI 框架决策矩阵

> 供 `gsd-framework-selector` 和 `gsd-ai-researcher` 使用的参考文档。
> 提炼自官方文档、基准测试和开发者报告（2026 年）。

---

## 快速选择

| 场景 | 选择 |
|-----------|------|
| 最简单的 agent 实现路径（OpenAI） | OpenAI Agents SDK |
| 最简单的 agent 实现路径（模型无关） | CrewAI |
| 生产级 RAG / 文档问答 | LlamaIndex |
| 带分支的复杂有状态工作流 | LangGraph |
| 具有明确角色的多 agent 团队 | CrewAI |
| 代码感知自主 agent（Anthropic） | Claude Agent SDK |
| "我还不清楚需求" | LangChain |
| 受监管 / 需要审计追踪 | LangGraph |
| 企业 Microsoft/.NET 技术栈 | AutoGen/AG2 |
| Google Cloud / 致力于 Gemini 的团队 | Google ADK |
| 有显式控制的纯 NLP 流水线 | Haystack |

---

## 框架详情

### CrewAI
- **类型：** 多 agent 编排
- **语言：** 仅 Python
- **模型支持：** 模型无关
- **学习曲线：** 入门级（角色/任务/团队映射到真实团队）
- **最适用：** 内容流水线、研究自动化、业务流程工作流、快速原型开发
- **避免场景：** 细粒度状态管理、TypeScript、容错检查点、复杂条件分支
- **优势：** 多 agent 原型开发最快，在 QA 任务上比 LangGraph 快 5.76 倍，内置内存（短期/长期/实体/上下文），Flows 架构，独立运行（无 LangChain 依赖）
- **弱势：** 检查点有限，错误处理粗糙，仅支持 Python
- **评估关注点：** 任务分解准确性、agent 间交接、目标完成率、循环检测

### LlamaIndex
- **类型：** RAG 和数据摄取
- **语言：** Python + TypeScript
- **模型支持：** 模型无关
- **学习曲线：** 中级
- **最适用：** 法律研究、内部知识助手、企业文档搜索、任何以检索质量为首要优先级的系统
- **避免场景：** 主要需求是 agent 编排、多 agent 协作或聊天机器人对话流程
- **优势：** 行业最佳文档解析（LlamaParse），检索准确率提升 35%，查询速度提升 20-30%，混合检索策略（向量 + 图谱 + 重排序器）
- **弱势：** 以数据框架为主——agent 编排是次要功能
- **评估关注点：** 上下文忠实度、幻觉、答案相关性、检索精确度/召回率

### LangChain
- **类型：** 通用 LLM 框架
- **语言：** Python + TypeScript
- **模型支持：** 模型无关（最广泛的生态系统）
- **学习曲线：** 中级-高级
- **最适用：** 需求持续变化、大量第三方集成、希望用一个框架覆盖所有需求的团队、RAG + agent + chain
- **避免场景：** 简单且定义明确的用例、RAG 优先（使用 LlamaIndex）、复杂有状态工作流（使用 LangGraph）、规模化性能至关重要
- **优势：** 最大社区和集成生态系统，相比从零开发快 25%，覆盖 RAG/agent/chain/内存
- **弱势：** 抽象开销，高负载下 p99 延迟下降，复杂性蔓延风险
- **评估关注点：** 端到端任务完成、chain 正确性、检索质量

### LangGraph
- **类型：** 有状态 agent 工作流（基于图）
- **语言：** Python + TypeScript（完全对等）
- **模型支持：** 模型无关（继承 LangChain 集成）
- **学习曲线：** 中级-高级（图思维模型）
- **最适用：** 生产级有状态工作流、受监管行业、审计追踪、人在回路流程、容错多步骤 agent
- **避免场景：** 简单聊天机器人、纯线性工作流、快速原型开发
- **优势：** 最佳检查点（每个节点），时间旅行调试，原生 Postgres/Redis 持久化，流式支持，2026 年 62% 的开发者选择用于有状态 agent 工作（排名第一）
- **弱势：** 前期脚手架较多，学习曲线较陡，简单场景过于复杂
- **评估关注点：** 状态转换正确性、目标完成率、工具使用准确性、安全护栏

### OpenAI Agents SDK
- **类型：** OpenAI 原生 agent 框架
- **语言：** Python + TypeScript
- **模型支持：** 针对 OpenAI 优化（通过 Chat Completions 兼容性支持 100+ 模型）
- **学习曲线：** 入门级（4 个原语：Agents、Handoffs、Guardrails、Tracing）
- **最适用：** 致力于 OpenAI 的团队、快速 agent 原型开发、语音 agent（gpt-realtime）、希望使用可视化构建器的团队（AgentKit）
- **避免场景：** 需要模型灵活性、复杂多 agent 协作、需要持久状态管理、担心供应商锁定
- **优势：** 最简单的思维模型，内置追踪和护栏，agent 委托的 Handoffs，语音的 Realtime Agents
- **弱势：** OpenAI 供应商锁定，无内置持久状态，生态系统较新
- **评估关注点：** 指令遵循、安全护栏、升级准确性、语气一致性

### Claude Agent SDK（Anthropic）
- **类型：** 代码感知自主 agent 框架
- **语言：** Python + TypeScript
- **模型支持：** 仅支持 Claude 模型
- **学习曲线：** 中级（18 个钩子事件、MCP、工具装饰器）
- **最适用：** 开发者工具、代码生成/审查 agent、自主编程助手、MCP 密集型架构、安全关键应用
- **避免场景：** 需要模型灵活性、需要稳定/成熟 API、用例与代码/工具使用无关
- **优势：** 最深入的 MCP 集成，内置文件系统/shell 访问，18 个生命周期钩子，自动上下文压缩，扩展思维，安全优先设计
- **弱势：** 仅支持 Claude 的供应商锁定，API 较新且持续演进，社区较小
- **评估关注点：** 工具使用正确性、安全性、代码质量、指令遵循

### AutoGen / AG2 / Microsoft Agent Framework
- **类型：** 多 agent 对话框架
- **语言：** Python（AG2），Python + .NET（Microsoft Agent Framework）
- **模型支持：** 模型无关
- **学习曲线：** 中级-高级
- **最适用：** 研究应用、对话式问题求解、代码生成 + 执行循环、Microsoft/.NET 技术栈
- **避免场景：** 需要生态系统稳定性、确定性工作流，或寻求"最安全的长期选择"（碎片化风险）
- **优势：** 最复杂的对话 agent 模式，代码生成 + 执行循环，异步事件驱动（v0.4+），跨语言互操作（Microsoft Agent Framework）
- **弱势：** 生态系统碎片化（AutoGen 维护模式、AG2 分叉、Microsoft Agent Framework 预览版）—— 真实的长期风险
- **评估关注点：** 对话目标完成、共识质量、代码执行正确性

### Google ADK（Agent Development Kit）
- **类型：** 多 agent 编排框架
- **语言：** Python + Java
- **模型支持：** 针对 Gemini 优化；通过 LiteLLM 支持其他模型
- **学习曲线：** 中级（agent/工具/会话模型，熟悉 LangGraph 的话会感到亲切）
- **最适用：** Google Cloud / Vertex AI 技术栈、需要内置会话管理和内存的多 agent 工作流、已致力于 Gemini 的团队、需要 Google Search / BigQuery 工具集成的 agent 管道
- **避免场景：** 需要 Gemini 以外的模型灵活性、不能依赖 Google Cloud、仅限 TypeScript 的技术栈
- **优势：** 谷歌原生支持，内置会话/内存/制品管理，与 Vertex AI 和 Google Search 紧密集成，自有评估框架（兼容 RAGAS），多 agent 原生设计（顺序、并行、循环模式），面向企业团队的 Java SDK
- **弱势：** 实际上对 Gemini 有供应商锁定，社区比 LangChain/LlamaIndex 更年轻，第三方集成深度不足
- **评估关注点：** 多 agent 任务分解、工具使用正确性、会话状态一致性、目标完成率

### Haystack
- **类型：** NLP 流水线框架
- **语言：** Python
- **模型支持：** 模型无关
- **学习曲线：** 中级
- **最适用：** 显式、可审计的 NLP 流水线、细粒度控制的文档处理、企业搜索、需要透明度的受监管行业
- **避免场景：** 快速原型开发、多 agent 工作流，或需要大型社区
- **优势：** 显式流水线控制，对结构化数据流水线强大，文档良好
- **弱势：** 社区较小，比其他方案更不面向 agent
- **评估关注点：** 提取准确性、流水线输出有效性、检索质量

---

## 决策维度

### 按系统类型

| 系统类型 | 主要框架 | 关键评估关注点 |
|-------------|---------------------|-------------------|
| RAG / 知识问答 | LlamaIndex、LangChain | 上下文忠实度、幻觉、检索精确度/召回率 |
| 多 agent 编排 | CrewAI、LangGraph、Google ADK | 任务分解、交接质量、目标完成 |
| 对话助手 | OpenAI Agents SDK、Claude Agent SDK | 语气、安全、指令遵循、升级 |
| 结构化数据提取 | LangChain、LlamaIndex | schema 合规性、提取准确性 |
| 自主任务 agent | LangGraph、OpenAI Agents SDK | 安全护栏、工具正确性、成本遵守 |
| 内容生成 | Claude Agent SDK、OpenAI Agents SDK | 品牌声音、事实准确性、语气 |
| 代码自动化 | Claude Agent SDK | 代码正确性、安全性、测试通过率 |

### 按团队规模和阶段

| 背景 | 建议 |
|---------|----------------|
| 单人开发，原型阶段 | OpenAI Agents SDK 或 CrewAI（最快跑通） |
| 单人开发，RAG | LlamaIndex（开箱即用） |
| 团队，生产，有状态 | LangGraph（最佳容错性） |
| 团队，需求持续变化 | LangChain（最广泛的退出选项） |
| 团队，多 agent | CrewAI（最简单的角色抽象） |
| 企业，.NET | AutoGen AG2 / Microsoft Agent Framework |

### 按模型偏好

| 偏好 | 框架 |
|-----------|-----------|
| 仅 OpenAI | OpenAI Agents SDK |
| 仅 Anthropic/Claude | Claude Agent SDK |
| 致力于 Google/Gemini | Google ADK |
| 模型无关（完全灵活） | LangChain、LlamaIndex、CrewAI、LangGraph、Haystack |

---

## 反模式

1. **用 LangChain 做简单聊天机器人** —— 直接调用 SDK 代码更少、更快、更易调试
2. **用 CrewAI 做复杂有状态工作流** —— 检查点缺陷会在生产中暴露
3. **用 OpenAI Agents SDK 搭配非 OpenAI 模型** —— 失去了选择它的集成优势
4. **将 LlamaIndex 用作多 agent 框架** —— 它可以做 agent，但这不是它的强项
5. **不评估替代方案就默认选择 LangChain** —— "大家都用"≠ 适合你的用例
6. **在新项目中使用 AutoGen（而非 AG2）** —— AutoGen 处于维护模式；使用 AG2 或等待 Microsoft Agent Framework GA
7. **为简单线性流程选择 LangGraph** —— 图的开销不值得；改用 LangChain chain
8. **忽视供应商锁定** —— 供应商原生 SDK（OpenAI、Claude）用集成深度换取灵活性；请有意识地做出决定

---

## 组合策略（多框架技术栈）

| 生产模式 | 技术栈 |
|-------------------|-------|
| 有可观测性的 RAG | LlamaIndex + LangSmith 或 Langfuse |
| 带 RAG 的有状态 agent | LangGraph + LlamaIndex |
| 带追踪的多 agent | CrewAI + Langfuse |
| 带评估的 OpenAI agent | OpenAI Agents SDK + Promptfoo 或 Braintrust |
| 带 MCP 的 Claude agent | Claude Agent SDK + LangSmith 或 Arize Phoenix |
