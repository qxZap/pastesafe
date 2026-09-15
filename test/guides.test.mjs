// Guide pages: committed files match the generator, SEO basics, FAQ JSON-LD, no scripts or inline styles, links resolve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build, plain } from '../tools/build-guides.mjs';
import { GUIDES, SITE } from '../tools/guides-data.mjs';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const built = build();
const pages = [...built.keys()].filter(p => p.endsWith('.html'));

test('committed guide files and sitemap match the generator (run: npm run guides)', () => {
  for (const [rel, content] of built) assert.equal(readFileSync(root + rel, 'utf8'), content, rel);
});

test('slugs are unique and related guides exist', () => {
  const slugs = GUIDES.map(g => g.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(slugs.length >= 8 && slugs.length <= 12);
  for (const g of GUIDES) for (const r of g.related) assert.ok(slugs.includes(r) && r !== g.slug, `${g.slug} -> ${r}`);
});

test('title, description, one h1, canonical', () => {
  for (const p of pages) {
    const html = built.get(p);
    const title = /<title>(.*?)<\/title>/.exec(html)[1];
    const desc = /<meta name="description" content="(.*?)">/.exec(html)[1];
    assert.ok(title.length >= 50 && title.length <= 60 && title.endsWith('| PasteSafe'), `${p} title ${title.length}: ${title}`);
    assert.ok(desc.length >= 140 && desc.length <= 155, `${p} description ${desc.length}`);
    assert.equal(html.match(/<h1[\s>]/g).length, 1, p);
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/${p.replace(/index\.html$/, '')}">`), p);
  }
});

test('FAQPage JSON-LD matches the visible FAQ, with TechArticle and BreadcrumbList', () => {
  for (const p of pages.filter(p => p !== 'guides/index.html')) {
    const html = built.get(p);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    assert.deepEqual(blocks.map(b => b['@type']).sort(), ['BreadcrumbList', 'FAQPage', 'TechArticle'], p);
    const section = /<section class="g-faq"[\s\S]*?<\/section>/.exec(html)[0];
    const visible = [...section.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map(m => [plain(m[1]), plain(m[2])]);
    assert.ok(visible.length >= 3 && visible.length <= 4, p);
    assert.deepEqual(blocks.find(b => b['@type'] === 'FAQPage').mainEntity.map(q => [q.name, q.acceptedAnswer.text]), visible, p);
  }
});

test('no scripts other than JSON-LD, no inline styles', () => {
  for (const p of pages) {
    const html = built.get(p);
    for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) assert.equal(tag, '<script type="application/ld+json">', p);
    assert.doesNotMatch(html, /\sstyle=|<style|\son[a-z]+=/i, p);
  }
});

test('every internal link and asset resolves to a file in public/', () => {
  for (const p of pages) {
    for (const [, ref] of built.get(p).matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|#)/.test(ref)) continue;
      assert.match(ref, /^\//, `${p}: use root-relative links, got ${ref}`);
      const file = ref.replace(/#.*$/, '').replace(/\/$/, '/index.html').slice(1);
      assert.ok(existsSync(root + file), `${p}: ${ref}`);
    }
  }
});

test('home page links to the guides, llms.txt lists every guide', () => {
  assert.match(readFileSync(root + 'index.html', 'utf8'), /href="guides\/"/);
  const llms = readFileSync(root + 'llms.txt', 'utf8');
  for (const path of ['/guides/', ...GUIDES.map(g => `/guides/${g.slug}/`)]) assert.ok(llms.includes(`(${SITE}${path})`), path);
});
