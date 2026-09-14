// Detection engine: true positives, true negatives, placeholders, restore, performance.
// Secret-shaped fixtures are generated at runtime (split prefixes + random bodies) so GitHub push protection
// never sees a literal token in this file. None of them are real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { scan, restore } from '../public/js/detect.js';
import { sampleLog, rnd } from '../public/js/sample.js';

const UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', LO = 'abcdefghijklmnopqrstuvwxyz', DIG = '0123456789';
const ALNUM = UP + LO + DIG, HEX = DIG + 'abcdef';

// [label, text containing the value, value that must disappear, expected placeholder prefix]
const positives = () => {
  const list = [];
  const add = (label, value, context = v => `found ${v} in log`, name) => list.push([label, context(value), value, name]);
  add('aws-access-token', 'AK' + 'IA' + rnd(UP + '234567', 16), undefined, 'AWS_ACCESS_KEY_');
  add('github-pat', 'gh' + 'p_' + rnd(ALNUM, 36), undefined, 'GITHUB_TOKEN_');
  add('github-fine-grained-pat', 'github' + '_pat_' + rnd(ALNUM + '_', 82), undefined, 'GITHUB_TOKEN_');
  add('github-oauth', 'gh' + 'o_' + rnd(ALNUM, 36), undefined, 'GITHUB_TOKEN_');
  add('gitlab-pat', 'gl' + 'pat-' + rnd(ALNUM, 20), undefined, 'GITLAB_PAT_');
  add('slack-bot-token', 'xo' + 'xb-' + rnd(DIG, 11) + '-' + rnd(DIG, 12) + '-' + rnd(ALNUM, 24), undefined, 'SLACK_BOT_TOKEN_');
  add('slack-webhook-url', 'https://hooks.slack.com/services/T' + rnd(UP + DIG, 9) + '/B' + rnd(UP + DIG, 9) + '/' + rnd(ALNUM, 24), undefined, 'SLACK_WEBHOOK_URL_');
  add('stripe-access-token', 'sk' + '_live_' + rnd(ALNUM, 24), undefined, 'STRIPE_KEY_');
  add('gcp-api-key', 'AI' + 'za' + rnd(ALNUM + '_-', 35), undefined, 'GCP_API_KEY_');
  add('openai-api-key', 'sk-' + 'proj-' + rnd(ALNUM, 74) + 'T3Blbk' + 'FJ' + rnd(ALNUM, 74), undefined, 'OPENAI_API_KEY_');
  add('anthropic-api-key', 'sk-' + 'ant-api03-' + rnd(ALNUM, 93) + 'AA', undefined, 'ANTHROPIC_API_KEY_');
  add('npm-access-token', 'np' + 'm_' + rnd(LO + DIG, 36), undefined, 'NPM_ACCESS_TOKEN_');
  add('sendgrid-api-token', 'SG' + '.' + rnd(ALNUM, 22) + '.' + rnd(ALNUM, 43), undefined, 'SENDGRID_API_TOKEN_');
  add('twilio-api-key', 'S' + 'K' + rnd(HEX, 32), undefined, 'TWILIO_API_KEY_');
  add('digitalocean-pat', 'dop' + '_v1_' + rnd(HEX, 64), undefined, 'DIGITALOCEAN_PAT_');
  add('shopify-access-token', 'shp' + 'at_' + rnd(HEX, 32), undefined, 'SHOPIFY_ACCESS_TOKEN_');
  add('databricks-api-token', 'da' + 'pi' + rnd(HEX, 32), undefined, 'DATABRICKS_API_TOKEN_');
  add('linear-api-key', 'lin' + '_api_' + rnd(ALNUM, 40), undefined, 'LINEAR_API_KEY_');
  add('doppler-api-token', 'dp.' + 'pt.' + rnd(ALNUM, 43), undefined, 'DOPPLER_API_TOKEN_');
  add('square-access-token', 'sq0' + 'atp-' + rnd(ALNUM, 22), undefined, 'SQUARE_ACCESS_TOKEN_');
  add('age-secret-key', 'AGE-' + 'SECRET-KEY-1' + rnd('QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L', 58), undefined, 'AGE_SECRET_KEY_');
  add('telegram-bot-api-token', rnd(DIG, 9) + ':A' + rnd(ALNUM, 34), v => `telegram_bot = ${v}`, 'TELEGRAM_BOT_API_TOKEN_');
  add('heroku-api-key', [8, 4, 4, 4, 12].map(n => rnd(HEX, n)).join('-'), v => `heroku_api_key: ${v}`, 'HEROKU_API_KEY_');
  add('jwt', 'eyJhbGciOiJIUzI1NiJ9.' + 'eyJ' + rnd(ALNUM, 40) + '.' + rnd(ALNUM + '_-', 43), undefined, 'JWT_');
  add('private-key', '-----BEGIN EC PRIV' + 'ATE KEY-----\n' + rnd(ALNUM + '+/', 64) + '\n' + rnd(ALNUM + '+/', 48) + '\n-----END EC PRIV' + 'ATE KEY-----', v => `key:\n${v}\nend`, 'PRIVATE_KEY_');
  add('generic-api-key', rnd(ALNUM, 32), v => `'auth_token' => '${v}',`, 'API_KEY_');
  add('curl-auth-user', 'deploy:' + rnd(ALNUM, 16), v => `curl -u ${v} https://api.example.com/v1/items`, 'CURL_AUTH_USER_');
  add('kubernetes-secret-yaml', 'password: ' + btoa(rnd(ALNUM, 18)), v => `apiVersion: v1\nkind: Secret\nmetadata:\n  name: db\ndata:\n  ${v}\n`, 'KUBERNETES_SECRET_YAML_');
  // extra detectors
  add('bearer header', rnd(ALNUM, 40), v => `Authorization: Bearer ${v}`, 'BEARER_TOKEN_');
  add('url credentials', 'pw' + rnd(ALNUM, 12), v => `git remote add origin https://deploy:${v}@git.example.com/app.git`, 'PASSWORD_');
  add('mongodb connection string', 'pw' + rnd(ALNUM, 12), v => `MONGO_URL=mongodb+srv://app:${v}@cluster0.example.net/prod`, 'DB_PASSWORD_');
  add('ado connection string', 'Pw' + rnd(ALNUM, 12) + '!', v => `Server=tcp:sql.example.net,1433;Database=app;User ID=app;Password=${v};`, 'PASSWORD_');
  add('jdbc query password', 'pw' + rnd(ALNUM, 10), v => `jdbc:mysql://db.example.net:3306/app?user=app&password=${v}&ssl=true`, 'PASSWORD_');
  add('.env password', 'hunter2', v => `DB_PASSWORD=${v}`, 'PASSWORD_');
  add('.env quoted token', rnd(ALNUM, 24), v => `export API_TOKEN="${v}"`, 'SECRET_');
  add('yaml password', 'correct-horse-battery', v => `database:\n  password: ${v}\n`, 'PASSWORD_');
  add('json client secret', rnd(ALNUM, 30), v => `{"client_id": "web", "client_secret": "${v}"}`, 'SECRET_');
  add('high-entropy assignment', rnd(ALNUM, 32), v => `signature=${v} status=ok`, 'SECRET_');
  add('email', 'jane.doe+billing@example.co.uk', undefined, 'EMAIL_');
  add('ipv4', '198.51.100.23', v => `client ${v} connected`, 'IP_');
  add('ipv6 full', '2001:0db8:0000:0000:0000:ff00:0042:8329', undefined, 'IP_');
  add('ipv6 compressed', 'fd12:3456:789a::1', undefined, 'IP_');
  add('visa', '4242 4242 4242 4242', v => `card ${v} declined`, 'CARD_');
  add('mastercard', '5555555555554444', v => `pan=${v}`, 'CARD_');
  add('amex', '3782 822463 10005', undefined, 'CARD_');
  add('iban', 'GB82 WEST 1234 5698 7654 32', v => `pay to ${v} today`, 'IBAN_');
  add('iban compact', 'DE89370400440532013000', undefined, 'IBAN_');
  add('phone international', '+44 20 7946 0958', v => `call ${v} now`, 'PHONE_');
  add('phone us', '(415) 555-0132', v => `call ${v} now`, 'PHONE_');
  return list;
};

test('true positives: one per rule family and every extra detector', () => {
  for (const [label, text, value, name] of positives()) {
    const { masked, findings } = scan(text);
    assert.ok(!masked.includes(value), `${label} not masked:\n${masked}`);
    assert.ok(findings.some(f => f.placeholder.startsWith(name)), `${label}: expected ${name}, got ${findings.map(f => f.placeholder)}`);
    assert.equal(restore(masked, scan(text).map), text, `${label} round trip`);
  }
});

function pngDataUri() {
  const w = 48, h = 48, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([x * 5, y * 5, (x ^ y) * 3], y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8); return b; };
  const ihdr = Buffer.from([0, 0, 0, w, 0, 0, 0, h, 8, 2, 0, 0, 0]);
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

const NEGATIVES = {
  'commit hashes': 'commit 9fceb02d0ae598e95dc970b74767f19372d61af8\nMerge: 1a2b3c4 5d6e7f8\ngit checkout 9fceb02\n{"commit": "9fceb02d0ae598e95dc970b74767f19372d61af8", "sha": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}\nimage: registry.example.com/app@sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'uuids': 'request_id=7f9c2ba4-e88f-4f0e-9a4b-3c2d1e0f5a6b\n{"id": "550e8400-e29b-41d4-a716-446655440000", "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736"}\ntrace 550e8400-e29b-41d4-a716-446655440000 finished',
  'base64 image': `<img alt="logo" src="${pngDataUri()}">\n.logo { background: url(${pngDataUri()}); }\n{"avatar": "${pngDataUri()}"}`,
  'prose': 'The deploy finished at 14:32 and the error rate dropped back to 0.2%. Next week we will upgrade the database, rotate the logs and review who has access to the billing dashboard. Key takeaways: keep the token rotation schedule, and write down the password policy for new hires. Thanks to Maria and James for the quick fix!',
  'semver': 'upgraded react from v18.2.0 to 19.1.0, node 22.18.0, @types/node@22.15.3, 2.14.0-beta.1, python 3.12.4',
  'numbers': 'processed 1715000000000 events, pi is 3.14159, total $1,234.56, order 123456789012, port 5432, status 200 in 34 ms, 2025-09-14 09:41:07+02:00, listening on 0.0.0.0:8080 and 127.0.0.1:3000',
  'code and placeholders': 'const token = getToken();\napiKey: process.env.API_KEY,\npassword: ${DB_PASSWORD}\nsecret_key = os.environ["SECRET_KEY"]\napi_key=API_KEY_1\nimport { tokenize } from "./lexer.js"',
  'paths and urls': 'GET https://example.com/search?page=2&sort=desc 200\nat Object.<anonymous> (/srv/app/node_modules/express/lib/router/index.js:284:7)\nC:\\Users\\build\\AppData\\Local\\Temp\\cache.json\nsee icon@2x.png',
};

test('true negatives: hashes, UUIDs, base64 images, prose, versions, numbers', () => {
  for (const [label, text] of Object.entries(NEGATIVES)) {
    const { findings } = scan(text);
    assert.deepEqual(findings.map(f => `${f.rule}: ${text.slice(f.start, f.end)}`), [], label);
  }
});

test('same value always gets the same placeholder, and an existing placeholder is never reused', () => {
  const { masked } = scan('from a@example.com to b@example.com cc a@example.com');
  assert.equal(masked, 'from EMAIL_1 to EMAIL_2 cc EMAIL_1');
  const again = scan('EMAIL_1 is a column name; mail c@example.com');
  assert.equal(again.masked, 'EMAIL_1 is a column name; mail EMAIL_2');
  assert.equal(restore(again.masked, again.map), 'EMAIL_1 is a column name; mail c@example.com');
});

test('restore does not confuse EMAIL_1 with EMAIL_10 and leaves unknown placeholders alone', () => {
  const emails = Array.from({ length: 12 }, (_, i) => `user${i + 1}@example.com`);
  const { masked, map } = scan(emails.join('\n'));
  assert.equal(masked.split('\n')[9], 'EMAIL_10');
  const reply = 'Contact EMAIL_10, then EMAIL_1. EMAIL_99 and MY_EMAIL_1X stay.';
  assert.equal(restore(reply, map), 'Contact user10@example.com, then user1@example.com. EMAIL_99 and MY_EMAIL_1X stay.');
});

test('secrets glued to other word characters still round trip', () => {
  const text = 'x' + 'gh' + 'p_' + rnd(ALNUM, 36) + '9 and tok' + 'xo' + 'xb-' + rnd(DIG, 11) + '-' + rnd(DIG, 12) + '-' + rnd(ALNUM, 24);
  const { masked, map } = scan(text);
  assert.equal(masked, 'GITHUB_TOKEN_1 and SLACK_BOT_TOKEN_1');
  assert.equal(restore(masked, map), text);
});

test('sample log is fully masked and restore returns it byte for byte', () => {
  const text = sampleLog();
  const { masked, map, findings } = scan(text);
  const leaks = [/AKIA[A-Z2-7]{16}/, /AWS_SECRET_ACCESS_KEY=(?!SECRET_)/, /ghp_\w+/, /sk_live_\w+/, /billing_app:(?!DB_PASSWORD_)/,
    /eyJ[\w-]+\./, /-----BEGIN/, /PRIVATE KEY/, /SESSION_SECRET="(?!SECRET_)/, /@example\.com/, /@acme-corp\.io/, /203\.0\.113\.42/,
    /10\.0\.4\.17/, /2001:db8/, /4242/, /DE89/, /415 555/];
  for (const re of leaks) assert.doesNotMatch(masked, re);
  for (const c of ['keys', 'privateKeys', 'passwords', 'email', 'ip', 'card', 'iban', 'phone']) {
    assert.ok(findings.some(f => f.category === c), `sample has a ${c} finding`);
  }
  assert.equal(restore(masked, map), text);
  assert.deepEqual(scan(masked).findings.map(f => `${f.rule}: ${masked.slice(f.start, f.end)}`), [], 'masked output scans clean');
});

test('categories can be switched off', () => {
  const { masked } = scan('mail a@example.com from 198.51.100.23', ['ip']);
  assert.equal(masked, 'mail a@example.com from IP_1');
});

test('5 MB paste scans in under 3 seconds', () => {
  const chunk = sampleLog() + Object.values(NEGATIVES).join('\n') + '\n';
  const big = chunk.repeat(Math.ceil(5 * 1024 * 1024 / chunk.length));
  const t = performance.now();
  const { masked, map } = scan(big);
  const ms = performance.now() - t;
  assert.ok(ms < 3000, `took ${Math.round(ms)} ms`);
  assert.equal(restore(masked, map), big);
});
