## 增强公关

> **使用了错误的模板？**
> — 错误修复：使用 [fix.md](?template=fix.md)
> — 新功能：使用 [feature.md](?template=feature.md)

---

## 相关问题

> **必填。** 如果未找到有效的问题链接，此 PR 将自动关闭。
> 链接的问题**必须**具有 `approved-enhancement` 标签。如果没有，此 PR 将被关闭而不经过审核。

关闭#

> ⛔ **问题上没有 `approved-enhancement` 标签 = 立即关闭。**
> 如果维护者尚未批准增强提案，请勿打开此 PR。

---

## 此增强功能改进了什么

<!-- Name the specific command, workflow, or behavior being improved. -->

## 之前/之后

**前：**
<!-- Describe or show the current behavior. Include example output if applicable. -->

**后：**
<!-- Describe or show the behavior after this enhancement. Include example output if applicable. -->

## 它是如何实现的

<!-- Brief description of the approach. Point to the key files changed. -->

## 测试

### 我如何验证增强功能的效果

<!-- Manual steps or automated tests. -->

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

## 范围确认

<!-- Confirm the implementation matches the approved proposal. -->

- [ ] 实施符合链接问题中批准的范围 - 没有添加或删除
- [ ] 如果范围在实施过程中发生变化，我会更新问题并在继续之前获得重新批准

---

## 清单

- [ ] 上面与 `Closes #NNN` 链接的问题 — **如果缺少 PR 将自动关闭**
- [ ] 链接问题具有 `approved-enhancement` 标签 — **如果缺失，PR 将被关闭**
- [ ] 更改仅限于已批准的增强功能 - 不包含任何额外内容
- [ ] 所有现有测试均通过 (`npm test`)
- [ ] 新的或更新的测试涵盖了增强的行为
- [ ] CHANGELOG.md 更新
- [ ] 如果行为或输出发生变化，则更新文档
- [ ] 没有添加不必要的依赖项

## 重大变更

<!-- 此增强功能是否会更改任何现有行为、输出格式或 API？
     如果是，请准确描述哪些更改并确认向后兼容性。
     如果不适用，请写“无”。 -->

没有任何
