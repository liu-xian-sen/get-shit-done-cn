---
component: plan-checker
version: 1
last_calibrated: 2026-03-24
---

# Plan-Checker 少样本示例

## 正面示例

### 示例 1：因任务动作模糊、缺少文件名和函数名而标记 BLOCKER

**输入：** 计划任务的动作为："实现 API 路由的身份验证功能。"

**输出：**

> ```yaml
> issues:
>   - dimension: task_completeness
>     severity: BLOCKER
>     finding: "任务 T1 的动作描述为'实现身份验证功能'，未指明目标文件、需创建的函数或需应用的中间件。执行器无法确定需要构建什么。"
>     affected_field: "<action>"
>     suggested_fix: "请具体说明：在 src/middleware/auth.js 中创建 authMiddleware，应用到 src/routes/api.js 第 12-45 行的路由，并通过集成测试验证"
> ```

**为何这是好示例：** 检查器引用了具体维度（task_completeness），引用了有问题的文本，解释了为何这是阻塞问题（执行器无法确定需要构建什么），并给出了包含文件路径和函数名的具体修复方案。该发现是可操作的——规划器确切知道需要补充什么。

### 示例 2：同一波次中两个计划存在文件冲突，标记 BLOCKER

**输入：** 第 1 波中的两个计划——Plan 01 修改 `get-shit-done/workflows/execute-phase.md`，Plan 02 同样修改 `get-shit-done/workflows/execute-phase.md`。未声明 `depends_on`。

**输出：**

> ```yaml
> issues:
>   - dimension: dependency_correctness
>     severity: BLOCKER
>     finding: "计划 01 和 02 在第 1 波中均修改了 get-shit-done/workflows/execute-phase.md，且没有 depends_on 关系。并发执行将导致合并冲突或更改丢失。"
>     affected_field: "files_modified"
>     suggested_fix: "将 Plan 02 移至第 2 波并添加 depends_on: ['01']，或将文件更改合并到单个计划中"
> ```

**为何这是好示例：** 检查器识别了真实的结构性问题——两个计划在同一波次中修改同一文件却没有依赖关系。它引用了 dependency_correctness，指明了两个计划、冲突文件，并提供了两种备选修复方案。

## 负面示例

### 示例 1：验证命令缺失时所有维度均通过

**输入：** 包含 3 个任务的计划。任务 T2 的 `<verify></verify>` 为空。任务 T3 的 `<verify>echo "done"</verify>` 是无意义的（无法区分成功与失败）。

**输出：**

> ## CHECK PASSED
> Plans: 1 | Tasks: 3 | Dimensions: 10 | Issues: 0

**为何这是坏示例：** 检查器遗漏了两个违规项。verification_derivation 要求验证命令可运行并实际测试输出——空的验证块是 BLOCKER。验证命令必须能区分成功与失败——`echo "done"` 无论实现状态如何始终返回 0。两者都应被标记。

### 示例 2：对正确规模的计划误报 INFO

**输入：** 包含 3 个任务、6 个唯一文件、1 个依赖的计划。所有指标均在限制范围内。

**输出：**

> ```yaml
> issues:
>   - dimension: scope_sanity
>     severity: INFO
>     finding: "计划包含 3 个任务——考虑拆分为更小的计划以加快迭代速度"
>     affected_field: "task count"
>     suggested_fix: "将任务拆分为独立计划"
> ```

**为何这是坏示例：** 检查器标记了一个不存在的问题。scope_sanity 允许每个计划包含 2-3 个任务——3 个任务在限制范围内。检查器应用了个人偏好（"越小越好"）而非文档规定的阈值。这浪费了规划器的时间在误报上，并削弱了对检查器判断的信任。正确的检查对于这个计划不应产生任何问题。
