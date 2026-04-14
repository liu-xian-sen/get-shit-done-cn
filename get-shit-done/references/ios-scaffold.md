# iOS 应用脚手架参考

搭建 iOS 应用的规则和模式。当任何计划涉及创建新的 iOS 应用目标时适用。

---

## 关键规则：永远不要将 Package.swift 作为 iOS 应用的主构建系统

**绝对不要使用 `Package.swift` 配合 `.executableTarget`（或 `.target`）来搭建 iOS 应用。** Swift Package Manager 可执行目标编译为 macOS 命令行工具——它们不产生 `.app` 包，不能为 iOS 设备签名，也不能提交到 App Store。

**禁止的模式：**
```swift
// Package.swift — 不要用于 iOS 应用
.executableTarget(name: "MyApp", dependencies: [])
// 或
.target(name: "MyApp", dependencies: [])
```

使用此模式产生的是 macOS CLI 二进制文件，而不是 iOS 应用。该应用不会在任何 iOS 模拟器或设备上构建。

---

## 必须使用的模式：XcodeGen

所有 iOS 应用脚手架**必须**使用 XcodeGen 生成 `.xcodeproj`。

### 步骤 1 — 安装 XcodeGen（如未安装）

```bash
brew install xcodegen
```

### 步骤 2 — 创建 `project.yml`

`project.yml` 是描述项目结构的 XcodeGen 规格文件。最简可用规格：

```yaml
name: MyApp
options:
  bundleIdPrefix: com.example
  deploymentTarget:
    iOS: "17.0"
settings:
  SWIFT_VERSION: "5.10"
  IPHONEOS_DEPLOYMENT_TARGET: "17.0"
targets:
  MyApp:
    type: application
    platform: iOS
    sources: [Sources/MyApp]
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.example.MyApp
      INFOPLIST_FILE: Sources/MyApp/Info.plist
    scheme:
      testTargets:
        - MyAppTests
  MyAppTests:
    type: bundle.unit-test
    platform: iOS
    sources: [Tests/MyAppTests]
    dependencies:
      - target: MyApp
```

### 步骤 3 — 生成 .xcodeproj

```bash
xcodegen generate
```

这会在项目根目录创建 `MyApp.xcodeproj`。提交 `project.yml` 并将 `*.xcodeproj` 添加到 `.gitignore`（检出时重新生成）。

### 步骤 4 — 标准项目布局

```
MyApp/
├── project.yml              # XcodeGen 规格——提交此文件
├── .gitignore               # 包含 *.xcodeproj
├── Sources/
│   └── MyApp/
│       ├── MyAppApp.swift   # @main 入口点
│       ├── ContentView.swift
│       └── Info.plist
└── Tests/
    └── MyAppTests/
        └── MyAppTests.swift
```

---

## iOS 部署目标兼容性

在使用任何 SwiftUI 组件之前，始终对照项目的 `IPHONEOS_DEPLOYMENT_TARGET` 验证 SwiftUI API 可用性。

| API | 最低 iOS 版本 |
|-----|-------------|
| `NavigationView` | iOS 13 |
| `NavigationStack` | iOS 16 |
| `NavigationSplitView` | iOS 16 |
| `List(selection:)` 多选 | iOS 17 |
| `ScrollView` 滚动位置 API | iOS 17 |
| `Observable` 宏（`@Observable`） | iOS 17 |
| `SwiftData` | iOS 17 |
| `@Bindable` | iOS 17 |
| `TipKit` | iOS 17 |

**规则：** 如果计划需要超出项目部署目标的 SwiftUI API，要么：
1. 在 `project.yml` 中提升部署目标（并记录决策），或
2. 用 `if #available(iOS NN, *) { ... }` 包装调用并提供回退实现。

不要静默地使用要求比声明的部署目标更高 iOS 版本的 API——该应用在旧设备上运行时会崩溃。

---

## 验证

运行 `xcodegen generate` 后，验证项目构建：

```bash
xcodebuild -project MyApp.xcodeproj -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' build
```

成功构建（退出码为 0）确认脚手架对 iOS 有效。
