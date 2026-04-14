/**
 * Template — Template selection and fill operations
 */

const fs = require('fs');
const path = require('path');
const { normalizePhaseName, findPhaseInternal, generateSlugInternal, normalizeMd, toPosixPath, output, error } = require('./core.cjs');
const { reconstructFrontmatter } = require('./frontmatter.cjs');

function cmdTemplateSelect(cwd, planPath, raw) {
  if (!planPath) {
    error('plan-path required');
  }

  try {
    const fullPath = path.join(cwd, planPath);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Simple heuristics
    const taskMatch = content.match(/###\s*Task\s*\d+/g) || [];
    const taskCount = taskMatch.length;

    const decisionMatch = content.match(/decision/gi) || [];
    const hasDecisions = decisionMatch.length > 0;

    // Count file mentions
    const fileMentions = new Set();
    const filePattern = /`([^`]+\.[a-zA-Z]+)`/g;
    let m;
    while ((m = filePattern.exec(content)) !== null) {
      if (m[1].includes('/') && !m[1].startsWith('http')) {
        fileMentions.add(m[1]);
      }
    }
    const fileCount = fileMentions.size;

    let template = 'templates/summary-standard.md';
    let type = 'standard';

    if (taskCount <= 2 && fileCount <= 3 && !hasDecisions) {
      template = 'templates/summary-minimal.md';
      type = 'minimal';
    } else if (hasDecisions || fileCount > 6 || taskCount > 5) {
      template = 'templates/summary-complex.md';
      type = 'complex';
    }

    const result = { template, type, taskCount, fileCount, hasDecisions };
    output(result, raw, template);
  } catch (e) {
    // Fallback to standard
    output({ template: 'templates/summary-standard.md', type: 'standard', error: e.message }, raw, 'templates/summary-standard.md');
  }
}

function cmdTemplateFill(cwd, templateType, options, raw) {
  if (!templateType) { error('template type required: summary, plan, or verification'); }
  if (!options.phase) { error('--phase required'); }

  const phaseInfo = findPhaseInternal(cwd, options.phase);
  if (!phaseInfo || !phaseInfo.found) { output({ error: 'Phase not found', phase: options.phase }, raw); return; }

  const padded = normalizePhaseName(options.phase);
  const today = new Date().toISOString().split('T')[0];
  const phaseName = options.name || phaseInfo.phase_name || 'Unnamed';
  const phaseSlug = phaseInfo.phase_slug || generateSlugInternal(phaseName);
  const phaseId = `${padded}-${phaseSlug}`;
  const planNum = (options.plan || '01').padStart(2, '0');
  const fields = options.fields || {};

  let frontmatter, body, fileName;

  switch (templateType) {
    case 'summary': {
      frontmatter = {
        phase: phaseId,
        plan: planNum,
        subsystem: '[primary category]',
        tags: [],
        provides: [],
        affects: [],
        'tech-stack': { added: [], patterns: [] },
        'key-files': { created: [], modified: [] },
        'key-decisions': [],
        'patterns-established': [],
        duration: '[X]min',
        completed: today,
        ...fields,
      };
      body = [
        `# 阶段 ${options.phase}：${phaseName} 总结`,
        '',
        '**[描述成果的实质性一句话]**',
        '',
        '## 性能',
        '- **耗时：** [时间]',
        '- **任务：** [完成数量]',
        '- **修改文件：** [数量]',
        '',
        '## 成果',
        '- [关键成果 1]',
        '- [关键成果 2]',
        '',
        '## 任务提交',
        '1. **任务 1：[任务名称]** - `hash`',
        '',
        '## 创建/修改的文件',
        '- `path/to/file.ts` - 用途说明',
        '',
        '## 决策与偏差',
        '[关键决策或"无 - 按计划执行"]',
        '',
        '## 下一阶段准备情况',
        '[为下一阶段准备了什么]',
      ].join('\n');
      fileName = `${padded}-${planNum}-SUMMARY.md`;
      break;
    }
    case 'plan': {
      const planType = options.type || 'execute';
      const wave = parseInt(options.wave) || 1;
      frontmatter = {
        phase: phaseId,
        plan: planNum,
        type: planType,
        wave,
        depends_on: [],
        files_modified: [],
        autonomous: true,
        user_setup: [],
        must_haves: { truths: [], artifacts: [], key_links: [] },
        ...fields,
      };
      body = [
        `# 阶段 ${options.phase} 计划 ${planNum}：[标题]`,
        '',
        '## 目标',
        '- **内容：** [此计划构建什么]',
        '- **原因：** [为什么对阶段目标重要]',
        '- **产出：** [具体交付物]',
        '',
        '## 上下文',
        '@.planning/PROJECT.md',
        '@.planning/ROADMAP.md',
        '@.planning/STATE.md',
        '',
        '## 任务',
        '',
        '<task type="code">',
        '  <name>[任务名称]</name>',
        '  <files>[文件路径]</files>',
        '  <action>[操作内容]</action>',
        '  <verify>[验证方式]</verify>',
        '  <done>[完成定义]</done>',
        '</task>',
        '',
        '## 验证',
        '[如何验证此计划达成目标]',
        '',
        '## 成功标准',
        '- [ ] [标准 1]',
        '- [ ] [标准 2]',
      ].join('\n');
      fileName = `${padded}-${planNum}-PLAN.md`;
      break;
    }
    case 'verification': {
      frontmatter = {
        phase: phaseId,
        verified: new Date().toISOString(),
        status: 'pending',
        score: '0/0 must-haves verified',
        ...fields,
      };
      body = [
        `# 阶段 ${options.phase}：${phaseName} — 验证`,
        '',
        '## 可观测事实',
        '| # | 事实 | 状态 | 证据 |',
        '|---|-------|--------|----------|',
        '| 1 | [事实] | 待验证 | |',
        '',
        '## 必需产出物',
        '| 产出物 | 预期 | 状态 | 详情 |',
        '|----------|----------|--------|---------|',
        '| [路径] | [内容] | 待验证 | |',
        '',
        '## 关键链接验证',
        '| 来源 | 目标 | 通过 | 状态 | 详情 |',
        '|------|----|----|--------|---------|',
        '| [来源] | [目标] | [连接] | 待验证 | |',
        '',
        '## 需求覆盖',
        '| 需求 | 状态 | 阻塞问题 |',
        '|-------------|--------|----------------|',
        '| [需求] | 待验证 | |',
        '',
        '## 结果',
        '[待验证]',
      ].join('\n');
      fileName = `${padded}-VERIFICATION.md`;
      break;
    }
    default:
      error(`Unknown template type: ${templateType}. Available: summary, plan, verification`);
      return;
  }

  const fullContent = `---\n${reconstructFrontmatter(frontmatter)}\n---\n\n${body}\n`;
  const outPath = path.join(cwd, phaseInfo.directory, fileName);

  if (fs.existsSync(outPath)) {
    output({ error: 'File already exists', path: toPosixPath(path.relative(cwd, outPath)) }, raw);
    return;
  }

  fs.writeFileSync(outPath, normalizeMd(fullContent), 'utf-8');
  const relPath = toPosixPath(path.relative(cwd, outPath));
  output({ created: true, path: relPath, template: templateType }, raw, relPath);
}

module.exports = { cmdTemplateSelect, cmdTemplateFill };
