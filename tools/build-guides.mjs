// Builds public/guides/ and public/sitemap.xml from tools/guides-data.mjs. Run: npm run guides
// The before/after examples are produced by the real scan() from public/js/detect.js, and the build throws
// if a value a guide says is masked (hides) or not masked (keeps) behaves differently.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '../public/js/detect.js';
import { SITE, UPDATED, INDEX, GUIDES } from './guides-data.mjs';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const plain = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const ld = obj => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')}\n</script>`;
const ORG = { '@type': 'Organization', name: 'vibe-coding.fans', url: 'https://vibe-coding.fans/' };
const url = path => SITE + path;

function example(g) {
  const { before, hides = [], keeps = [] } = g.example;
  const { masked, findings } = scan(before);
  for (const v of hides) if (masked.includes(v)) throw new Error(`${g.slug}: expected PasteSafe to mask ${v}`);
  for (const v of keeps) if (!masked.includes(v)) throw new Error(`${g.slug}: expected PasteSafe to leave ${v}`);
  let a = '', b = '', pos = 0;
  for (const f of findings) {
    a += esc(before.slice(pos, f.start)) + `<mark class="leak">${esc(before.slice(f.start, f.end))}</mark>`;
    b += esc(before.slice(pos, f.start)) + `<mark class="hit">${f.placeholder}</mark>`;
    pos = f.end;
  }
  a += esc(before.slice(pos));
  b += esc(before.slice(pos));
  return `<div class="ba">
<figure><figcaption>Before</figcaption><pre class="code" tabindex="0"><code>${a}</code></pre></figure>
<figure><figcaption>After PasteSafe</figcaption><pre class="code" tabindex="0"><code>${b}</code></pre></figure>
</div>`;
}

const LOGO = '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect class="logo-bg" width="32" height="32" rx="8"/><rect class="logo-line" x="7" y="8" width="18" height="3" rx="1.5"/><rect class="logo-line" x="7" y="14.5" width="7" height="3" rx="1.5"/><rect class="logo-ph" x="16" y="13.5" width="9" height="5" rx="1.5"/><rect class="logo-line" x="7" y="21" width="12" height="3" rx="1.5"/></svg>';

function page({ path, title, description, h1, lead, crumbs, jsonld, main }) {
  const ogTitle = title.replace(/ \| PasteSafe$/, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#F8FAFC" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B1120" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/ibm-plex-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/jetbrains-mono-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/guides/guides.css">
<link rel="canonical" href="${url(path)}">
<meta property="og:url" content="${url(path)}">
<meta property="og:type" content="${path === '/guides/' ? 'website' : 'article'}">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="PasteSafe">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="PasteSafe: clean it before you paste it. A log line with its API key replaced by a placeholder.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/og.png">
${jsonld.map(ld).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<div class="page g-page">
  <header class="top">
    <a class="brand" href="/">${LOGO}PasteSafe</a>
    <nav class="nav" aria-label="Site">
      <a href="/guides/">Guides</a>
      <a href="/">Open the tool</a>
    </nav>
  </header>
  <nav class="crumbs" aria-label="Breadcrumb">
    <ol>
${crumbs.map(([name, href], i) => i === crumbs.length - 1
    ? `      <li aria-current="page">${esc(name)}</li>`
    : `      <li><a href="${href}">${esc(name)}</a></li>`).join('\n')}
    </ol>
  </nav>
  <main id="main">
    <div class="g-head">
      <h1>${esc(h1)}</h1>
      <p class="g-lead">${lead}</p>
      <p class="g-cta"><a class="btn btn-primary btn-lg" href="/">Mask your log in PasteSafe</a></p>
    </div>
${main}
    <section class="team" aria-labelledby="try-title">
      <div>
        <h2 id="try-title">Clean it before you paste it</h2>
        <p>PasteSafe masks API keys, passwords and personal data in your browser. Nothing is uploaded.</p>
      </div>
      <a class="btn btn-primary" href="/">Mask your log in PasteSafe</a>
    </section>
  </main>

  <footer class="foot">
    <a class="vcf-home" href="https://vibe-coding.fans/"><svg viewBox="0 0 66 66" width="30" height="30" aria-hidden="true"><rect x="6" y="6" width="58" height="58" rx="16" fill="#0B0B0F"/><rect x="2" y="2" width="54" height="54" rx="14" fill="#FF4FA3" stroke="#0B0B0F" stroke-width="4"/><path d="M26 18 13 29l13 11M33 18h7.5a5.5 5.5 0 0 1 0 11H36m4.5 0a5.5 5.5 0 0 1 0 11H33" fill="none" stroke="#0B0B0F" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>More free apps on <b>vibe-coding.fans</b></span></a>
    <p><a href="https://github.com/qxZap/pastesafe">Source on GitHub</a>, MIT License.</p>
  </footer>
</div>
</body>
</html>
`;
}

const breadcrumb = crumbs => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: crumbs.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url(href) })),
});
const guideLink = g => `      <li><a href="/guides/${g.slug}/"><b>${esc(g.h1)}</b><span>${esc(g.description)}</span></a></li>`;
const bySlug = slug => GUIDES.find(g => g.slug === slug) ?? (() => { throw new Error(`unknown related guide ${slug}`); })();

function guidePage(g) {
  const path = `/guides/${g.slug}/`;
  const crumbs = [['PasteSafe', '/'], ['Guides', '/guides/'], [g.h1, path]];
  if (!g.body.includes('%EXAMPLE%')) throw new Error(`${g.slug}: body needs %EXAMPLE%`);
  const main = `    <article class="g-body">
${g.body.replace('%EXAMPLE%', example(g))}
    <section class="g-faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Questions</h2>
${g.faq.map(([q, a]) => `      <h3>${esc(q)}</h3>\n      <p>${a}</p>`).join('\n')}
    </section>
    </article>
    <section class="g-related" aria-labelledby="related-title">
      <h2 id="related-title">Related guides</h2>
      <ul class="g-list">
${g.related.map(s => guideLink(bySlug(s))).join('\n')}
      </ul>
    </section>`;
  return page({
    path, title: g.title, description: g.description, h1: g.h1, lead: g.lead, crumbs, main,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'TechArticle', headline: g.h1, description: g.description,
        url: url(path), mainEntityOfPage: url(path), image: `${SITE}/og.png`, inLanguage: 'en',
        datePublished: UPDATED, dateModified: UPDATED, author: ORG, publisher: ORG,
        isPartOf: { '@type': 'WebSite', name: 'PasteSafe', url: `${SITE}/` },
      },
      breadcrumb(crumbs),
      {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plain(a) } })),
      },
    ],
  });
}

function indexPage() {
  const crumbs = [['PasteSafe', '/'], ['Guides', '/guides/']];
  const main = `    <section class="g-related" aria-labelledby="all-title">
      <h2 id="all-title" class="visually-hidden">All guides</h2>
      <ul class="g-list">
${GUIDES.map(guideLink).join('\n')}
      </ul>
    </section>`;
  return page({
    path: '/guides/', title: INDEX.title, description: INDEX.description, h1: INDEX.h1, lead: INDEX.lead, crumbs, main,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'CollectionPage', name: INDEX.h1, description: INDEX.description,
        url: url('/guides/'), inLanguage: 'en', publisher: ORG,
        hasPart: GUIDES.map(g => ({ '@type': 'TechArticle', headline: g.h1, url: url(`/guides/${g.slug}/`) })),
      },
      breadcrumb(crumbs),
    ],
  });
}

// Every generated file, keyed by its path under public/.
export function build() {
  const out = new Map();
  out.set('guides/index.html', indexPage());
  for (const g of GUIDES) out.set(`guides/${g.slug}/index.html`, guidePage(g));
  const locs = ['/', '/guides/', ...GUIDES.map(g => `/guides/${g.slug}/`)];
  out.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map(l => `  <url><loc>${url(l)}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n')}
</urlset>
`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../public/', import.meta.url));
  for (const [rel, content] of build()) {
    mkdirSync(dirname(root + rel), { recursive: true });
    writeFileSync(root + rel, content);
  }
  for (const g of GUIDES) console.log(`${g.slug}: ${plain(g.lead + g.body + g.faq.flat().join(' ')).split(' ').length} words`);
}
