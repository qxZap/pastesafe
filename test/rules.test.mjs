// Generated rule set: nothing dropped silently, everything compiles in JS, and rules.js matches the toml.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import RULES from '../public/js/rules.js';
import { convert } from '../tools/gen-rules.mjs';

const toml = readFileSync(new URL('../tools/gitleaks.toml', import.meta.url), 'utf8');

test('every [[rules]] entry is converted or explicitly skipped', () => {
  const count = toml.match(/^\[\[rules\]\]$/gm).length;
  assert.equal(RULES.rules.length + RULES.skipped.length, count);
  assert.ok(RULES.rules.length >= 200);
});

test('every rule and allowlist regex compiles with the flags the engine uses', () => {
  for (const r of RULES.rules) {
    assert.doesNotThrow(() => new RegExp(r.regex[0], r.regex[1] + 'gd'), r.id);
    for (const a of r.allowlists ?? []) for (const [src, flags] of a.regexes ?? []) new RegExp(src, flags);
    assert.ok(r.keywords.length || r.multiline, `${r.id} has a keyword prefilter`);
  }
  for (const [src, flags] of RULES.allowlist.regexes) new RegExp(src, flags);
});

test('public/js/rules.js is up to date with tools/gitleaks.toml', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(RULES)), JSON.parse(JSON.stringify(convert(toml))), 'run: node tools/gen-rules.mjs');
});
