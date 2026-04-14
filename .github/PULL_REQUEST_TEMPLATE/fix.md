## 修复公关

> **使用了错误的模板？**
> — 增强：使用 [enhancement.md](?template=enhancement.md)
> — 功能：使用 [feature.md](?template=feature.md)

---

## 相关问题

> **必填。** 如果未找到有效的问题链接，此 PR 将自动关闭。

修复#

> 链接的问题必须具有 `confirmed-bug` 标签。如果没有，请让维护人员确认该错误，然后再继续。

---

## 损坏了什么

<!-- One or two sentences. What was the incorrect behavior? -->

## 此修复的作用

<!-- One or two sentences. How does this fix the broken behavior? -->

##根本原因

<!-- Brief explanation of why the bug existed. Skip for trivial typo/doc fixes. -->

## 测试

### 我如何验证修复

<!-- Describe manual steps or point to the automated test that proves this is fixed. -->

### 添加回归测试？

- [ ] 是的 - 添加了一个可以捕获此错误的测试
- [ ] 否 — 解释原因：<!-- 例如，特定于环境的、非确定性的 -->

### 已测试平台

- [ ] macOS
- [ ] Windows（包括反斜杠路径处理）
- [ ] Linux
- [ ] N/A（不特定于平台）

### 运行时测试

- [ ] 克劳德代码
- [ ] 双子座 CLI
- [ ] 开放代码
- [ ] 其他：___
- [ ] N/A（不特定于运行时）

---

## 清单

- [ ] 上面与 `Fixes #NNN` 链接的问题 — **如果缺少 PR 将自动关闭**
- [ ] 链接问题具有 `confirmed-bug` 标签
- [ ] 修复范围仅限于报告的错误 - 不包括不相关的更改
- [ ] 添加了回归测试（或解释了为什么不这样做）
- [ ] 所有现有测试均通过 (`npm test`)
- [ ] CHANGELOG.md 已更新（如果这是面向用户的修复）
- [ ] 没有添加不必要的依赖项

## 重大变更

<!-- 此修复是否会更改用户可能依赖的任何现有行为、输出格式或 API？
     如果是，请描述。如果不适用，请写“无”。 -->

没有任何
