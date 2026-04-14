<purpose>
discuss-phase 的高级用户模式。预先将所有问题生成到 JSON 状态文件和 HTML 伴侣 UI 中，然后等待用户按自己的节奏回答。当用户发出准备就绪信号时，一次性处理所有答案并生成 CONTEXT.md。

**使用场景：** 具有许多灰色地带的大型阶段，或者用户希望离线/异步回答问题而非在聊天会话中交互式回答。
</purpose>

<trigger>
当 `/gsd-discuss-phase` 的 ARGUMENTS 中存在 `--power` 标志时，此工作流执行。

调用者（discuss-phase.md）已经：
- 验证了阶段存在
- 提供了 init 上下文：`phase_dir`、`padded_phase`、`phase_number`、`phase_name`、`phase_slug`

立即从**步骤 1**开始。
</trigger>

<step name="analyze">
运行与标准 discuss-phase 模式相同的灰色地带识别。

1. 加载先前上下文（PROJECT.md、REQUIREMENTS.md、STATE.md、先前的 CONTEXT.md 文件）
2. 侦察代码库中与本阶段相关的可复用资产和模式
3. 从 ROADMAP.md 读取阶段目标
4. 识别所有灰色地带——用户应参与的具体实现决策
5. 对于每个灰色地带，生成 2-4 个具体选项并附权衡描述

按主题将问题分组到各部分（例如"视觉风格"、"数据模型"、"交互"、"错误处理"）。每部分应有 2-6 个问题。

此阶段不要向用户提问。在内部捕获所有内容，然后继续生成。
</step>

<step name="generate_json">
将所有问题写入：

```
{phase_dir}/{padded_phase}-QUESTIONS.json
```

**JSON 结构：**

```json
{
  "phase": "{padded_phase}-{phase_slug}",
  "generated_at": "ISO-8601 时间戳",
  "stats": {
    "total": 0,
    "answered": 0,
    "chat_more": 0,
    "remaining": 0
  },
  "sections": [
    {
      "id": "section-slug",
      "title": "部分标题",
      "questions": [
        {
          "id": "Q-01",
          "title": "简短问题标题",
          "context": "与该问题相关的代码库信息、先前决策或约束",
          "options": [
            {
              "id": "a",
              "label": "选项标签",
              "description": "此选项的权衡或详细说明"
            },
            {
              "id": "b",
              "label": "另一个选项",
              "description": "权衡或详细说明"
            },
            {
              "id": "c",
              "label": "自定义",
              "description": ""
            }
          ],
          "answer": null,
          "chat_more": "",
          "status": "unanswered"
        }
      ]
    }
  ]
}
```

**字段规则：**
- `stats.total`：所有部分问题的总数
- `stats.answered`：`answer` 不为 null 且不为空字符串的数量
- `stats.chat_more`：`chat_more` 有内容的数量
- `stats.remaining`：`total - answered`
- `question.id`：跨所有部分顺序编号——Q-01、Q-02、Q-03……
- `question.context`：具体的代码库或先前决策注释（非通用内容）
- `question.answer`：用户设置前为 null；回答后为所选选项 id 或自由文本
- `question.status`："unanswered" | "answered" | "chat-more"（有 chat_more 内容但尚未回答）
</step>

<step name="generate_html">
将自包含的 HTML 伴侣文件写入：

```
{phase_dir}/{padded_phase}-QUESTIONS.html
```

该文件必须是包含内联 CSS 和 JavaScript 的单个自包含 HTML 文件。无外部依赖。

**布局：**

```
┌─────────────────────────────────────────────────────┐
│  阶段 {N}：{phase_name} — 讨论问题                   │
│  ┌──────────────────────────────────────────────┐   │
│  │  共 12 题  |  已答 3 题  |  剩余 9 题         │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  ▼ 视觉风格（3 题）                                  │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│   │ Q-01     │ │ Q-02     │ │ Q-03     │            │
│   │ 布局     │ │ 密度     │ │ 颜色     │            │
│   │ ...      │ │ ...      │ │ ...      │            │
│   └──────────┘ └──────────┘ └──────────┘            │
│  ▼ 数据模型（2 题）                                  │
│   ...                                                │
└─────────────────────────────────────────────────────┘
```

**统计栏：**
- 问题总数、已答数、剩余数
- 简单的 CSS 进度条（绿色填充 = 已答 / 总数）

**部分标题：**
- 可通过点击折叠——显示/隐藏该部分的问题
- 显示该部分的已答数（例如"2/4 已答"）

**问题卡片（3 列网格）：**
每张卡片包含：
- 问题 ID 标识（例如"Q-01"）和标题
- 上下文注释（灰色斜体文字）
- 选项列表：单选按钮，附粗体标签 + 描述文字
- 更多聊天文本区域（有内容时显示橙色边框）
- 已答时卡片高亮显示为绿色

**JavaScript 行为：**
- 选择单选按钮时：在页面状态中将问题标记为已答；更新统计栏
- 文本区域输入时：在页面状态中更新 chat_more 内容；有内容时显示橙色边框
- 顶部和底部的"保存答案"按钮：将页面状态序列化回 JSON 文件路径

**保存机制：**
保存按钮使用 File System Access API（如果可用）将更新后的 JSON 写回，否则生成可下载的 JSON 文件供用户保存覆盖原始文件。在 UI 中包含清晰说明：

```
回答后，点击"保存答案"——或下载 JSON 并替换原始文件。
然后返回 Claude 并说"refresh"以处理您的答案。
```

**已答问题样式：**
- 卡片边框：`2px solid #22c55e`（绿色）
- 卡片背景：`#f0fdf4`（浅绿色调）

**未答问题样式：**
- 卡片边框：`1px solid #e2e8f0`（灰色）
- 卡片背景：`white`

**更多聊天文本区域：**
- 占位符："为此问题添加上下文、细节或说明..."
- 普通边框：`1px solid #e2e8f0`
- 激活（有内容）边框：`2px solid #f97316`（橙色）
</step>

<step name="notify_user">
写入两个文件后，向用户打印此消息：

```
阶段 {N}：{phase_name} 的问题已准备就绪

  HTML（在浏览器/IDE 中打开）：   {phase_dir}/{padded_phase}-QUESTIONS.html
  JSON（状态文件）：              {phase_dir}/{padded_phase}-QUESTIONS.json

  共 {total} 题，分布在 {section_count} 个主题中。

打开 HTML 文件，按自己的节奏回答问题，然后保存。

准备好后，告诉我：
  "refresh"   — 处理您的答案并更新文件
  "finalize"  — 从所有已答问题生成 CONTEXT.md
  "explain Q-05"   — 详细说明某个具体问题
  "exit power mode" — 返回标准逐一讨论（答案保留）
```
</step>

<step name="wait_loop">
进入等待模式。Claude 监听用户命令并处理每个命令：

---

**"refresh"**（或"process answers"、"update"、"re-read"）：

1. 读取 `{phase_dir}/{padded_phase}-QUESTIONS.json`
2. 重新计算统计：统计已答、chat_more、剩余数
3. 将更新后的统计写回 JSON
4. 使用更新后的状态重新生成 HTML 文件（已答卡片高亮为绿色，进度条更新）
5. 向用户报告：

```
已刷新。更新后的状态：
  已答：  {answered} / {total}
  剩余：  {remaining}
  待聊：  {chat_more}

  {phase_dir}/{padded_phase}-QUESTIONS.html 已更新。

继续回答问题，然后再次说"refresh"，或在完成后说"finalize"。
```

---

**"finalize"**（或"done"、"generate context"、"write context"）：

继续到 **finalize** 步骤。

---

**"explain Q-{N}"**（或"more info on Q-{N}"、"elaborate Q-{N}"）：

1. 通过 ID 在 JSON 中找到该问题
2. 提供详细解释：此决策为何重要、它如何影响下游计划、代码库中有哪些额外相关上下文
3. 返回等待模式

---

**"exit power mode"**（或"switch to interactive"）：

1. 从 JSON 读取所有当前已答的问题
2. 将答案加载到内部累积器，如同交互式回答一样
3. 从 discuss-phase.md 的 `discuss_areas` 步骤继续处理任何未答的问题
4. 正常生成 CONTEXT.md

---

**任何其他消息：**
有帮助地回应，然后提醒用户可用命令：
```
（高级用户模式已激活——请说"refresh"、"finalize"、"explain Q-N"或"exit power mode"）
```
</step>

<step name="finalize">
处理 JSON 文件中所有已答问题并生成 CONTEXT.md。

1. 读取 `{phase_dir}/{padded_phase}-QUESTIONS.json`
2. 过滤 `answer` 不为 null/空的问题
3. 按部分分组决策
4. 对于每个已答问题，格式化为决策条目：
   - 决策：所选选项标签（或自由文本答案）
   - 理由：选项描述，加上 `chat_more` 内容（如果有）
   - 状态："Decided"（如果完整回答），"Needs clarification"（如果只有 chat_more 而未选选项）

5. 使用标准上下文模板格式写入 CONTEXT.md：
   - `<decisions>` 部分：所有已答问题按部分分组
   - `<deferred_ideas>` 部分：未答问题（留待将来讨论）
   - `<specifics>` 部分：任何增加细节的 chat_more 内容
   - `<code_context>` 部分：分析期间发现的可复用资产
   - `<canonical_refs>` 部分（必须——相关规范/文档的路径）

6. 如果回答问题数少于 50%，警告用户：
```
警告：仅 {answered}/{total} 题已答（{pct}%）。
已从可用决策生成 CONTEXT.md。未答问题已列为延期。
在规划前考虑再次运行 /gsd-discuss-phase {N} 以进一步完善。
```

7. 打印完成消息：
```
CONTEXT.md 已写入：{phase_dir}/{padded_phase}-CONTEXT.md

  已捕获决策：  {answered}
  已延期：      {remaining}

下一步：/gsd-plan-phase {N}
```
</step>

<success_criteria>
- 问题已生成到涵盖所有已识别灰色地带的结构良好的 JSON 中
- HTML 伴侣文件自包含，无需服务器即可使用
- 每次刷新后统计栏准确反映已答/剩余数
- 已答问题在 HTML 中高亮为绿色
- CONTEXT.md 以与标准 discuss-phase 输出相同的格式生成
- 未答问题作为延期项保留（不被静默丢弃）
- `canonical_refs` 部分始终存在于 CONTEXT.md 中（必须）
- 用户了解如何刷新、完成、说明或退出高级用户模式
</success_criteria>
