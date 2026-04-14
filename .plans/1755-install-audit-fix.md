# 计划：修复安装过程问题（#1755 + 全面审核）

## 概述
全面清理 install.js，解决全面审核期间发现的所有问题。
除非另有说明，否则所有更改均在 `bin/install.js` 中。

## 变化

### 修复 1：在安装过程中为 .sh 挂钩添加 chmod +x（关键）
**第 5391-5392 行** — 在 `fs.copyFileSync` 之后，为 `.sh` 文件添加 `fs.chmodSync(destFile, 0o755)`。

### 修复 2：修复 Codex 挂钩路径和文件名（关键）
**第 5485 行** — 将 `gsd-update-check.js` 更改为 `gsd-check-update.js` 并将路径从 `get-shit-done/hooks/` 修复为 `hooks/`。
**第 5492 行** — 更新重复数据删除检查以使用 `gsd-check-update`。

### 修复 3：修复过时的缓存失效路径（关键）
**第 5406 行** — 从 `path.join(path.dirname(targetDir), 'cache', ...)` 更改为 `path.join(os.homedir(), '.cache', 'gsd', 'gsd-update-check.json')`。

### 修复 4：跟踪清单中的 .sh 挂钩（中）
**第 4972 行** — 将过滤器从 `file.endsWith('.js')` 更改为 `(file.endsWith('.js') || file.endsWith('.sh'))`。

### 修复 5：将 gsd-workflow-guard.js 添加到卸载挂钩列表（中）
**第 4404 行** — 将 `'gsd-workflow-guard.js'` 添加到 `gsdHooks` 数组。

### 修复 6：添加社区挂钩以卸载 settings.json 清理（中）
**第 4453-4520 行** — 在相应的事件清理块（SessionStart、PreToolUse、PostToolUse）中添加 `gsd-session-state`、`gsd-validate-commit`、`gsd-phase-boundary` 的过滤器。

### 修复 7：从卸载列表中删除幻影 gsd-check-update.sh（低）
**第 4404 行** — 从 `gsdHooks` 数组中删除 `'gsd-check-update.sh'`。

### 修复 8：删除卸载中无效的 isCursor/isWindsurf 分支（低）
删除无法访问的重复 `else if (isCursor)` 和 `else if (isWindsurf)` 分支。

### 修复 9：改进 hooks 的 verifyInstalled() （低）
一般检查后，如果预期的 `.sh` 文件丢失，则发出警告（非致命警告）。

## 新的测试文件
`tests/install-hooks-copy.test.cjs` — 回归测试涵盖：
- .sh 文件复制到目标目录
- .sh文件复制后可执行
- 在清单中跟踪的 .sh 文件
- settings.json 挂钩路径与已安装的文件匹配
- 卸载从settings.json中删除社区挂钩
- 卸载删除 gsd-workflow-guard.js
- Codex 挂钩使用正确的文件名
- 缓存路径正确解析
