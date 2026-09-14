// PasteSafe detection engine. Pure ES module: runs in the scan Web Worker and in Node tests.
// scan(text, enabled) finds secrets and personal data and replaces each unique value with a stable placeholder.
// restore(text, map) swaps placeholders back. Nothing here touches the network or any storage.
import RULES from './rules.js';

export const CATEGORIES = ['keys', 'privateKeys', 'passwords', 'email', 'ip', 'card', 'iban', 'phone'];

// Placeholders are whole "words" of [A-Za-z0-9_], so restore can match them without touching EMAIL_10 when
// looking for EMAIL_1. Every masked span is widened to word boundaries so a placeholder never touches a word char.
const PLACEHOLDER = /(?<![A-Za-z0-9_])[A-Z0-9][A-Z0-9_]*_\d+(?![A-Za-z0-9_])/g;
const isWord = c => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;

export function entropy(s) {
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let e = 0;
  for (const n of counts.values()) { const p = n / s.length; e -= p * Math.log2(p); }
  return e;
}

// ---- gitleaks rules ----

const NAMES = {
  'aws-access-token': 'AWS_ACCESS_KEY', 'generic-api-key': 'API_KEY', 'stripe-access-token': 'STRIPE_KEY',
  'private-key': 'PRIVATE_KEY', 'jwt': 'JWT', 'jwt-base64': 'JWT',
};
const re = ([src, flags], extra = '') => new RegExp(src, flags + extra);
let compiled;
function rules() {
  return compiled ??= {
    global: { regexes: RULES.allowlist.regexes.map(r => re(r)), stopwords: RULES.allowlist.stopwords },
    list: RULES.rules.map(r => ({
      ...r,
      re: re(r.regex, 'gd'),
      allowlists: (r.allowlists ?? []).map(a => ({ ...a, regexes: (a.regexes ?? []).map(x => re(x)) })),
      category: r.id === 'private-key' ? 'privateKeys' : r.id.includes('password') ? 'passwords' : 'keys',
      tier: r.id.startsWith('generic') ? 1 : 4,
      name: NAMES[r.id] ?? (r.id.startsWith('github-') ? 'GITHUB_TOKEN' : r.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')),
    })),
  };
}

const listHits = (a, secret, match, line) => {
  const target = a.target === 'match' ? match : a.target === 'line' ? line : secret;
  if (a.regexes?.some(r => r.test(target))) return true;
  if (a.stopwords?.length) { const low = secret.toLowerCase(); return a.stopwords.some(w => low.includes(w)); }
  return false;
};

function scanRules(text, lower, lines, starts, enabled, add) {
  const { global, list } = rules();
  // Line index for each keyword, found with indexOf on the whole lowercased text (much faster than per line).
  // Line starts come from `lower` itself, since toLowerCase can change string length but never newlines.
  const lowStarts = [0];
  for (let p = lower.indexOf('\n'); p !== -1; p = lower.indexOf('\n', p + 1)) lowStarts.push(p + 1);
  const kwLines = new Map();
  const linesFor = kw => {
    let arr = kwLines.get(kw);
    if (!arr) {
      arr = [];
      for (let p = lower.indexOf(kw), li = 0; p !== -1; p = lower.indexOf(kw, p + 1)) {
        while (li + 1 < lowStarts.length && lowStarts[li + 1] <= p) li++;
        if (arr.at(-1) !== li) arr.push(li);
      }
      kwLines.set(kw, arr);
    }
    return arr;
  };
  const seen = new Int32Array(lines.length);
  const verdicts = new Map();

  list.forEach((rule, ri) => {
    if (!enabled.has(rule.category)) return;
    const hit = (m, base, line) => {
      let g = rule.secretGroup ?? m.findIndex((v, i) => i > 0 && v);
      if (g < 0) g = 0;
      const secret = m[g];
      if (!secret) return;
      const key = ri + '\0' + m[0] + '\0' + (rule.allowlists.some(a => a.target === 'line') ? line : '');
      let ok = verdicts.get(key);
      if (ok === undefined) {
        ok = !(rule.entropy && entropy(secret) <= rule.entropy)
          && !global.regexes.some(r => r.test(secret))
          && !global.stopwords.some(w => secret.toLowerCase().includes(w))
          && !rule.allowlists.some(a => listHits(a, secret, m[0], line));
        verdicts.set(key, ok);
      }
      if (ok) add(base + m.indices[g][0], base + m.indices[g][1], rule.category, rule.name, rule.tier, rule.id);
    };
    const exec = (str, base) => {
      rule.re.lastIndex = 0;
      for (let m; (m = rule.re.exec(str));) {
        if (!m[0]) { rule.re.lastIndex++; continue; }
        hit(m, base, str);
      }
    };
    if (rule.multiline) {
      if (rule.keywords.some(k => lower.includes(k))) exec(text, 0);
      return;
    }
    const stamp = ri + 1;
    for (const kw of rule.keywords) {
      for (const li of linesFor(kw)) {
        if (seen[li] === stamp) continue;
        seen[li] = stamp;
        exec(lines[li], starts[li]);
      }
    }
  });
}

// ---- extra detectors ----

const luhn = d => {
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
};
const ibanOk = v => {
  const s = v.replace(/ /g, '');
  if (s.length < 15 || s.length > 34) return false;
  const digits = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => c.charCodeAt(0) - 55);
  let r = 0;
  for (const ch of digits) r = (r * 10 + +ch) % 97;
  return r === 1;
};
const ipv6Ok = v => {
  const parts = v.split('::');
  if (parts.length > 2) return false;
  const groups = parts.flatMap(p => (p ? p.split(':') : []));
  if (!groups.every(g => /^[0-9a-f]{1,4}$/i.test(g))) return false;
  if (parts.length === 1 ? groups.length !== 8 : groups.length > 7) return false;
  // ponytail: conservative, needs 3+ groups and a digit, so "fe80::1" and C++ "a::b" style text are not flagged.
  return groups.length >= 3 && /\d/.test(v);
};
const DB_SCHEMES = /^(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|amqps?|mssql|sqlserver|oracle|cockroachdb|clickhouse|couchdb|neo4j(?:\+s)?)$/i;

const EXTRAS = [
  { // Authorization: Bearer <token>, Basic <creds>, or a bare "Bearer <token>"
    category: 'keys', tier: 3,
    re: /\b(?:authorization[ \t]*["']?[ \t]*[:=][ \t]*["']?(bearer|basic|token)[ \t]+|(bearer)[ \t]+)([A-Za-z0-9\-._~+\/]{12,}=*)/gdi,
    group: 3, name: m => (/basic/i.test(m[1] ?? '') ? 'BASIC_AUTH' : 'BEARER_TOKEN'), ok: v => entropy(v) > 3,
  },
  { // scheme://user:password@host, covers database connection URLs
    category: 'passwords', tier: 3,
    re: /\b([a-z][a-z0-9+.-]{1,20}):\/\/[^\s:@\/?#'"]+:([^\s\/?#'"]+)@/gdi,
    group: 2, name: m => (DB_SCHEMES.test(m[1]) ? 'DB_PASSWORD' : 'PASSWORD'),
  },
  {
    category: 'email', tier: 2, name: () => 'EMAIL',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}\b/gd,
    // not icon@2x.png, and not the user:token@ part of a URL (the URL detector and token rules own that)
    ok: (v, text, s) => !/\.(?:png|jpe?g|gif|svg|webp|avif|ico|js|mjs|css|map|json|txt|log)$/i.test(v) && !/:\/\/[^\s\/@]*$/.test(text.slice(Math.max(0, s - 200), s)),
  },
  {
    category: 'ip', tier: 2, name: () => 'IP',
    re: /(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?!\w|\.\d)/gd,
    // ponytail: loopback/unspecified/broadcast carry no information worth hiding, and "4.0.0.0" after "Version=" is a version.
    ok: (v, text, start) => !/^(?:127\.|0\.0\.0\.0$|255\.255\.255\.255$)/.test(v) && !/version\W{0,3}$/i.test(text.slice(Math.max(0, start - 12), start)),
  },
  {
    category: 'ip', tier: 2, name: () => 'IP',
    re: /(?<![\w:.])(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?![\w:]|\.\d)/gd,
    ok: ipv6Ok,
  },
  {
    category: 'card', tier: 2, name: () => 'CARD',
    re: /(?<![\d-])(?:\d{4}([ -]?)\d{4}\1\d{4}\1\d{4}(?:\1\d{1,3})??|\d{4}([ -]?)\d{6}\2\d{4,5}|\d{13,19})(?![\d-])/gd,
    ok: v => { const d = v.replace(/\D/g, ''); return /^(?:4|5[1-5]|2[2-7]|3[47]|3[0689]|35|6)/.test(d) && d.length >= 13 && !/^(\d)\1+$/.test(d) && luhn(d); },
  },
  {
    category: 'iban', tier: 2, name: () => 'IBAN',
    re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/gd,
    ok: ibanOk,
  },
  { // conservative: +international, (555) 123-4567 or 555-123-4567, 10 to 15 digits
    category: 'phone', tier: 2, name: () => 'PHONE',
    re: /(?<![\w+.-])(?:\+\d{1,3}[ .-]?(?:\(\d{1,4}\)[ .-]?)?\d{1,4}(?:[ .-]?\d{2,4}){2,4}|\(\d{3}\) ?\d{3}-\d{4}|\d{3}-\d{3}-\d{4})(?![\w-]|\.\d)/gd,
    ok: v => { const n = v.replace(/\D/g, '').length; return n >= 10 && n <= 15; },
  },
];

// key = value, "key": "value", export KEY=value, key: value (line start). Groups: key 1|4|6, value 2|3|5|7|8|9.
const ASSIGN = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][\w.-]*)[ \t]*[:=][ \t]*(?:"([^"\n]*)"|'([^'\n]*)'|([^\s"'][^\s]*?))[ \t]*,?[ \t]*\r?$|(?<![\w.-])"([A-Za-z_][\w.-]*)"[ \t]*:[ \t]*"((?:[^"\\\n]|\\.)*)"|(?<![\w.-])([A-Za-z_][\w.-]*)[ \t]*=[ \t]*(?:"([^"\n]*)"|'([^'\n]*)'|([^\s"'<>,;&()]+))/gmd;
const SECRET_NAME = /PASSWORD|PASSWD|PASSPHRASE|SECRET|TOKEN|PRIVATE|CREDENTIAL/;
const secretName = key => {
  const up = key.toUpperCase();
  if (/PUBLIC|PUBLISHABLE/.test(up)) return false;
  if (SECRET_NAME.test(up)) return true;
  return key.split(/[_.-]|(?<=[a-z0-9])(?=[A-Z])/).some(s => /^(?:[A-Z]*KEYS?|PASS|PWD)$/.test(s.toUpperCase()));
};
const NOT_A_VALUE = /^(?:\*+|x+|\.\.\.|<[^>]*>|\[[^\]]*\]|\$\{?[\w.]+\}?|%\w+%|\{\{.*\}\}|null|nil|none|undefined|true|false|yes|no|on|off|changeme|redacted|[A-Z0-9][A-Z0-9_]*_\d+)$/i;
const DOTTED = /^[A-Za-z_$][\w$-]*(?:\.[A-Za-z_$][\w$-]*)+$/; // process.env.TOKEN, org.apache.Foo, file.tar.gz
const ID_NAME = /(?:^|[_.-])(?:ids?|uuid|guid|hash|sha\d*|md5|commit|rev|revision|checksum|digest|etag|integrity|nonce|trace|span|request|build|version|path|file|filename|dir|url|uri|href|src|name|image|class|type)$|[a-z](?:Id|Hash|Url|Path|Name)$/i;
const highEntropy = v => v.length >= 20 && v.length <= 1000 && /^[\w+\/=.~-]+$/.test(v) && /\d/.test(v) && /[A-Za-z]/.test(v)
  && !v.startsWith('/') && !/^[0-9a-f-]+$/i.test(v) && !DOTTED.test(v) && entropy(v) >= 3.7;

function scanAssignments(text, enabled, add) {
  const { global } = rules();
  ASSIGN.lastIndex = 0;
  for (let m; (m = ASSIGN.exec(text));) {
    if (!m[0]) { ASSIGN.lastIndex++; continue; }
    const k = m[1] ? 1 : m[5] ? 5 : 7;
    const key = m[k];
    const g = [k + 1, k + 2, k + 3].find(i => i <= 10 && m[i] !== undefined && (k === 5 ? i === 6 : true));
    const value = m[g];
    if (!value) continue;
    const [s, e] = m.indices[g];
    if (k === 1) ASSIGN.lastIndex = s; // a whole-line match may hide inline pairs: Server=db;Password=x or ?a=1&token=x
    if (NOT_A_VALUE.test(value) || global.regexes.some(r => r.test(value))) continue;
    // code, not a value: token = getToken(), key = process.env.KEY, secret = os.environ["SECRET"]
    if (text[e] === '(' || DOTTED.test(value) || /^[A-Za-z_$][\w$.]*[[(]/.test(value)) continue;
    if (secretName(key)) {
      const pw = /PASS|PWD/i.test(key);
      if (enabled.has('passwords') && value.length >= 4 && (pw || !/^\d{1,8}$/.test(value))) {
        add(s, e, 'passwords', pw ? 'PASSWORD' : 'SECRET', 3, 'env-secret');
      }
    } else if (enabled.has('keys') && !ID_NAME.test(key) && highEntropy(value)) {
      add(s, e, 'keys', 'SECRET', 1, 'high-entropy');
    }
  }
}

// ---- scan ----

export function scan(text, enabled = CATEGORIES) {
  enabled = new Set(enabled);
  const cands = [];
  const add = (start, end, category, name, tier, rule) => {
    const q = text[start];
    if (end - start > 2 && (q === '"' || q === "'") && text[end - 1] === q) { start++; end--; } // keep quotes out of the mask
    while (start > 0 && isWord(text.charCodeAt(start - 1))) start--;
    while (end < text.length && isWord(text.charCodeAt(end))) end++;
    cands.push({ start, end, category, name, tier, rule });
  };

  const lower = text.toLowerCase();
  const lines = text.split('\n');
  const starts = new Array(lines.length);
  for (let i = 0, p = 0; i < lines.length; p += lines[i].length + 1, i++) starts[i] = p;

  scanRules(text, lower, lines, starts, enabled, add);
  scanAssignments(text, enabled, add);
  for (const d of EXTRAS) {
    if (!enabled.has(d.category)) continue;
    d.re.lastIndex = 0;
    for (let m; (m = d.re.exec(text));) {
      const g = d.group ?? 0;
      const v = m[g];
      if (!v || /^[A-Z0-9][A-Z0-9_]*_\d+$/.test(v)) continue; // already a placeholder
      const [s, e] = m.indices[g];
      if (d.ok && !d.ok(v, text, s)) continue;
      add(s, e, d.category, d.name(m), d.tier, d.category === 'keys' || d.category === 'passwords' ? d.name(m).toLowerCase() : d.category);
    }
  }

  // Overlaps: specific rules beat generic ones, then longer beats shorter.
  cands.sort((a, b) => b.tier - a.tier || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const taken = new Uint8Array(text.length);
  let accepted = [];
  for (const c of cands) {
    let free = true;
    for (let i = c.start; i < c.end; i++) if (taken[i]) { free = false; break; }
    if (!free) continue;
    taken.fill(1, c.start, c.end);
    accepted.push(c);
  }
  accepted.sort((a, b) => a.start - b.start);
  // Two masked spans that touch would put two placeholders side by side. Merge them into one.
  accepted = accepted.reduce((out, c) => {
    const prev = out.at(-1);
    if (prev && prev.end === c.start) { prev.end = c.end; if (c.tier > prev.tier) Object.assign(prev, { ...c, start: prev.start, end: prev.end }); }
    else out.push(c);
    return out;
  }, []);

  // Placeholders: stable per unique value, never one that already appears as a word in the input.
  const inText = new Set(text.match(PLACEHOLDER));
  const byValue = new Map(), counters = new Map(), map = [];
  const parts = [];
  let pos = 0;
  const findings = accepted.map(c => {
    const value = text.slice(c.start, c.end);
    let placeholder = byValue.get(value);
    if (!placeholder) {
      let n = counters.get(c.name) ?? 0;
      do placeholder = `${c.name}_${++n}`; while (inText.has(placeholder));
      counters.set(c.name, n);
      byValue.set(value, placeholder);
      map.push([placeholder, value]);
    }
    parts.push(text.slice(pos, c.start), placeholder);
    pos = c.end;
    return { start: c.start, end: c.end, category: c.category, rule: c.rule, placeholder };
  });
  parts.push(text.slice(pos));
  return { masked: parts.join(''), findings, map };
}

export function restore(text, map) {
  const m = map instanceof Map ? map : new Map(map);
  return text.replace(PLACEHOLDER, t => m.get(t) ?? t);
}
