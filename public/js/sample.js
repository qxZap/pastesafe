// A realistic fake log for "Try a sample log" and the tests. Every secret is built at runtime from a seeded
// generator and split prefixes, so no secret-shaped literal sits in the source (GitHub push protection).
// None of these values are real.
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const B64 = ALNUM + '+/';
let seed = 20250914;
export const rnd = (chars, n) => { // xorshift32, deterministic so the sample looks the same every time
  let s = '';
  for (let i = 0; i < n; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; s += chars[(seed >>> 0) % chars.length]; }
  return s;
};
const b64url = obj => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export function sampleLog() {
  seed = 20250914;
  const aws = 'AK' + 'IA' + rnd('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', 16);
  const awsSecret = rnd(B64, 40);
  const github = 'gh' + 'p_' + rnd(ALNUM, 36);
  const stripe = 'sk' + '_live_' + rnd(ALNUM, 24);
  const dbPass = 'Wint3r-' + rnd(ALNUM, 10);
  const jwt = b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url({ sub: '4821', email: 'maria.lopez@example.com', iat: 1757851200 }) + '.' + rnd(ALNUM, 43);
  const keyBody = Array.from({ length: 6 }, () => rnd(B64, 64)).join('\n');
  const privateKey = '-----BEGIN RSA PRIV' + 'ATE KEY-----\n' + 'MIIEow' + keyBody + '\n-----END RSA PRIV' + 'ATE KEY-----';
  const session = rnd(ALNUM, 32);

  return `2025-09-14T09:41:07.312Z INFO  api-gateway starting build=4.12.0 commit=9fceb02d0ae598e95dc970b74767f19372d61af8
2025-09-14T09:41:07.498Z INFO  loaded config from /etc/billing/.env
AWS_ACCESS_KEY_ID=${aws}
AWS_SECRET_ACCESS_KEY=${awsSecret}
STRIPE_SECRET_KEY=${stripe}
DATABASE_URL=postgres://billing_app:${dbPass}@db-prod.internal:5432/billing
SESSION_SECRET="${session}"
2025-09-14T09:41:08.020Z INFO  git clone https://${github}@github.com/acme/billing-worker.git
2025-09-14T09:41:09.117Z WARN  request_id=7f9c2ba4-e88f-4f0e-9a4b-3c2d1e0f5a6b slow query 1843 ms
2025-09-14T09:41:09.502Z ERROR payment failed for customer maria.lopez@example.com (card 4242 4242 4242 4242, IBAN DE89 3704 0044 0532 0130 00)
  at ChargeService.capture (/srv/app/src/charge.ts:88:13)
  at async Router.handle (/srv/app/src/router.ts:41:5)
2025-09-14T09:41:09.503Z DEBUG outgoing request headers:
  Authorization: Bearer ${jwt}
  X-Forwarded-For: 203.0.113.42, 10.0.4.17
2025-09-14T09:41:09.611Z INFO  support ticket #5521 opened by james.oconnor@acme-corp.io, callback +1 415 555 0132
2025-09-14T09:41:10.004Z WARN  ipv6 client 2001:db8:85a3::8a2e:370:7334 retried 3 times
2025-09-14T09:41:10.250Z DEBUG signing key loaded:
${privateKey}
2025-09-14T09:41:10.300Z INFO  ready in 2988 ms, 0 errors since v4.11.2
`;
}
