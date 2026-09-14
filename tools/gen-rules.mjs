// Converts tools/gitleaks.toml (gitleaks default config, MIT) into public/js/rules.js.
// Run: node tools/gen-rules.mjs
// No dependencies: a tiny parser for the TOML subset that file uses, plus Go -> JS regex translation.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const TOML = new URL('./gitleaks.toml', import.meta.url);
const OUT = new URL('../public/js/rules.js', import.meta.url);

// ponytail: handles [table], [[array.of.tables]], key = '''literal''' | 'literal' | "basic" | number | [arrays].
// Enough for gitleaks.toml; throws on anything else so a format change can't slip through silently.
export function parseToml(src) {
  const root = {};
  let cur = root;
  let i = 0;
  const ws = () => { for (;;) { while (/[\s,]/.test(src[i] ?? '')) i++; if (src[i] === '#') while (i < src.length && src[i] !== '\n') i++; else return; } };
  function value() {
    ws();
    if (src.startsWith("'''", i)) { const j = src.indexOf("'''", i + 3); const v = src.slice(i + 3, j); i = j + 3; return v; }
    if (src[i] === "'") { const j = src.indexOf("'", i + 1); const v = src.slice(i + 1, j); i = j + 1; return v; }
    if (src[i] === '"') {
      let v = ''; i++;
      while (src[i] !== '"') {
        if (src[i] === '\\') { const e = src[i + 1]; v += { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' }[e] ?? (() => { throw new Error(`escape \\${e} at ${i}`); })(); i += 2; }
        else v += src[i++];
      }
      i++; return v;
    }
    if (src[i] === '[') {
      const arr = []; i++;
      for (;;) { ws(); if (src[i] === ']') { i++; return arr; } arr.push(value()); }
    }
    const m = /^[-+]?\d+(\.\d+)?/.exec(src.slice(i, i + 40));
    if (!m) throw new Error(`unexpected value at ${i}: ${src.slice(i, i + 30)}`);
    i += m[0].length; return Number(m[0]);
  }
  for (;;) {
    ws();
    if (i >= src.length) return root;
    if (src.startsWith('[[', i)) {
      const j = src.indexOf(']]', i); const path = src.slice(i + 2, j).trim().split('.'); i = j + 2;
      let parent = root;
      for (const p of path.slice(0, -1)) { const v = parent[p]; parent = Array.isArray(v) ? v.at(-1) : v; }
      (parent[path.at(-1)] ??= []).push(cur = {});
    } else if (src[i] === '[') {
      const j = src.indexOf(']', i); const name = src.slice(i + 1, j).trim(); i = j + 1;
      if (name.includes('.')) throw new Error(`nested table ${name} not supported`);
      cur = root[name] ??= {};
    } else {
      const m = /^([A-Za-z0-9_-]+)\s*=/.exec(src.slice(i, i + 80));
      if (!m) throw new Error(`unexpected at ${i}: ${src.slice(i, i + 30)}`);
      i += m[0].length;
      cur[m[1]] = value();
    }
  }
}

const POSIX = { alnum: 'a-zA-Z0-9', alpha: 'a-zA-Z', digit: '0-9', lower: 'a-z', upper: 'A-Z', space: '\\s', xdigit: '0-9a-fA-F', punct: '!-\\/:-@\\[-`{-~', word: '\\w' };

// Go RE2 syntax -> JS RegExp source + flags. Node 22 has no inline modifiers, so:
// ponytail: any (?i) or (?i:...) makes the whole regex case-insensitive, and (?-i:...) becomes a plain group.
// That is slightly broader than gitleaks (e.g. p8e-(?i)[a-z0-9]{32} also matches P8E-...). Fine for masking.
export function goToJs(re) {
  let out = '', flags = '', inClass = false, i = 0;
  while (i < re.length) {
    const c = re[i];
    if (c === '\\') {
      const n = re[i + 1];
      if ('QEpPCK'.includes(n) || (n === 'x' && re[i + 2] === '{')) throw new Error(`unsupported escape \\${n} in ${re}`);
      out += !inClass && n === 'z' ? '$' : !inClass && n === 'A' ? '^' : c + n;
      i += 2; continue;
    }
    if (inClass) {
      if (c === '[' && re[i + 1] === ':') {
        const j = re.indexOf(':]', i); const cls = POSIX[re.slice(i + 2, j)];
        if (!cls) throw new Error(`unknown POSIX class in ${re}`);
        out += cls; i = j + 2; continue;
      }
      if (c === ']') inClass = false;
      out += c === '[' ? '\\[' : c; i++; continue;
    }
    if (c === '[') {
      out += '['; i++; inClass = true;
      if (re[i] === '^') { out += '^'; i++; }
      if (re[i] === ']') { out += '\\]'; i++; } // Go: leading ] is literal. JS: [] / [^] would mean something else.
      continue;
    }
    if (re.startsWith('(?i)', i)) { flags = 'i'; i += 4; continue; }
    if (re.startsWith('(?i:', i)) { flags = 'i'; out += '(?:'; i += 4; continue; }
    if (re.startsWith('(?-i:', i)) { out += '(?:'; i += 5; continue; }
    if (re.startsWith('(?s:.)', i)) { out += '[\\s\\S]'; i += 6; continue; }
    // ponytail: named groups become plain groups. No rule uses them as secretGroup, and keeping them as
    // captures would make "first non-empty group" mask a fragment of jwt-base64 instead of the whole token.
    if (re.startsWith('(?P<', i)) { out += '(?:'; i = re.indexOf('>', i) + 1; continue; }
    if (c === '(' && re[i + 1] === '?' && !/^\(\?(?::|=|!|<=|<!)/.test(re.slice(i, i + 4))) throw new Error(`unsupported group in ${re}`);
    out += c; i++;
  }
  return [out, flags];
}

export function convert(toml) {
  const cfg = parseToml(toml);
  const rules = [], skipped = [];
  for (const r of cfg.rules) {
    // ponytail: `path`/`paths` are ignored, a paste has no file path. Path-only rules can't apply at all.
    if (!r.regex) { skipped.push({ id: r.id, reason: 'path-only rule, a paste has no file name' }); continue; }
    const out = { id: r.id, regex: goToJs(r.regex) };
    // Only these can span lines; everything else runs per line after the keyword prefilter.
    if (/\[\\r\\n\]|\\n|\[\\s\\S|\(\?s:/.test(r.regex)) out.multiline = true;
    if (r.entropy) out.entropy = r.entropy;
    if (r.secretGroup) out.secretGroup = r.secretGroup;
    out.keywords = (r.keywords ?? []).map(k => k.toLowerCase());
    const lists = [];
    for (const a of r.allowlists ?? []) {
      if (a.condition === 'AND') {
        if (a.paths) continue; // AND with a path check can never pass without a path
        throw new Error(`AND allowlist without paths in ${r.id}`);
      }
      const l = {};
      if (a.regexTarget && a.regexTarget !== 'secret') l.target = a.regexTarget;
      if (a.regexes) l.regexes = a.regexes.map(goToJs);
      if (a.stopwords) l.stopwords = a.stopwords.map(s => s.toLowerCase());
      if (l.regexes || l.stopwords) lists.push(l);
    }
    if (lists.length) out.allowlists = lists;
    rules.push(out);
  }
  const allowlist = { regexes: cfg.allowlist.regexes.map(goToJs), stopwords: cfg.allowlist.stopwords.map(s => s.toLowerCase()) };
  return { rules, allowlist, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { rules, allowlist, skipped } = convert(readFileSync(TOML, 'utf8'));
  const body = [
    '// Generated by tools/gen-rules.mjs from tools/gitleaks.toml. Do not edit by hand.',
    '// Rules: gitleaks default config, Copyright (c) 2019 Zachary Rice, MIT License (see THIRD_PARTY_NOTICES).',
    'export default {',
    `"allowlist": ${JSON.stringify(allowlist)},`,
    `"skipped": ${JSON.stringify(skipped)},`,
    '"rules": [',
    rules.map(r => JSON.stringify(r)).join(',\n'),
    ']};',
    '',
  ].join('\n');
  writeFileSync(OUT, body);
  console.log(`wrote ${rules.length} rules (${skipped.length} skipped), multiline: ${rules.filter(r => r.multiline).map(r => r.id).join(', ')}`);
}
