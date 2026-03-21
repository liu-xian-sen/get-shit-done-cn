<purpose>
通过 npm 检查 GSD 更新，显示已安装版本与最新版本之间的变更日志，获取用户确认，并执行包含清除缓存的全新安装。
</purpose>

<required_reading>
在开始之前，阅读调用提示的 execution_context 引用的所有文件。
</required_reading>

<process>

<step name="get_installed_version">
通过检查两个位置并验证安装完整性，检测 GSD 是安装在本地还是全局。

首先，从调用提示的 `execution_context` 路径推导 `PREFERRED_RUNTIME`：
- 路径包含 `/.codex/` -> `codex`
- 路径包含 `/.gemini/` -> `gemini`
- 路径包含 `/.config/opencode/` 或 `/.opencode/` -> `opencode`
- 路径包含 `/.codebuddy/` -> `codebuddy`
- 否则 -> `claude`

将 `PREFERRED_RUNTIME` 作为第一个检查的运行时，以便 `/gsd:update` 针对调用它的运行时。

```bash
# 运行时候选列表：存储为数组的 "<runtime>:<config-dir>"。
# 使用数组而不是空格分隔的字符串可确保在 bash 和 zsh 中都能正确迭代
# （zsh 默认不会对未引用的变量进行单词分割）。修复 #1173。
RUNTIME_DIRS=( "claude:.claude" "opencode:.config/opencode" "opencode:.opencode" "gemini:.gemini" "codex:.codex" "codebuddy:.codebuddy" )

# 在运行此块之前，应从 execution_context 设置 PREFERRED_RUNTIME。
# 如果未设置，则从运行时环境变量推断；备选为 claude。
if [ -z "$PREFERRED_RUNTIME" ]; then
  if [ -n "$CODEX_HOME" ]; then
    PREFERRED_RUNTIME="codex"
  elif [ -n "$GEMINI_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="gemini"
  elif [ -n "$OPENCODE_CONFIG_DIR" ] || [ -n "$OPENCODE_CONFIG" ]; then
    PREFERRED_RUNTIME="opencode"
  elif [ -n "$CODEBUDDY_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="codebuddy"
  elif [ -n "$CLAUDE_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="claude"
  else
    PREFERRED_RUNTIME="claude"
  fi
fi

# 重新排序条目，以便首先检查首选运行时。
ORDERED_RUNTIME_DIRS=()
for entry in "${RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" = "$PREFERRED_RUNTIME" ]; then
    ORDERED_RUNTIME_DIRS+=( "$entry" )
  fi
done
for entry in "${RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" != "$PREFERRED_RUNTIME" ]; then
    ORDERED_RUNTIME_DIRS+=( "$entry" )
  fi
done

# 先检查本地（仅当有效且与全局不同时才具有优先级）
LOCAL_VERSION_FILE="" LOCAL_MARKER_FILE="" LOCAL_DIR="" LOCAL_RUNTIME=""
for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  dir="${entry#*:}"
  if [ -f "./$dir/get-shit-done/VERSION" ] || [ -f "./$dir/get-shit-done/workflows/update.md" ]; then
    LOCAL_RUNTIME="$runtime"
    LOCAL_VERSION_FILE="./$dir/get-shit-done/VERSION"
    LOCAL_MARKER_FILE="./$dir/get-shit-done/workflows/update.md"
    LOCAL_DIR="$(cd "./$dir" 2>/dev/null && pwd)"
    break
  fi
done

GLOBAL_VERSION_FILE="" GLOBAL_MARKER_FILE="" GLOBAL_DIR="" GLOBAL_RUNTIME=""
for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  dir="${entry#*:}"
  if [ -f "$HOME/$dir/get-shit-done/VERSION" ] || [ -f "$HOME/$dir/get-shit-done/workflows/update.md" ]; then
    GLOBAL_RUNTIME="$runtime"
    GLOBAL_VERSION_FILE="$HOME/$dir/get-shit-done/VERSION"
    GLOBAL_MARKER_FILE="$HOME/$dir/get-shit-done/workflows/update.md"
    GLOBAL_DIR="$(cd "$HOME/$dir" 2>/dev/null && pwd)"
    break
  fi
done

# 仅当解析后的路径不同时才视为 LOCAL（防止在 CWD=$HOME 时误检）
IS_LOCAL=false
if [ -n "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$LOCAL_VERSION_FILE"; then
  if [ -z "$GLOBAL_DIR" ] || [ "$LOCAL_DIR" != "$GLOBAL_DIR" ]; then
    IS_LOCAL=true
  fi
fi

if [ "$IS_LOCAL" = true ]; then
  INSTALLED_VERSION="$(cat "$LOCAL_VERSION_FILE")"
  INSTALL_SCOPE="LOCAL"
  TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$GLOBAL_VERSION_FILE"; then
  INSTALLED_VERSION="$(cat "$GLOBAL_VERSION_FILE")"
  INSTALL_SCOPE="GLOBAL"
  TARGET_RUNTIME="$GLOBAL_RUNTIME"
elif [ -n "$LOCAL_RUNTIME" ] && [ -f "$LOCAL_MARKER_FILE" ]; then
  # 检测到运行时但 VERSION 缺失/损坏：视为未知版本，保留运行时目标
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="LOCAL"
  TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_RUNTIME" ] && [ -f "$GLOBAL_MARKER_FILE" ]; then
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="GLOBAL"
  TARGET_RUNTIME="$GLOBAL_RUNTIME"
else
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="UNKNOWN"
  TARGET_RUNTIME="claude"
fi

echo "$INSTALLED_VERSION"
echo "$INSTALL_SCOPE"
echo "$TARGET_RUNTIME"
```

解析输出：
- 第 1 行 = 已安装版本（`0.0.0` 表示未知版本）
- 第 2 行 = 安装范围（`LOCAL`、`GLOBAL` 或 `UNKNOWN`）
- 第 3 行 = 目标运行时（`claude`、`opencode`、`gemini`、`codex` 或 `codebuddy`）
- 如果范围是 `UNKNOWN`，则使用 `--claude --global` 备选方案继续安装步骤。

如果检测到多个运行时安装，且无法从 execution_context 确定调用的运行时，请在运行安装前询问用户要更新哪个运行时。

**如果 VERSION 文件缺失：**
```
## GSD 更新

**已安装版本：** 未知

您的安装不包含版本跟踪。

正在运行全新安装...
```

进入安装步骤（将其视为版本 0.0.0 进行比较）。
</step>

<step name="check_latest_version">
在 npm 中检查最新版本：

```bash
npm view get-shit-done-dh version 2>/dev/null
```

**如果 npm 检查失败：**
```
无法检查更新（离线或 npm 不可用）。

要手动更新，请运行：`npx get-shit-done-dh --global`
```

退出。
</step>

<step name="compare_versions">
比较已安装版本与最新版本：

**如果 已安装 == 最新：**
```
## GSD 更新

**已安装版本：** X.Y.Z
**最新版本：** X.Y.Z

您已是最新版本。
```

退出。

**如果 已安装 > 最新：**
```
## GSD 更新

**已安装版本：** X.Y.Z
**最新版本：** A.B.C

您领先于最新发布版本（开发版？）。
```

退出。
</step>

<step name="show_changes_and_confirm">
**如果有可用更新**，在更新前获取并展示新内容：

1. 从 GitHub raw URL 获取变更日志
2. 提取已安装版本与最新版本之间的条目
3. 显示预览并询问确认：

```
## 有可用的 GSD 更新

**已安装版本：** 1.5.10
**最新版本：** 1.5.15

### 新内容
────────────────────────────────────────────────────────────

## [1.5.15] - 2026-01-20

### 新增
- 功能 X

## [1.5.14] - 2026-01-18

### 修复
- Bug 修复 Y

────────────────────────────────────────────────────────────

⚠️  **注意：** 安装程序将对 GSD 文件夹执行全新安装：
- `commands/gsd/` 将被擦除并替换
- `get-shit-done/` 将被擦除并替换
- `agents/gsd-*` 文件将被替换

（路径相对于检测到的运行时安装位置：
全局：`~/.claude/`、`~/.config/opencode/`、`~/.opencode/`、`~/.gemini/`、`~/.codex/` 或 `~/.codebuddy/`
本地：`./.claude/`、`./.config/opencode/`、`./.opencode/`、`./.gemini/`、`./.codex/` 或 `./.codebuddy/`）

您在其他位置的自定义文件将被保留：
- 不在 `commands/gsd/` 中的自定义命令 ✓
- 不以 `gsd-` 为前缀的自定义代理 ✓
- 自定义钩子 ✓
- 您的 CLAUDE.md 文件 ✓

如果您直接修改过任何 GSD 文件，它们将自动备份到 `gsd-local-patches/`，并可以在更新后通过 `/gsd:reapply-patches` 重新应用。
```

使用 AskUserQuestion：
- 问题：“继续更新吗？”
- 选项：
  - “是，现在更新”
  - “不，取消”

**如果用户取消：** 退出。
</step>

<step name="run_update">
使用步骤 1 中检测到的安装类型运行更新：

从步骤 1 构建运行时标志：
```bash
RUNTIME_FLAG="--$TARGET_RUNTIME"
```

**如果是 LOCAL 安装：**
```bash
npx -y get-shit-done-dh@latest "$RUNTIME_FLAG" --local
```

**如果是 GLOBAL 安装：**
```bash
npx -y get-shit-done-dh@latest "$RUNTIME_FLAG" --global
```

**如果是 UNKNOWN 安装：**
```bash
npx -y get-shit-done-dh@latest --claude --global
```

捕获输出。如果安装失败，显示错误并退出。

清除更新缓存，以便状态栏指示器消失：

```bash
# 清除所有运行时目录下的更新缓存
for dir in .claude .config/opencode .opencode .gemini .codex .codebuddy; do
  rm -f "./$dir/cache/gsd-update-check.json"
  rm -f "$HOME/$dir/cache/gsd-update-check.json"
done
```

SessionStart 钩子 (`gsd-check-update.js`) 会向检测到的运行时缓存目录写入数据，因此必须清除所有路径以防止出现过时的更新指示。
</step>

<step name="display_result">
格式化完成消息（变更日志已在确认步骤中显示）：

```
╔═══════════════════════════════════════════════════════════╗
║  GSD 已更新：v1.5.10 → v1.5.15                            ║
╚═══════════════════════════════════════════════════════════╝

⚠️  请重启运行时以加载新命令。

[查看完整变更日志](https://github.com/liu-xian-sen/get-shit-done-dh/blob/main/CHANGELOG.md)
```
</step>


<step name="check_local_patches">
更新完成后，检查安装程序是否检测并备份了任何本地修改的文件：

检查配置目录中的 gsd-local-patches/backup-meta.json。

**如果发现补丁：**

```
更新前已备份本地补丁。
运行 /gsd:reapply-patches 将您的修改合并到新版本中。
```

**如果没有补丁：** 正常继续。
</step>
</process>

<success_criteria>
- [ ] 已正确读取已安装版本
- [ ] 已通过 npm 检查最新版本
- [ ] 如果已是最新版本则跳过更新
- [ ] 在更新前已获取并显示变更日志
- [ ] 已显示全新安装警告
- [ ] 已获取用户确认
- [ ] 已成功执行更新
- [ ] 已显示重启提醒
</success_criteria>
