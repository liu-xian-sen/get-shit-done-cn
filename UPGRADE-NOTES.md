# Upgrade Notes: v1.25.0 → v1.27.0

**Date**: 2026-03-21
**Source**: `get-shit-done` (v1.27.0)
**Target**: `get-shit-done-cn` (v1.25.0 → v1.27.0)

## Summary

Synced all changes from upstream v1.25.0 → v1.27.0 (spanning v1.26.0 and v1.27.0 releases).
Total: **89 files changed** (+10,707 / -582 lines).

## What Was Done

### 1. Backup
- `bin/install.js` → `bin/install.js.bak` (preserved original Chinese localized version)

### 2. New Files Added (34 files — copied directly from source)

**agents/ (2)**
- `gsd-advisor-researcher.md` — Advisor mode research sub-agent
- `gsd-user-profiler.md` — User behavioral profiling agent

**commands/gsd/ (14)**
- `add-backlog.md`, `audit-uat.md`, `fast.md`, `next.md`, `plant-seed.md`
- `pr-branch.md`, `profile-user.md`, `review-backlog.md`, `review.md`
- `session-report.md`, `ship.md`, `thread.md`
- `list-workspaces.md`, `remove-workspace.md`

**get-shit-done/bin/lib/ (4)**
- `profile-output.cjs` (+952 lines)
- `profile-pipeline.cjs` (+537 lines)
- `security.cjs` (+356 lines)
- `uat.cjs` (+189 lines)

**get-shit-done/references/ (1)**
- `user-profiling.md`

**get-shit-done/templates/ (4)**
- `claude-md.md`, `dev-preferences.md`, `discussion-log.md`, `user-profile.md`

**get-shit-done/workflows/ (9)**
- `audit-uat.md`, `fast.md`, `next.md`, `plant-seed.md`, `pr-branch.md`
- `profile-user.md`, `review.md`, `session-report.md`, `ship.md`

**hooks/ (2)**
- `gsd-prompt-guard.js` — Prompt injection protection
- `gsd-workflow-guard.js` — Workflow guard

### 3. Modified Files Overwritten (55 files — overwritten with source version)

**agents/ (7)** — previously Chinese-localized, now English
- `gsd-executor.md`, `gsd-phase-researcher.md`, `gsd-plan-checker.md`
- `gsd-planner.md`, `gsd-project-researcher.md`, `gsd-ui-researcher.md`, `gsd-verifier.md`

**bin/ (1)**
- `install.js` — major update (+1585 lines), backup at `install.js.bak`

**commands/gsd/ (2)** — previously Chinese-localized, now English
- `discuss-phase.md`, `execute-phase.md`

**get-shit-done/bin/ (12)** — code files, some had Chinese templates/messages
- `gsd-tools.cjs`, `commands.cjs`, `config.cjs`, `core.cjs`, `frontmatter.cjs`
- `init.cjs`, `milestone.cjs`, `phase.cjs`, `roadmap.cjs`, `state.cjs`
- `template.cjs`, `verify.cjs`

**get-shit-done/references/ (4)**
- `checkpoints.md`, `git-integration.md`, `model-profiles.md`, `planning-config.md`

**get-shit-done/templates/ (5)**
- `UAT.md`, `config.json`, `context.md`, `phase-prompt.md`, `project.md`

**get-shit-done/workflows/ (19)** — previously Chinese-localized, now English
- `discuss-phase.md`, `execute-phase.md`, `execute-plan.md`, `health.md`
- `help.md`, `map-codebase.md`, `new-milestone.md`, `new-project.md`
- `pause-work.md`, `plan-phase.md`, `progress.md`, `quick.md`
- `resume-project.md`, `settings.md`, `stats.md`, `transition.md`
- `update.md`, `verify-phase.md`, `verify-work.md`

**hooks/ (3)**
- `gsd-check-update.js`, `gsd-context-monitor.js`, `gsd-statusline.js`

**scripts/ (1)**
- `build-hooks.js`

**Root (2)**
- `package.json` — updated to v1.27.0, restored name=`get-shit-done-cn` and bin key
- `CHANGELOG.md` — synced from source (includes v1.26.0 and v1.27.0 entries)

### 4. package.json Adjustments
- `name`: restored to `get-shit-done-cn`
- `bin`: restored to `{ "get-shit-done-cn": "bin/install.js" }`
- `keywords`: preserved `codebuddy` keyword
- `version`: updated to `1.27.0`

### 5. Files NOT Touched (dh-only, preserved)
- `scripts/translate-plan.js` — Chinese translation mapping script
- `README.zh-CN.md` — Chinese README
- `bin/install.js.bak` — backup of original localized install.js
- Various `.tgz` files, `test_output*.txt`, `nul`

## Phase 2: CodeBuddy Port (COMPLETE)

Ported all CodeBuddy runtime support from `install.js.bak` (v1.25.0 dh fork) into the new `install.js` (v1.27.0):

- CLI flag parsing (`--codebuddy`, `selectedRuntimes`)
- Directory mapping (`getDirName`, `getConfigDirFromHome`, `getGlobalDir`)
- Banner text with CodeBuddy label
- 4 converter functions (`convertClaudeToCodebuddyContent`, `convertClaudeCommandToCodebuddySkill`, `convertClaudeAgentToCodebuddyAgent`, `copyCommandsAsCodebuddySkills`)
- `copyWithPathReplacement()` — CodeBuddy branches for .md and .cjs/.js
- `uninstall()` — runtimeLabel + CodeBuddy case (commands/gsd + legacy skills)
- `install()` — isCodebuddy flag, runtimeLabel, CodeBuddy install branch
- Agent section — `convertClaudeAgentToCodebuddyAgent` call
- Early return after hooks (no settings.json/statusline for CodeBuddy)
- `finishInstall()` — exclusions + program/command labels
- `promptRuntime()` — CodeBuddy as option 7, Cursor→8, All→9
- Help text — `--codebuddy` option and examples
- Test exports — 4 CodeBuddy functions added

Verified: `node --check bin/install.js` passes ✅

## Phase 3: Chinese Translation (COMPLETE)

Translated **65 .md files** to Chinese (35 overwritten + 30 new .md files):

### Agents (9 files) ✅
- `gsd-executor.md`, `gsd-phase-researcher.md`, `gsd-plan-checker.md`
- `gsd-planner.md`, `gsd-project-researcher.md`, `gsd-ui-researcher.md`, `gsd-verifier.md`
- `gsd-advisor-researcher.md` (new), `gsd-user-profiler.md` (new)

### Commands (16 files) ✅
- `discuss-phase.md`, `execute-phase.md` (re-translated)
- `add-backlog.md`, `audit-uat.md`, `fast.md`, `next.md`, `plant-seed.md` (new)
- `pr-branch.md`, `profile-user.md`, `review-backlog.md`, `review.md` (new)
- `session-report.md`, `ship.md`, `thread.md` (new)
- `list-workspaces.md`, `remove-workspace.md` (new)

### Workflows (28 files) ✅
- Re-translated (19): `discuss-phase.md`, `execute-phase.md`, `execute-plan.md`, `health.md`, `help.md`, `map-codebase.md`, `new-milestone.md`, `new-project.md`, `pause-work.md`, `plan-phase.md`, `progress.md`, `quick.md`, `resume-project.md`, `settings.md`, `stats.md`, `transition.md`, `update.md`, `verify-phase.md`, `verify-work.md`
- New (9): `audit-uat.md`, `fast.md`, `next.md`, `plant-seed.md`, `pr-branch.md`, `profile-user.md`, `review.md`, `session-report.md`, `ship.md`

### Templates (8 files) ✅
- Re-translated (4): `UAT.md`, `context.md`, `phase-prompt.md`, `project.md`
- New (4): `claude-md.md`, `dev-preferences.md`, `discussion-log.md`, `user-profile.md`

### References (4 files) ✅
- Re-translated (3): `checkpoints.md`, `model-profiles.md`, `planning-config.md`
- New (1): `user-profiling.md`

### Not Translated (by design)
- `.cjs` files in `get-shit-done/bin/lib/` — code files, not documentation
- `.js` hook files — code files
- `config.json` template — JSON structure
- `git-integration.md` — not in scope (not overwritten/new in this upgrade)
