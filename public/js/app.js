// Page logic. Text goes to the scan worker and back. Nothing is sent over the network or stored anywhere.
import ads from './ads.js';
import { sampleLog } from './sample.js';

const $ = id => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

const ORDER = ['keys', 'privateKeys', 'passwords', 'email', 'ip', 'card', 'iban', 'phone'];
const TITLES = { keys: 'API keys and tokens', privateKeys: 'Private keys', passwords: 'Passwords and secrets', email: 'Emails', ip: 'IP addresses', card: 'Card numbers', iban: 'IBANs', phone: 'Phone numbers' };
const NOUNS = { keys: ['API key', 'API keys'], privateKeys: ['private key', 'private keys'], passwords: ['password or secret', 'passwords and secrets'], email: ['email', 'emails'], ip: ['IP address', 'IP addresses'], card: ['card number', 'card numbers'], iban: ['IBAN', 'IBANs'], phone: ['phone number', 'phone numbers'] };

const input = $('input'), output = $('output'), status = $('status'), list = $('list');
const reply = $('reply'), restored = $('restored');

// ---- scanning ----

const worker = new Worker('/js/scan-worker.js', { type: 'module' });
let scanSeq = 0, restoreSeq = 0, sent = '', timer;
let last = null; // { text, findings, map: [[placeholder, value]], counts }

worker.onmessage = ({ data }) => {
  if (data.type === 'restore') {
    if (data.id === restoreSeq) restored.value = data.text;
    return;
  }
  if (data.id !== scanSeq) return; // the text changed since, a newer scan is on its way
  last = { text: sent, findings: data.findings, map: data.map };
  output.value = data.masked;
  render(data.ms);
  restoreReply();
};
worker.onerror = () => { status.textContent = 'The scanner could not start. Reload the page to try again.'; };

function scanNow() {
  clearTimeout(timer);
  scanSeq++;
  sent = input.value;
  if (!sent) { last = null; output.value = ''; render(); restoreReply(); return; }
  status.textContent = sent.length > 262144 ? `Scanning ${(sent.length / 1048576).toFixed(1)} MB...` : 'Scanning...';
  const enabled = [...document.querySelectorAll('#toggles input:checked')].map(i => i.value);
  worker.postMessage({ type: 'scan', id: scanSeq, text: sent, enabled });
}

input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(scanNow, 200); });
$('toggles').addEventListener('change', scanNow);
$('sample').addEventListener('click', () => { input.value = sampleLog(); scanNow(); });
$('clear').addEventListener('click', () => {
  input.value = reply.value = '';
  $('card-out').hidden = true;
  scanNow();
  input.focus();
});

const preview = v => {
  const first = v.split('\n')[0];
  return first.length > 64 ? first.slice(0, 61) + '...' : first + (v.includes('\n') ? ' ...' : '');
};

function render(ms) {
  const groups = new Map();
  for (const f of last?.findings ?? []) {
    if (!groups.has(f.placeholder)) groups.set(f.placeholder, { ...f, hits: [] });
    groups.get(f.placeholder).hits.push(f);
  }
  const counts = Object.fromEntries(ORDER.map(c => [c, 0]));
  for (const g of groups.values()) counts[g.category]++;
  for (const span of document.querySelectorAll('[data-count]')) span.textContent = last ? String(counts[span.dataset.count]) : '';
  const values = new Map(last?.map);

  list.replaceChildren();
  for (const c of ORDER) {
    const rows = [...groups.values()].filter(g => g.category === c);
    if (!rows.length) continue;
    const ul = el('ul');
    for (const g of rows.slice(0, 200)) {
      let i = -1;
      const btn = el('button', { type: 'button', className: 'hit', title: `Select it in your text (${g.rule})` },
        el('code', {}, g.placeholder),
        el('span', { className: 'val' }, preview(values.get(g.placeholder))),
        el('span', { className: 'n' }, g.hits.length > 1 ? `${g.hits.length}x` : ''));
      btn.addEventListener('click', () => jump(g.hits[i = (i + 1) % g.hits.length]));
      ul.append(el('li', {}, btn));
    }
    if (rows.length > 200) ul.append(el('li', { className: 'empty' }, `and ${rows.length - 200} more`));
    list.append(el('h3', {}, `${TITLES[c]} (${rows.length})`), ul);
  }

  const unique = groups.size, n = last?.findings.length ?? 0;
  status.textContent = !last ? 'Paste text or try the sample. Scanning starts as you type.'
    : unique ? `Masked ${unique} unique ${unique === 1 ? 'value' : 'values'} (${n} ${n === 1 ? 'match' : 'matches'}) in ${ms} ms, without leaving this tab.`
      : `Nothing found in ${ms} ms. Read it anyway before you paste.`;
  $('list-empty').hidden = unique > 0;
  $('make-card').disabled = !unique;
  if (last) last.counts = counts;
}

// Select the match in the input. Blur and refocus makes browsers scroll the textarea to the selection.
function jump(f) {
  if (input.value !== last.text) return scanNow();
  input.focus();
  input.setSelectionRange(f.start, f.start);
  input.blur();
  input.focus();
  input.setSelectionRange(f.start, f.end);
}

// ---- restore ----

function restoreReply() {
  restoreSeq++;
  const note = $('restore-note');
  if (!reply.value) { restored.value = ''; note.textContent = ''; return; }
  if (!last?.map.length) {
    restored.value = reply.value;
    note.textContent = 'No placeholders to swap yet. Clean some text above first.';
    return;
  }
  note.textContent = `Swapping ${last.map.length} ${last.map.length === 1 ? 'placeholder' : 'placeholders'} back, in this tab only.`;
  worker.postMessage({ type: 'restore', id: restoreSeq, text: reply.value, map: last.map });
}
reply.addEventListener('input', restoreReply);

// ---- copy buttons ----

async function copy(text, btn) {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = el('textarea', { value: text });
    document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
  const label = btn.textContent;
  btn.textContent = 'Copied';
  setTimeout(() => { btn.textContent = label; }, 1500);
}
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-copy]');
  if (btn) copy($(btn.dataset.copy).value, btn);
});
$('copy-link').addEventListener('click', e => copy(location.origin + '/', e.currentTarget));

// ---- share image: counts only, never content ----

const joinList = parts => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);
const font = (weight, size) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
function wrap(ctx, text, max) {
  const lines = [];
  for (const word of text.split(' ')) {
    const tryLine = lines.length ? `${lines.at(-1)} ${word}` : word;
    if (lines.length && ctx.measureText(tryLine).width <= max) lines[lines.length - 1] = tryLine;
    else lines.push(word);
  }
  return lines;
}

let cardUrl;
$('make-card').addEventListener('click', () => {
  if (!last?.counts) return;
  const parts = ORDER.filter(c => last.counts[c]).map(c => `${last.counts[c]} ${NOUNS[c][last.counts[c] === 1 ? 0 : 1]}`);
  // The canvas itself is the preview: an <img src="blob:..."> would show up as a request in DevTools.
  const canvas = el('canvas', { width: 1200, height: 627 });
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Share image: scanned before pasting into AI, ${joinList(parts)}. 0 bytes uploaded.`);
  const g = canvas.getContext('2d');
  g.fillStyle = '#0c1210';
  g.fillRect(0, 0, 1200, 627);
  g.fillStyle = '#4cc790';
  g.fillRect(80, 78, 64, 8);
  g.fillStyle = '#a1aea7';
  g.font = font(600, 36);
  g.fillText('Scanned before pasting into AI:', 80, 150);

  let size = 72, lines;
  for (; size >= 36; size -= 4) { g.font = font(700, size); lines = wrap(g, parts.map(p => p.replaceAll(' ', '\u00a0')).join(', ') + '.', 1040); if (lines.length <= 3) break; } // keep "1 card number" on one line
  g.fillStyle = '#f1f5f3';
  lines.forEach((line, i) => g.fillText(line, 80, 150 + (size + 18) * (i + 1)));
  g.fillStyle = '#4cc790';
  g.font = font(700, 48);
  g.fillText('0 bytes uploaded.', 80, 150 + (size + 18) * lines.length + 86);

  g.fillStyle = '#26312c';
  g.fillRect(80, 520, 1040, 2);
  g.fillStyle = '#e4ebe7';
  g.font = font(700, 32);
  g.fillText('PasteSafe', 80, 575);
  g.fillStyle = '#a1aea7';
  g.font = font(500, 28);
  g.textAlign = 'right';
  g.fillText(location.host || 'Clean it before you paste it.', 1120, 575);

  canvas.toBlob(blob => {
    if (cardUrl) URL.revokeObjectURL(cardUrl);
    cardUrl = URL.createObjectURL(blob);
    $('card-preview').replaceChildren(canvas);
    $('download').href = cardUrl;
    $('linkedin').value = `Before pasting a log into an AI assistant today, I ran it through PasteSafe first. It caught ${joinList(parts)}.\n\nEverything ran in my browser. 0 bytes uploaded.\n\nClean it before you paste it. Link in the first comment.`;
    $('share-tip').textContent = `Tip: upload the image natively, and put the link ${location.origin}/ in the first comment.`;
    $('card-out').hidden = false;
  }, 'image/png');
});

// ---- house ads and offline support ----

$('ads').replaceChildren(...ads.map(ad => el('li', {}, el('a', { href: ad.url }, el('strong', {}, ad.title), el('span', {}, ad.line)))));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
