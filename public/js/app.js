// Page logic. Text goes to the scan worker and back. Nothing is sent over the network or stored anywhere.
import makers from './makers.js';
import { mountAds } from './showcase.js';
import { sampleLog } from './sample.js';

const $ = id => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const plural = (n, one, many = one + 's') => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const ORDER = ['keys', 'privateKeys', 'passwords', 'email', 'ip', 'card', 'iban', 'phone'];
const TITLES = { keys: 'API keys and tokens', privateKeys: 'Private keys', passwords: 'Passwords and secrets', email: 'Emails', ip: 'IP addresses', card: 'Card numbers', iban: 'IBANs', phone: 'Phone numbers' };
const NOUNS = { keys: ['API key', 'API keys'], privateKeys: ['private key', 'private keys'], passwords: ['password or secret', 'passwords and secrets'], email: ['email', 'emails'], ip: ['IP address', 'IP addresses'], card: ['card number', 'card numbers'], iban: ['IBAN', 'IBANs'], phone: ['phone number', 'phone numbers'] };

// Above either limit the cleaned view is a plain read-only textarea: no per-token highlights, no animation.
const BIG_CHARS = 300 * 1024, BIG_LINES = 5000;
// Cleaning sequence timings in ms (styles.css motion tokens: fast 150, base 250, slow 400; exits about 65% of enters).
const SWEEP = 650, HOLD = 250, OUT = 110, IN = 250;
const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)', EASE_IN = 'cubic-bezier(.7, 0, .84, 0)';

const editor = $('editor'), input = $('input'), pre = $('cleaned'), status = $('status'), list = $('list');
const reply = $('reply'), restored = $('restored');

const lineCount = t => { let n = t ? 1 : 0; for (let p = t.indexOf('\n'); p !== -1; p = t.indexOf('\n', p + 1)) n++; return n; };
const isBig = t => t.length > BIG_CHARS || (t.length > BIG_LINES && lineCount(t) > BIG_LINES);
const fmtSize = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const bytes = t => (t.length > 1e6 ? t.length : new Blob([t]).size); // ponytail: char count above 1 MB, close enough for a status bar

// ---- views ----

function setView(view, focusTab) {
  editor.dataset.view = view;
  for (const name of ['cleaned', 'original']) {
    const tab = $('tab-' + name), on = name === view;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    $('panel-' + name).hidden = !on;
  }
  if (focusTab) $('tab-' + view).focus();
}
$('tab-cleaned').addEventListener('click', () => setView('cleaned'));
$('tab-original').addEventListener('click', () => setView('original'));
$('tab-cleaned').parentElement.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const next = e.key === 'Home' ? 'cleaned' : e.key === 'End' ? 'original' : editor.dataset.view === 'cleaned' ? 'original' : 'cleaned';
  setView(next, true);
});
$('wrap').addEventListener('click', e => e.currentTarget.setAttribute('aria-pressed', String(editor.classList.toggle('is-wrap'))));

// ---- scanning ----

let scanSeq = 0, restoreSeq = 0, sent = '', timer, animateNext = false;
let last = null; // { text, masked, findings, map, ms, counts }
let marks = []; // <mark> per finding while the cleaned view is a <pre>
const waiters = [];

const onResult = ({ data }) => {
  if (data.type === 'restore') {
    if (data.id === restoreSeq) restored.value = data.text;
    return;
  }
  if (data.id !== scanSeq) return; // the text changed since, a newer scan is on its way
  editor.classList.remove('is-busy');
  last = { text: sent, masked: data.masked, findings: data.findings, map: data.map, ms: data.ms };
  renderFindings();
  const play = animateNext && editor.classList.contains('is-cleaning');
  animateNext = false;
  if (play) playCleaning();
  else if (editor.classList.contains('is-cleaning')) finishCleaning(); // renders the end state
  else { renderCleaned(); settle(); }
  restoreReply();
  waiters.splice(0).forEach(fn => fn());
};

// Same messages as scan-worker.js, answered on this thread. Used only when a browser or sandbox refuses the worker.
function inPageScanner() {
  const detect = import('./detect.js');
  return {
    postMessage: msg => detect.then(({ scan, restore }) => {
      const t = performance.now();
      onResult({ data: msg.type === 'scan'
        ? { type: 'scan', id: msg.id, ...scan(msg.text, msg.enabled), ms: Math.round(performance.now() - t) }
        : { type: 'restore', id: msg.id, text: restore(msg.text, msg.map) } });
    }),
  };
}

let worker;
try {
  worker = new Worker(new URL('./scan-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = onResult;
  worker.onerror = () => { worker = inPageScanner(); scanNow(); };
} catch {
  worker = inPageScanner();
}
// The worker's own scripts (scan-worker.js, detect.js, rules.js) are part of loading the page. A no-op message
// is answered only once they have all loaded, and that is when the request monitor starts counting.
const workerReady = new Promise(ok => {
  setTimeout(ok, 5000); // ponytail: a refused worker falls back to the in-page scanner; just start counting then
  if (!worker.addEventListener) return ok();
  worker.addEventListener('message', e => { if (e.data.id === -1) ok(); });
  worker.postMessage({ type: 'restore', id: -1, text: '', map: [] });
});

function scanNow(animate = false) {
  clearTimeout(timer);
  scanSeq++;
  sent = input.value;
  animateNext = animate;
  const n = lineCount(sent);
  $('st-lines').textContent = plural(n, 'line');
  $('st-size').textContent = fmtSize(bytes(sent));
  if (!sent) {
    last = null;
    marks = [];
    pre.replaceChildren();
    editor.classList.remove('is-busy');
    editor.dataset.state = 'empty';
    setView('original');
    renderFindings();
    settle();
    restoreReply();
    waiters.splice(0).forEach(fn => fn());
    return;
  }
  editor.dataset.state = 'ready';
  if (isBig(sent)) {
    editor.classList.add('is-busy');
    status.textContent = `Scanning ${fmtSize(bytes(sent))}...`;
  }
  const enabled = [...document.querySelectorAll('#toggles input:checked')].map(i => i.value);
  worker.postMessage({ type: 'scan', id: scanSeq, text: sent, enabled });
}

// Replacing the whole text (paste into an empty or fully selected editor) plays the cleaning sequence; edits just rescan.
let pasteAll = false;
input.addEventListener('beforeinput', e => {
  pasteAll = e.inputType === 'insertFromPaste' && input.selectionStart === 0 && input.selectionEnd === input.value.length;
});
input.addEventListener('input', () => {
  if (pasteAll) { pasteAll = false; return ingest(input.value, 'paste.log'); }
  if (editor.dataset.state === 'empty' || !input.value) return scanNow();
  clearTimeout(timer);
  timer = setTimeout(scanNow, 200);
});
$('toggles').addEventListener('change', () => { finishCleaning(); scanNow(); });

// ---- text arriving: paste, drop, clipboard button, sample ----

function ingest(text, name) {
  const hadFocus = editor.contains(document.activeElement);
  finishCleaning();
  if (input.value !== text) input.value = text;
  $('file-name').textContent = name;
  $('empty-msg').textContent = '';
  if (!text) return scanNow();
  setView('cleaned');
  if (hadFocus) pre.focus({ preventScroll: true });
  startCleaning();
}

function startCleaning() {
  finishCleaning();
  const text = input.value;
  if (!text) return;
  const animate = !reduced.matches && !isBig(text);
  $('copy').disabled = $('again').disabled = $('clear').disabled = false; // the sequence never blocks the actions
  if (animate) {
    $('big').hidden = true;
    pre.hidden = false;
    pre.replaceChildren(text);
    pre.scrollTop = 0;
    marks = [];
    editor.classList.add('is-cleaning');
    sweep(Infinity); // keeps sweeping until the worker answers, usually a few ms
    document.addEventListener('keydown', skip, true);
    document.addEventListener('pointerdown', skip, true);
  }
  scanNow(animate);
}

let run = 0, timers = [], beamAnim = null;
const later = (ms, fn) => timers.push(setTimeout(fn, ms));
const skip = e => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) finishCleaning(); };

function sweep(iterations) {
  const beam = $('beam'), travel = pre.clientHeight + beam.offsetHeight;
  beamAnim?.cancel();
  beamAnim = beam.animate([
    { transform: 'translateY(0)', opacity: 0 },
    { opacity: 1, offset: 0.12 },
    { opacity: 1, offset: 0.88 },
    { transform: `translateY(${travel}px)`, opacity: 0 },
  ], { duration: SWEEP, iterations, easing: 'ease-in-out' });
}

// 1. raw text shows, 2. the beam sweeps, 3. each value flashes red as the beam reaches it and morphs into its placeholder,
// 4. the counter ticks up, 5. the editor settles on the cleaned view. Any key or click jumps to the end.
function playCleaning() {
  const id = ++run;
  buildPre(true);
  sweep(1);
  setMasked(0);
  const H = pre.clientHeight, tops = marks.map(m => m.offsetTop), seen = new Set();
  const tick = ph => { if (id === run && !seen.has(ph)) { seen.add(ph); setMasked(seen.size, true); } };
  const below = [];
  marks.forEach((m, i) => {
    const y = tops[i] - pre.scrollTop, ph = last.findings[i].placeholder;
    if (y >= H) return below.push(i);
    const at = Math.max(0, y) / H * SWEEP;
    later(at, () => { m.classList.add('is-found'); m.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 150, easing: EASE_OUT }); });
    later(at + HOLD, () => morph(m, ph, () => tick(ph)));
  });
  later(SWEEP + HOLD, () => below.forEach(i => { marks[i].textContent = last.findings[i].placeholder; marks[i].className = 'hit'; tick(last.findings[i].placeholder); }));
  later(SWEEP + HOLD + OUT + IN + 80, () => {
    finishCleaning();
    if (!reduced.matches) $('copy').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 400, easing: EASE_OUT });
  });
}

function morph(m, placeholder, done) {
  const out = m.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.85)' }], { duration: OUT, easing: EASE_IN, fill: 'forwards' });
  out.onfinish = () => {
    if (!m.isConnected) return;
    m.textContent = placeholder;
    m.className = 'hit';
    out.cancel();
    m.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.08)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], { duration: IN, easing: EASE_OUT });
    done();
  };
}

function finishCleaning() {
  if (!editor.classList.contains('is-cleaning')) return;
  run++;
  timers.forEach(clearTimeout);
  timers = [];
  beamAnim?.cancel();
  editor.classList.remove('is-cleaning');
  document.removeEventListener('keydown', skip, true);
  document.removeEventListener('pointerdown', skip, true);
  animateNext = false; // a result still on its way renders straight to the end state
  if (last && last.text === input.value) { renderCleaned(); settle(); }
}

// ---- rendering ----

// Text nodes and <mark> elements only: user text never goes through innerHTML.
function buildPre(raw) {
  const { text, findings } = last;
  const top = pre.scrollTop, frag = document.createDocumentFragment();
  marks = [];
  let pos = 0;
  for (const f of findings) {
    frag.append(text.slice(pos, f.start));
    const m = el('mark', { className: raw ? 'hit is-raw' : 'hit' }, raw ? text.slice(f.start, f.end) : f.placeholder);
    marks.push(m);
    frag.append(m);
    pos = f.end;
  }
  frag.append(text.slice(pos));
  pre.replaceChildren(frag);
  pre.scrollTop = raw ? 0 : top;
}

function renderCleaned() {
  const big = isBig(last.text);
  $('big').hidden = !big;
  pre.hidden = big;
  if (!big) return buildPre(false);
  marks = [];
  pre.replaceChildren();
  $('cleaned-big').value = last.masked;
  $('big-note').textContent = `Large paste (${fmtSize(bytes(last.text))}). Highlights and the animation are off above 300 KB or 5,000 lines. Findings select the value in the Original view.`;
}

function setMasked(n, bump) {
  const m = $('st-masked');
  m.textContent = `${n.toLocaleString('en')} masked`;
  if (bump && !reduced.matches) m.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 250, easing: EASE_OUT });
}

function settle() {
  const unique = last?.map.length ?? 0, n = last?.findings.length ?? 0;
  status.textContent = !last ? 'Paste something to start. Scanning starts as soon as text arrives.'
    : unique ? `Masked ${plural(unique, 'unique value')} (${plural(n, 'match', 'matches')}) in ${last.ms} ms. Review it, then copy.`
      : `Nothing found in ${last.ms} ms. Read it anyway before you paste.`;
  setMasked(unique);
  $('copy').disabled = $('again').disabled = $('clear').disabled = !last;
  $('make-card').disabled = !unique;
}

const preview = v => {
  const first = v.split('\n')[0];
  return first.length > 64 ? first.slice(0, 61) + '...' : first + (v.includes('\n') ? ' ...' : '');
};

function renderFindings() {
  const groups = new Map();
  (last?.findings ?? []).forEach((f, i) => {
    if (!groups.has(f.placeholder)) groups.set(f.placeholder, { ...f, hits: [] });
    groups.get(f.placeholder).hits.push(i);
  });
  const counts = Object.fromEntries(ORDER.map(c => [c, 0]));
  for (const g of groups.values()) counts[g.category]++;
  for (const span of document.querySelectorAll('[data-count]')) {
    span.textContent = last ? String(counts[span.dataset.count]) : '';
    span.classList.toggle('is-zero', !counts[span.dataset.count]);
  }
  const values = new Map(last?.map);

  list.replaceChildren();
  for (const c of ORDER) {
    const rows = [...groups.values()].filter(g => g.category === c);
    if (!rows.length) continue;
    const ul = el('ul');
    for (const g of rows.slice(0, 200)) {
      let k = -1;
      const btn = el('button', { type: 'button', className: 'row', title: `Show it in the text (${g.rule})` },
        el('code', {}, g.placeholder),
        el('span', { className: 'val' }, preview(values.get(g.placeholder))),
        el('span', { className: 'n' }, g.hits.length > 1 ? `${g.hits.length}x` : ''));
      btn.addEventListener('click', () => jump(g.hits[k = (k + 1) % g.hits.length]));
      ul.append(el('li', {}, btn));
    }
    if (rows.length > 200) ul.append(el('li', { className: 'empty' }, `and ${rows.length - 200} more`));
    list.append(el('h4', {}, el('span', {}, TITLES[c]), el('span', {}, String(rows.length))), ul);
  }
  $('list-empty').hidden = groups.size > 0;
  $('findings-total').hidden = !groups.size;
  $('findings-total').textContent = String(groups.size);
  if (last) last.counts = counts;
}

// Cleaned view: scroll to the placeholder and flash it. Large pastes: select the value in the Original textarea.
function jump(i) {
  finishCleaning();
  if (!last || input.value !== last.text) return scanNow();
  const m = marks[i];
  if (m?.isConnected) {
    setView('cleaned');
    pre.scrollTop = m.offsetTop - pre.clientHeight / 3;
    editor.scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' });
    m.classList.add('is-flash');
    if (!reduced.matches) m.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 450, easing: EASE_OUT });
    setTimeout(() => m.classList.remove('is-flash'), 1600);
    return;
  }
  const f = last.findings[i];
  setView('original');
  input.focus();
  input.setSelectionRange(f.start, f.start);
  input.blur(); // blur and refocus makes browsers scroll the textarea to the selection
  input.focus();
  input.setSelectionRange(f.start, f.end);
}

// ---- inputs: clipboard button, sample, paste anywhere, drop a file ----

const mod = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform ?? navigator.platform) ? 'Cmd' : 'Ctrl';
document.querySelector('.kbd-mod').textContent = mod;

$('paste-btn').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) ingest(text, 'clipboard.log');
    else $('empty-msg').textContent = 'The clipboard has no text right now. Copy a log first, then try again.';
  } catch {
    $('empty-msg').textContent = `This browser did not allow reading the clipboard. Click the editor and press ${mod}+V instead.`;
    input.focus();
  }
});
for (const b of document.querySelectorAll('[data-action="sample"]')) b.addEventListener('click', () => ingest(sampleLog(), 'sample.log'));

document.addEventListener('paste', e => {
  if (e.target.closest?.('textarea, input, [contenteditable]')) return;
  const text = e.clipboardData?.getData('text/plain');
  if (!text) return;
  e.preventDefault();
  ingest(text, 'paste.log');
  editor.scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' });
});

// File.text() reads the dropped file on this device. It is not a network request.
let dragDepth = 0;
const draggable = e => [...(e.dataTransfer?.types ?? [])].some(t => t === 'Files' || t === 'text/plain');
const dragOff = () => { dragDepth = 0; editor.classList.remove('is-dragging'); };
document.addEventListener('dragenter', e => { if (draggable(e)) { dragDepth++; editor.classList.add('is-dragging'); } });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) dragOff(); });
document.addEventListener('dragover', e => { if (draggable(e)) e.preventDefault(); });
document.addEventListener('drop', async e => {
  dragOff();
  if (e.target.closest?.('#reply')) return; // dropping into the reply box inserts text as usual
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) ingest(await file.text(), file.name);
  else if (e.dataTransfer.getData('text/plain')) ingest(e.dataTransfer.getData('text/plain'), 'paste.log');
});

$('again').addEventListener('click', () => { setView('cleaned'); startCleaning(); });

// Clear keeps the text in memory only while the Undo toast is up.
let undo = null, toastTimer;
const hideToast = () => { $('toast').hidden = true; undo = null; };
$('clear').addEventListener('click', () => {
  undo = { text: input.value, name: $('file-name').textContent };
  finishCleaning();
  input.value = '';
  $('file-name').textContent = 'paste.log';
  $('card-out').hidden = true;
  scanNow();
  input.focus();
  $('toast-text').textContent = 'Editor cleared.';
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 8000);
});
$('undo').addEventListener('click', () => {
  if (!undo) return;
  input.value = undo.text;
  $('file-name').textContent = undo.name;
  clearTimeout(toastTimer);
  hideToast();
  setView('cleaned');
  scanNow();
  pre.focus({ preventScroll: true });
});

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
  note.textContent = `Swapping ${plural(last.map.length, 'placeholder')} back, in this tab.`;
  worker.postMessage({ type: 'restore', id: restoreSeq, text: reply.value, map: last.map });
}
reply.addEventListener('input', restoreReply);

// ---- copy buttons ----

async function writeClipboard(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = el('textarea', { value: text });
    document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
}
function copied(btn, message) {
  btn.classList.add('is-copied'); // swaps icon and label in CSS
  clearTimeout(btn.copyTimer);
  btn.copyTimer = setTimeout(() => btn.classList.remove('is-copied'), 2000);
  const live = $('announce');
  live.textContent = '';
  setTimeout(() => { live.textContent = message; }, 50);
}

$('copy').addEventListener('click', async () => {
  finishCleaning();
  if (!input.value) return;
  // Never copy a stale result: text typed in the last 200 ms would not be masked yet.
  if (!last || last.text !== input.value) await new Promise(ok => { waiters.push(ok); scanNow(); });
  if (!last) return;
  await writeClipboard(last.masked);
  copied($('copy'), 'Cleaned text copied.');
});
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-copy]');
  if (btn && $(btn.dataset.copy).value) writeClipboard($(btn.dataset.copy).value).then(() => copied(btn, 'Copied.'));
});
$('copy-link').addEventListener('click', e => { const b = e.currentTarget; writeClipboard(location.origin + '/').then(() => copied(b, 'Link copied.')); });

// ---- share image: counts only, never content ----

const joinList = parts => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);
const SANS = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace';
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
$('make-card').addEventListener('click', async () => {
  if (!last?.counts) return;
  const parts = ORDER.filter(c => last.counts[c]).map(c => `${last.counts[c]} ${NOUNS[c][last.counts[c] === 1 ? 0 : 1]}`);
  // The faces are already on the page, so this resolves from memory; it just makes sure the canvas never draws a fallback.
  await Promise.all([`600 34px ${SANS}`, `700 64px ${SANS}`, `600 26px ${MONO}`].map(f => document.fonts.load(f))).catch(() => {});
  // The canvas itself is the preview: an <img src="blob:..."> would show up as a request in DevTools.
  const W = 1200, H = 627, canvas = el('canvas', { width: W, height: H });
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Share image: scanned before pasting into AI, ${joinList(parts)}. 0 bytes uploaded.`);
  const g = canvas.getContext('2d');
  g.fillStyle = '#0B1120';
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(240, 0, 0, 240, 0, 700);
  glow.addColorStop(0, 'rgba(34, 197, 94, .16)');
  glow.addColorStop(1, 'rgba(34, 197, 94, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  // editor window
  g.fillStyle = '#0F172A';
  g.strokeStyle = '#334155';
  g.lineWidth = 2;
  g.beginPath(); g.roundRect(56, 48, W - 112, 460, 20); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.roundRect(56, 48, W - 112, 460, 20); g.clip();
  g.fillStyle = '#1E293B';
  g.fillRect(56, 48, W - 112, 60);
  g.restore();
  g.fillStyle = '#475569';
  [88, 112, 136].forEach(x => { g.beginPath(); g.arc(x, 78, 7, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = '#94A3B8';
  g.font = `500 22px ${MONO}`;
  g.fillText('scan-report.txt', 166, 86);

  g.font = `600 34px ${SANS}`;
  g.fillText('Scanned before pasting into AI:', 96, 172);
  let size = 64, lines;
  for (; size >= 36; size -= 4) { g.font = `700 ${size}px ${SANS}`; lines = wrap(g, parts.map(p => p.replaceAll(' ', ' ')).join(', ') + '.', 1000); if (lines.length <= 3) break; } // keep "1 card number" on one line
  g.fillStyle = '#F8FAFC';
  lines.forEach((line, i) => g.fillText(line, 96, 172 + (size + 16) * (i + 1)));

  const chipY = Math.min(172 + (size + 16) * lines.length + 40, 430);
  g.font = `600 26px ${MONO}`;
  const chipText = '0 bytes uploaded', chipW = g.measureText(chipText).width + 40;
  g.fillStyle = '#22C55E';
  g.beginPath(); g.roundRect(96, chipY, chipW, 50, 10); g.fill();
  g.fillStyle = '#0B1120';
  g.fillText(chipText, 116, chipY + 34);

  // footer
  g.fillStyle = '#22C55E';
  g.beginPath(); g.roundRect(56, 548, 36, 36, 9); g.fill();
  g.fillStyle = '#0B1120';
  [[64, 556, 20], [64, 564, 8], [64, 572, 14]].forEach(([x, y, w]) => g.fillRect(x, y, w, 4));
  g.fillStyle = '#F8FAFC';
  g.font = `700 30px ${SANS}`;
  g.fillText('PasteSafe', 108, 577);
  g.fillStyle = '#94A3B8';
  g.font = `500 24px ${MONO}`;
  g.textAlign = 'right';
  g.fillText(location.host || 'Clean it before you paste it.', W - 56, 576);

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

// ---- empty state prompt ----

const PHRASES = ['Paste your log or config', 'Paste a stack trace', 'Paste a .env file', 'Drop a file here'];
if (!reduced.matches) {
  const out = $('typer');
  let p = 0, i = PHRASES[0].length, deleting = true;
  const step = () => {
    let wait = 60;
    if (editor.dataset.state !== 'empty' || document.hidden || reduced.matches) wait = 500;
    else if (deleting) {
      out.textContent = PHRASES[p].slice(0, --i);
      if (i === 0) { deleting = false; p = (p + 1) % PHRASES.length; wait = 300; } else wait = 25;
    } else {
      out.textContent = PHRASES[p].slice(0, ++i);
      if (i === PHRASES[p].length) { deleting = true; wait = 1800; }
    }
    setTimeout(step, wait);
  };
  setTimeout(step, 2400);
}

// ---- live privacy monitor: proof instead of claims ----

// Every request this page makes once it has fully loaded (fonts and ad logos included) shows up here.
const requests = [];
function renderNet() {
  const n = requests.length;
  $('net-count').textContent = String(n);
  $('check-net').dataset.state = n ? 'bad' : 'ok';
  $('net-list').hidden = !n;
  $('net-list').replaceChildren(...requests.map(u => el('li', {}, u)));
  $('st-net').classList.toggle('is-bad', n > 0);
  $('st-net').lastElementChild.textContent = plural(n, 'request');
}
const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(ok => addEventListener('load', ok, { once: true }));
Promise.all([loaded.then(() => document.fonts.ready), workerReady]).then(() => {
  const t0 = performance.now();
  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) if (e.startTime >= t0) requests.push(e.name);
      renderNet();
    }).observe({ type: 'resource' });
  } catch { $('st-net').lastElementChild.textContent = 'requests not measurable here'; }
});

function renderConnection() {
  const on = navigator.onLine;
  $('check-conn').dataset.state = on ? 'online' : 'offline';
  $('conn-text').textContent = on ? 'Online. Turn off Wi-Fi and paste again: it keeps working.' : 'Offline. Still cleaning.';
  const st = $('st-conn');
  st.classList.toggle('is-offline', !on);
  st.querySelector('use').setAttribute('href', on ? '#i-wifi' : '#i-plane');
  st.lastElementChild.textContent = on ? 'Online' : 'Offline, still cleaning';
}
addEventListener('online', renderConnection);
addEventListener('offline', renderConnection);
renderConnection();

if ('serviceWorker' in navigator) {
  const sw = navigator.serviceWorker;
  const renderOfflineCopy = () => {
    const ready = Boolean(sw.controller);
    $('sw-state').dataset.ready = String(ready);
    $('sw-text').textContent = ready ? 'Saved for offline use.' : 'Offline copy not ready yet.';
  };
  sw.register('sw.js').catch(() => {});
  sw.ready.then(renderOfflineCopy);
  sw.addEventListener('controllerchange', renderOfflineCopy);
} else {
  $('sw-text').textContent = 'This browser cannot keep an offline copy.';
}


// ---- ads: our own apps, plain links ----

mountAds($('showcase'), makers);
