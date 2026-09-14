# PasteSafe

**Clean your logs before you paste them into AI. Nothing leaves your browser.**

PasteSafe is a free, static, single-page tool. Paste a log, stack trace, `.env` file, config, JSON, SQL dump or support ticket. It masks secrets and personal data with stable placeholders, so the text can go into ChatGPT, Claude, a GitHub issue, Jira or Slack. When the AI answers, paste the reply back and PasteSafe swaps the real values in again, still in your browser.

## How it works

- **Paste first.** The page opens on a large editor. Paste anywhere on the page (or into the editor), use "Paste from clipboard", drop a text file (read locally with `File.text()`), or try the sample log. Text that arrives this way plays a short cleaning sequence: a scan beam sweeps the editor, each detected value flashes red and morphs into its green placeholder, a counter ticks up, and the editor settles on the **Cleaned** view. Any key or click skips to the end, and `prefers-reduced-motion` shows the result instantly. **Original** is the editable text; edits rescan without replaying the sequence, and "Clean again" replays it. The cleaned view is a `<pre>` built from text nodes and `<mark>` elements, never `innerHTML`. Above 300 KB or 5,000 lines it switches to a plain read-only textarea without highlights or animation.
- **Web Worker.** `public/js/app.js` sends the text to a module Web Worker (`public/js/scan-worker.js`), so a 5 MB paste never freezes the page. The worker runs `public/js/detect.js`, a pure ES module that the Node tests import too.
- **Rules.** Secrets are found with the [gitleaks](https://github.com/gitleaks/gitleaks) default rule set (MIT), converted from Go regex syntax into `public/js/rules.js` by `tools/gen-rules.mjs`. Each rule keeps its keyword prefilter, entropy threshold and allowlists. For speed, a rule only runs on lines that contain one of its keywords; only the few genuinely multiline rules (private keys, curl, Kubernetes secrets) run on the whole text.
- **Extra detectors.** Authorization Bearer/Basic values, passwords in URLs and database connection strings, `.env`, YAML and JSON keys whose name contains PASSWORD, SECRET, TOKEN, KEY, PRIVATE or CREDENTIAL, high-entropy values in assignments, emails, IPv4 and IPv6, card numbers (Luhn), IBANs (mod 97) and conservative phone numbers. Every category can be switched off.
- **Overlaps.** Specific rules win over generic ones, longer matches over shorter ones.
- **Placeholders.** Each unique value gets a stable name such as `AWS_ACCESS_KEY_1`, `GITHUB_TOKEN_1`, `EMAIL_2` or `IP_1`. A placeholder that already appears in the input is never issued. Masked spans are widened to word boundaries, so restore can match whole words only (`EMAIL_1` never eats into `EMAIL_10`) and the round trip is byte for byte.
- **Nothing stored.** The text and the placeholder map live in memory only. No cookies, no localStorage, no IndexedDB. Closing the tab forgets everything.
- **Share image.** Drawn on a canvas with counts only, never content, and downloaded through a `blob:` URL.
- **Live privacy monitor.** Instead of claims, the editor status bar and the "Check it yourself" section show readings the visitor can test: the number of network requests this page has made since it fully loaded (a `PerformanceObserver` on `resource` entries, started after the load event, `document.fonts.ready` and the scan worker's first answer; any URL that shows up is listed), the connection state from `navigator.onLine`, and whether the service worker has saved an offline copy (only once it controls the page).
- **House ads** for scrape.land, Penholder and Censory: `public/js/showcase.js` and `public/showcase.css` build a rotating unit (a dismissible anchor bar under 75rem, a sticky half-page unit in the right rail from 75rem). The data lives in `public/js/makers.js` with logos in `public/makers/`, instead of `ads.json`: the page CSP (`connect-src 'none'`) blocks fetching JSON, while a JS module loads under `script-src 'self'`. Nothing is named `ads`, because ad blockers block such files and a blocked import would break the page.
- **Fonts.** JetBrains Mono (code) and IBM Plex Sans (interface) are self-hosted variable latin subsets in `public/fonts/`, under the SIL Open Font License (see `THIRD_PARTY_NOTICES`). The share card waits for `document.fonts.load` so the canvas draws with the real faces.
- **Offline.** `public/sw.js` precaches the site's own files on install and serves same-origin requests network first with a cache fallback, so the page stays fresh online and works in airplane mode after the first visit.

## Verify the privacy claims yourself

1. Open DevTools, Network tab. Paste text, restore a reply, make a share image. No requests appear after the page has loaded, and the page's own counter stays at 0.
2. Turn Wi-Fi off and paste again: it keeps cleaning, and the status bar switches to "Offline". Once the page says "Saved for offline use", a reload works without a connection too.
3. Check the security header. The page is served with `connect-src 'none'`, so the browser blocks any connection the page tries to make. With `npm start` running:

   ```sh
   curl -I http://localhost:8080/
   curl -I http://localhost:8080/sw.js
   ```

   `/` (and `/js/*`) show `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'none'; ...`. `/sw.js` shows `default-src 'none'; connect-src 'self'`: the service worker needs to download the site's own files, and nothing else. The rules in `public/_headers` are deliberately `/` and `/js/*`, not `/*`, because matching rules are joined and `connect-src 'none'` would stack onto `/sw.js`.
4. Read the code. There is no build step: what is in `public/` is exactly what is served.

## Run locally

```sh
npm start                  # http://localhost:8080 (zero-dependency server that applies public/_headers)
PORT=0 node serve.mjs      # any free port, prints the URL
docker compose up --build  # http://localhost:8080
npm test                   # node --test, no dependencies
```

The tests cover one true positive per rule family and every extra detector, true negatives (commit hashes, UUIDs, base64 image data URIs, prose, versions, numbers), stable placeholders and exact restore, a 5 MB scan under 3 seconds, that every generated rule compiles and none was dropped, that `rules.js` matches the toml, that the service worker precache list matches `public/`, that there are no em or en dashes, and the CSP headers.

Secret-shaped test fixtures and the sample log are generated at runtime from split prefixes and random bodies, so no literal token sits in the repo and GitHub push protection stays quiet. None of them are real.

## Regenerate the rules

```sh
curl -o tools/gitleaks.toml https://raw.githubusercontent.com/gitleaks/gitleaks/master/config/gitleaks.toml
node tools/gen-rules.mjs
npm test
```

The generator parses the TOML subset gitleaks uses and translates Go regex syntax: a leading or mid-pattern `(?i)` and `(?i:...)` groups become the `i` flag for the whole regex (Node 22 has no inline modifiers, so this is slightly broader than gitleaks), `(?-i:...)` becomes a plain group, `(?s:.)` becomes `[\s\S]`, `\z` becomes `$`, `[[:alnum:]]` is expanded and named groups become plain groups. `paths` are ignored because a paste has no file name, so the one path-only rule (`pkcs12-file`) is skipped and listed in `rules.js`. Unknown syntax makes the generator throw instead of silently dropping a rule.

After changing any file in `public/`, update the `FILES` list and bump `CACHE` in `public/sw.js`. The tests fail if the list is out of date.

## Open Graph image

`public/og.png` is rendered from `tools/og.html` with headless Chrome:

```sh
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless --screenshot="<abs path>/public/og.png" --window-size=1200,630 "file:///<abs path>/tools/og.html"
```

There is no analytics script.

## License

MIT, see `LICENSE`. The gitleaks rules are MIT licensed, see `THIRD_PARTY_NOTICES`.
