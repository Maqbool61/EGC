/**
 * Tests for scripts/lib/mcp-register.js (issue #550)
 *
 * Covers the target list (including the new Continue.dev entry, which
 * writes a Continue YAML block file rather than JSON), the JSON/TOML merge
 * behavior, and the registerMcpServers() orchestrator that scripts/init.js
 * delegates to.
 *
 * Run with: node tests/lib/mcp-register.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildMcpRegistrationTargets,
  registerJson,
  registerToml,
  registerContinueYaml,
  registerMcpServers,
} = require('../../scripts/lib/mcp-register');

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    return true;
  } catch (err) {
    console.log(`  \u2717 ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-register-test-'));
}

const bins = {
  guardianBin: '/fake/mcp/servers/egc-guardian/build/index.js',
  memoryBin: '/fake/mcp/servers/egc-memory/build/index.js',
};

function runTests() {
  console.log('\n=== Testing scripts/lib/mcp-register.js ===\n');

  let passed = 0;
  let failed = 0;

  // ── buildMcpRegistrationTargets ──────────────────────────────────

  (test('includes a Continue.dev target pointed at the mcpServers directory', () => {
    const targets = buildMcpRegistrationTargets('/home/person');
    const continueTarget = targets.find(t => t.name === 'Continue.dev');
    assert.ok(continueTarget, 'Continue.dev target should exist');
    assert.strictEqual(
      continueTarget.path,
      path.join('/home/person', '.continue', 'mcpServers'),
      'Continue.dev should write into the mcpServers folder, not a single file or config.json'
    );
    assert.strictEqual(continueTarget.format, 'continue-yaml');
  }) ? passed++ : failed++);

  (test('Continue.dev gate is false when ~/.continue does not exist', () => {
    const tmpHome = makeTempDir();
    const targets = buildMcpRegistrationTargets(tmpHome);
    const continueTarget = targets.find(t => t.name === 'Continue.dev');
    assert.strictEqual(continueTarget.gate(), false);
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  (test('Continue.dev gate is true when ~/.continue exists', () => {
    const tmpHome = makeTempDir();
    fs.mkdirSync(path.join(tmpHome, '.continue'));
    const targets = buildMcpRegistrationTargets(tmpHome);
    const continueTarget = targets.find(t => t.name === 'Continue.dev');
    assert.strictEqual(continueTarget.gate(), true);
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  (test('does not drop any of the pre-existing targets', () => {
    const targets = buildMcpRegistrationTargets('/home/person');
    const names = targets.map(t => t.name);
    for (const expected of [
      'Antigravity CLI', 'Gemini CLI', 'Claude Code (global)', 'Cursor',
      'Kiro', 'Codex CLI', 'OpenCode',
    ]) {
      assert.ok(names.includes(expected), `${expected} should still be a target`);
    }
  }) ? passed++ : failed++);

  // ── registerJson (generic - used by Cursor, Claude, Gemini, Kiro, etc.) ──

  (test('registerJson creates a fresh file with both mcp servers', () => {
    const tmpHome = makeTempDir();
    const target = path.join(tmpHome, '.cursor', 'mcp.json');
    const changed = registerJson(target, bins);

    assert.strictEqual(changed, true);
    const written = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.deepStrictEqual(written.mcpServers['egc-guardian'], { command: 'node', args: [bins.guardianBin] });
    assert.deepStrictEqual(written.mcpServers['egc-memory'], { command: 'node', args: [bins.memoryBin] });

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  (test('registerJson preserves unrelated existing mcpServers entries', () => {
    const tmpHome = makeTempDir();
    const dir = path.join(tmpHome, '.cursor');
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, 'mcp.json');
    fs.writeFileSync(target, JSON.stringify({
      mcpServers: { 'some-other-server': { command: 'npx', args: ['-y', 'other'] } },
    }, null, 2));

    registerJson(target, bins);

    const written = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.ok(written.mcpServers['some-other-server'], 'pre-existing unrelated server should survive the merge');
    assert.ok(written.mcpServers['egc-guardian'], 'egc-guardian should be added');
    assert.ok(written.mcpServers['egc-memory'], 'egc-memory should be added');

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  (test('registerJson is idempotent: second run reports no change', () => {
    const tmpHome = makeTempDir();
    const target = path.join(tmpHome, '.cursor', 'mcp.json');

    const firstRun = registerJson(target, bins);
    const secondRun = registerJson(target, bins);

    assert.strictEqual(firstRun, true, 'first run should report a change');
    assert.strictEqual(secondRun, false, 'second run should report no change (already registered)');

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  (test('registerJson leaves the file untouched if it contains invalid JSON', () => {
    const tmpHome = makeTempDir();
    const dir = path.join(tmpHome, '.cursor');
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, 'mcp.json');
    fs.writeFileSync(target, 'not valid json {{{');

    const changed = registerJson(target, bins);

    assert.strictEqual(changed, false, 'should not report a change on unparseable existing file');
    assert.strictEqual(fs.readFileSync(target, 'utf8'), 'not valid json {{{', 'existing content should be untouched, not clobbered');

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  // ── registerToml (unchanged behavior, guards against regressions) ──

  (test('registerToml appends both mcp_servers blocks to a fresh file', () => {
    const tmpHome = makeTempDir();
    const target = path.join(tmpHome, '.codex', 'config.toml');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '');

    const changed = registerToml(target, bins);

    assert.strictEqual(changed, true);
    const content = fs.readFileSync(target, 'utf8');
    assert.ok(content.includes('name = "egc-guardian"'));
    assert.ok(content.includes('name = "egc-memory"'));

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  // ── registerContinueYaml ─────────────────────────────────────────

  (test('registerContinueYaml writes two files, one server each', () => {
    const tmpHome = makeTempDir();
    const targetDir = path.join(tmpHome, '.continue', 'mcpServers');
    const changed = registerContinueYaml(targetDir, bins);

    assert.strictEqual(changed, true);
    const guardianContent = fs.readFileSync(path.join(targetDir, 'egc-guardian.yaml'), 'utf8');
    const memoryContent = fs.readFileSync(path.join(targetDir, 'egc-memory.yaml'), 'utf8');

    // Required top-level block metadata per Continue's docs
    assert.ok(/^name: .+/m.test(guardianContent) && /^version: .+/m.test(guardianContent) && /^schema: v1$/m.test(guardianContent));
    assert.ok(/^name: .+/m.test(memoryContent) && /^version: .+/m.test(memoryContent) && /^schema: v1$/m.test(memoryContent));

    // Each file defines exactly one server - Continue's real schema rejects
    // a block file with more than one mcpServers entry, confirmed against
    // the actual @continuedev/config-yaml package below.
    assert.ok(guardianContent.includes('- name: egc-guardian'));
    assert.ok(!guardianContent.includes('egc-memory'), 'guardian file should not also define memory');
    assert.ok(memoryContent.includes('- name: egc-memory'));
    assert.ok(!memoryContent.includes('egc-guardian'), 'memory file should not also define guardian');
    assert.ok(guardianContent.includes(bins.guardianBin));
    assert.ok(memoryContent.includes(bins.memoryBin));

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  (test('registerContinueYaml is idempotent: second run reports no change', () => {
    const tmpHome = makeTempDir();
    const targetDir = path.join(tmpHome, '.continue', 'mcpServers');

    const firstRun = registerContinueYaml(targetDir, bins);
    const secondRun = registerContinueYaml(targetDir, bins);

    assert.strictEqual(firstRun, true, 'first run should report a change');
    assert.strictEqual(secondRun, false, 'second run should report no change (content identical)');

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  (test('registerContinueYaml regenerates a file if its bin path changes', () => {
    const tmpHome = makeTempDir();
    const targetDir = path.join(tmpHome, '.continue', 'mcpServers');

    registerContinueYaml(targetDir, bins);
    const changed = registerContinueYaml(targetDir, {
      guardianBin: '/new/path/egc-guardian/index.js',
      memoryBin: bins.memoryBin,
    });

    assert.strictEqual(changed, true, 'a changed bin path should be treated as a real change');
    const guardianContent = fs.readFileSync(path.join(targetDir, 'egc-guardian.yaml'), 'utf8');
    assert.ok(guardianContent.includes('/new/path/egc-guardian/index.js'));

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  // Real schema validation, not just "is this valid YAML" - uses the
  // actual published @continuedev/config-yaml package (the same one
  // Continue's own core imports) to parse what we generate. Skips itself
  // gracefully if the package isn't installed, e.g. offline CI, rather
  // than failing the whole suite over an optional cross-check.
  (test('registerContinueYaml output validates against the real Continue block schema', () => {
    let parseBlock;
    try {
      parseBlock = require('@continuedev/config-yaml').parseBlock;
    } catch (_) {
      console.log('    (skipped: @continuedev/config-yaml not installed)');
      return;
    }

    const tmpHome = makeTempDir();
    const targetDir = path.join(tmpHome, '.continue', 'mcpServers');
    registerContinueYaml(targetDir, bins);

    const guardianContent = fs.readFileSync(path.join(targetDir, 'egc-guardian.yaml'), 'utf8');
    const memoryContent = fs.readFileSync(path.join(targetDir, 'egc-memory.yaml'), 'utf8');

    const guardianParsed = parseBlock(guardianContent);
    const memoryParsed = parseBlock(memoryContent);
    assert.strictEqual(guardianParsed.mcpServers[0].name, 'egc-guardian');
    assert.strictEqual(memoryParsed.mcpServers[0].name, 'egc-memory');

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  // ── registerMcpServers orchestrator ─────────────────────────────

  (test('registerMcpServers writes Continue.dev config when ~/.continue exists', () => {
    const tmpHome = makeTempDir();
    fs.mkdirSync(path.join(tmpHome, '.continue'));

    const registered = [];
    registerMcpServers(tmpHome, bins, {
      dryRun: false,
      onRegister: (target) => registered.push(target.name),
    });

    assert.ok(registered.includes('Continue.dev'), 'Continue.dev should be reported as registered');
    const dir = path.join(tmpHome, '.continue', 'mcpServers');
    assert.ok(fs.readFileSync(path.join(dir, 'egc-guardian.yaml'), 'utf8').includes('- name: egc-guardian'));
    assert.ok(fs.readFileSync(path.join(dir, 'egc-memory.yaml'), 'utf8').includes('- name: egc-memory'));

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  (test('registerMcpServers skips Continue.dev entirely when ~/.continue is absent', () => {
    const tmpHome = makeTempDir();

    const registered = [];
    registerMcpServers(tmpHome, bins, {
      dryRun: false,
      onRegister: (target) => registered.push(target.name),
    });

    assert.ok(!registered.includes('Continue.dev'), 'Continue.dev should not be touched when not installed');
    assert.ok(!fs.existsSync(path.join(tmpHome, '.continue')), 'no .continue dir should be created as a side effect');

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  (test('registerMcpServers in dry-run mode writes nothing', () => {
    const tmpHome = makeTempDir();
    fs.mkdirSync(path.join(tmpHome, '.continue'));

    const skipped = [];
    registerMcpServers(tmpHome, bins, {
      dryRun: true,
      onSkip: (target) => skipped.push(target.name),
    });

    assert.ok(skipped.includes('Continue.dev'));
    assert.ok(!fs.existsSync(path.join(tmpHome, '.continue', 'mcpServers')), 'dry-run must not write any files');

    fs.rmSync(tmpHome, { recursive: true, force: true });
  }) ? passed++ : failed++);

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
