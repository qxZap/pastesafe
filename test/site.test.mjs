// Static site checks: the service worker precaches exactly the files we ship, and the copy has no long dashes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const files = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter(d => d.isFile())
  .map(d => (d.parentPath + '/' + d.name).slice(root.length).replace(/\\/g, '/').replace(/^\/+/, ''));

test('sw.js precache list matches the files in public/', () => {
  const sw = readFileSync(root + 'sw.js', 'utf8');
  const list = JSON.parse(/const FILES = (\[[\s\S]*?\]);/.exec(sw)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  const expected = files.filter(f => f !== '_headers' && f !== 'sw.js').map(f => '/' + f.replace(/(^|\/)index\.html$/, '$1')).sort();
  assert.deepEqual([...list].sort(), expected);
});

test('JSON-LD parses and the FAQPage matches the visible FAQ word for word', () => {
  const html = readFileSync(root + 'index.html', 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const faq = blocks.find(b => b['@type'] === 'FAQPage');
  const text = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const section = /<section[^>]*id="faq"[\s\S]*?<\/section>/.exec(html)[0];
  const visible = [...section.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map(m => [text(m[1]), text(m[2])]);
  assert.ok(visible.length >= 6);
  assert.deepEqual(faq.mainEntity.map(q => [q.name, q.acceptedAnswer.text]), visible);
});

test('no em dashes or en dashes in public/ or README.md', () => {
  const paths = [...files.map(f => root + f), fileURLToPath(new URL('../README.md', import.meta.url))];
  for (const p of paths.filter(p => !/\.png$/.test(p))) {
    const lines = readFileSync(p, 'utf8').split('\n');
    lines.forEach((line, i) => assert.doesNotMatch(line, /[–—]/, `${p}:${i + 1}`));
  }
});
