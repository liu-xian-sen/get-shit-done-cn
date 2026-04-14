## 专题公关

> **使用了错误的模板？**
> — 错误修复：使用 [fix.md](?template=fix.md)
> — 增强现有行为：使用 [enhancement.md](?template=enhancement.md)

---

## 相关问题

> **必填。** 如果未找到有效的问题链接，此 PR 将自动关闭。
> 链接的问题**必须**具有 `approved-feature` 标签。如果不符合，该 PR 将未经审查而关闭——无一例外。

关闭#

> ⛔ **问题上没有 `approved-feature` 标签 = 立即关闭。**
> 如果维护者尚未批准该功能规范，请勿打开此 PR。
> 如果您在问题获得批准之前编写了代码，请不要打开此 PR。

---

## 功能总结

<!-- One paragraph. What does this feature add? Assume the reviewer has read the issue spec. -->

## 发生了什么变化

### 新文件

<!-- List every new file added and its purpose. -->

|文件 |目的|
|------|---------|
| | |

### 修改文件

<!-- List every existing file modified and what changed in it. -->

|文件 |发生了什么变化|
|------|-------------|
| | |

## 实施说明

<!-- 描述问题中未指定的实施过程中做出的任何决定。
     如果实施的任何部分与批准的规范不同，请解释原因。 -->

## 规范合规性

<!-- For each acceptance criterion in the linked issue, confirm it is met. Copy them here and check them off. -->

- [ ] <!-- 问题的接受标准 1 -->
- [ ] <!-- 问题的接受标准 2 -->
- [ ] <!-- 添加问题中的所有条件 -->

## 测试

### 测试覆盖率

<!-- Describe what is tested and where. New features require new tests — no exceptions. -->

### 已测试平台

- [ ] macOS
- [ ] Windows（包括反斜杠路径处理）
- [ ] Linux

### 运行时测试

- [ ] 克劳德代码
- [ ] 双子座 CLI
- [ ] 开放代码
- [ ] 法典
- [ ] 副驾驶
- [ ] 其他：___
- [ ] N/A — 指定支持哪些运行时以及为何排除其他运行时

---

## 范围确认

- [ ] 实施与链接问题中批准的范围完全匹配
- [ ] 未添加超出批准范围的其他功能、命令或行为
- [ ] 如果范围在实施过程中发生变化，我更新了问题规范并获得了重新批准

---

## 清单

- [ ] 上面与 `Closes #NNN` 链接的问题 — **如果缺少 PR 将自动关闭**
- [ ] 链接问题具有 `approved-feature` 标签 — **如果缺失，PR 将被关闭**
- [ ] 满足该问题的所有验收标准（上面列出）
- [ ] 实施范围与批准的规范完全匹配
- [ ] 所有现有测试均通过 (`npm test`)
- [ ] 新测试涵盖快乐路径、错误情况和边缘情况
- [ ] CHANGELOG.md 更新了面向用户的功能描述
- [ ] 更新文档 — 命令、工作流程、参考、自述文件（如果适用）
- [ ] 未添加不必要的外部依赖项
- [ ] 适用于 Windows（处理反斜杠路径）

## 重大变更

<!-- 描述影响现有用户的任何行为、输出格式、文件架构或 API 更改。
     对于每个重大更改，描述迁移路径。
     仅当您确定时才写“无”。 -->

没有任何

## 截图/录音

<!-- 如果此功能有任何视觉输出或改变用户体验，请包括之前/之后的屏幕截图
     或一段简短的录音。如果不适用，请删除此部分。 -->
