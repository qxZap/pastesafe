// Content for the guide pages in public/guides/. Build with: npm run guides
// Every fake credential here is made up for the examples. None of them are real.
// example.before is scanned by the real PasteSafe engine at build time: values in `hides` must be masked,
// values in `keeps` must survive, so the pages never claim a detection the code does not make.

export const SITE = 'https://pastesafe.vibe-coding.fans';
export const UPDATED = '2026-09-15';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Tagged template for code blocks: raw text (backslashes kept), escaped, trimmed.
const code = (strings, ...vals) =>
  `<pre class="code" tabindex="0"><code>${esc(String.raw(strings, ...vals).replace(/^\n/, '').replace(/\n\s*$/, ''))}</code></pre>`;

const STRIPE_TEST = 'sk_test_' + '51FakeKeyForDocs0nlyNotReal0000';
const AWS_ID = 'AKIA' + '2EXAMPLE7FAKEKEY';
const BEARER = 'FakeBearer7fK2mZpL9wR3nB8vT1yCq';
const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const jwt = (payload, sig) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.${sig}`;
const ACCESS_JWT = jwt({ sub: '4821', email: 'jane.doe@example.com', role: 'admin' }, 'FakeSignatureForDocs0nly7fK2mZpL9wR3nB8vT1y');
const REFRESH_JWT = jwt({ sub: '4821', typ: 'refresh' }, 'FakeRefreshSignatureForDocs0nly9wR3nB8vT1yC');
const ID_JWT = jwt({ sub: '4821', aud: 'billing-web' }, 'FakeIdTokenSignatureForDocs0nlyQ2mZpL9wR3n');

export const INDEX = {
  title: 'Guides to masking secrets and PII in logs | PasteSafe',
  description: 'Guides to masking API keys, passwords and personal data in logs, HAR files and .env files, with command line options and what to do after a leak.',
  h1: 'Guides to masking secrets and PII',
  lead: 'Practical guides for cleaning logs, HAR files, <code>.env</code> files and tokens before you share them, with code and command line alternatives, and an honest list of what PasteSafe does not catch.',
};

export const GUIDES = [
  {
    slug: 'mask-pii-in-logs',
    phrase: 'mask pii in logs',
    title: 'How to mask PII in logs before you share them | PasteSafe',
    description: 'Emails, IP addresses, card numbers and phone numbers pile up in logs. See what counts as PII, how to mask it in a log you have, and how to stop logging it.',
    h1: 'How to mask PII in logs',
    lead: 'Logs collect personal data without anyone deciding to: an email in an error message, a client IP on every access log line. Here is what to look for, how to mask it in a log you already have, and how to stop writing it.',
    example: {
      before: `2026-09-15T09:41:07Z INFO  login ok user=jane.doe@example.com ip=203.0.113.9
2026-09-15T09:41:09Z ERROR charge failed for jane.doe@example.com card=4242 4242 4242 4242
2026-09-15T09:41:09Z WARN  refund to IBAN GB82 WEST 1234 5698 7654 32, callback +1 415 555 0132
2026-09-15T09:41:10Z INFO  X-Forwarded-For: 198.51.100.7, 192.0.2.44
2026-09-15T09:41:11Z INFO  profile update name="Jane Doe" dob=1990-04-12 email=jane.doe%40example.com
2026-09-15T09:41:12Z INFO  sms fallback to 415.555.0132 from 127.0.0.1`,
      hides: ['jane.doe@example.com', '203.0.113.9', '4242 4242 4242 4242', 'GB82 WEST 1234 5698 7654 32', '+1 415 555 0132', '198.51.100.7', '192.0.2.44'],
      keeps: ['Jane Doe', '1990-04-12', 'jane.doe%40example.com', '415.555.0132', '127.0.0.1'],
    },
    body: `
<h2>What counts as PII in a log</h2>
<p>PII (personally identifiable information) is anything that points to a person on its own or together with other data. In application logs it shows up in a few predictable places:</p>
<ul>
<li><strong>Email addresses</strong> in login, signup, password reset and billing messages, and as user identifiers in structured logs.</li>
<li><strong>IP addresses</strong> in web server access logs, <code>X-Forwarded-For</code> headers, and rate limiting or fraud messages.</li>
<li><strong>Card numbers and IBANs</strong> in payment errors, webhook dumps and request bodies logged at debug level.</li>
<li><strong>Phone numbers</strong> in SMS, two factor and support flows.</li>
<li><strong>Names, street addresses and dates of birth</strong> in profile updates, orders and shipping.</li>
<li><strong>User IDs, session IDs and device IDs</strong>, which may not identify anyone alone but tie every other line to one person.</li>
</ul>
<p>Under the GDPR, an email address or an IP address is personal data when it can be linked to a person, and for your own users it usually can. That matters the moment a log leaves the system that wrote it: pasted into a GitHub issue, attached to a vendor ticket, dropped in a team chat or sent to an AI assistant. Each copy is one more place that holds your users' data, with its own retention and access rules.</p>

<h2>Example: a log with PII, before and after</h2>
<p>Before highlights what PasteSafe finds. After is the exact output of PasteSafe's scanner on that text.</p>
%EXAMPLE%
<p>Every email, IP address, card number, IBAN and international phone number is replaced. The same email gets the same placeholder on every line, so you can still follow one customer through the log. The last two lines show what stays: the name, the date of birth, the URL encoded email, the phone number written with dots and the loopback address.</p>

<h2>How to mask PII in a log with PasteSafe</h2>
<ol>
<li>Open <a href="/">PasteSafe</a> and paste the log, or drop the log file onto the editor. The file is read on your device.</li>
<li>Emails become <code>EMAIL_1</code>, IP addresses <code>IP_1</code>, card numbers <code>CARD_1</code>, IBANs <code>IBAN_1</code> and phone numbers <code>PHONE_1</code>. API keys, tokens and passwords are masked in the same pass.</li>
<li>Check the Findings list. If you need the IP addresses to debug a network problem, untick IP addresses under Mask these and they stay in the text.</li>
<li>Read the cleaned text for anything a scanner cannot know is personal, such as names.</li>
<li>Copy the cleaned text and share it. If an AI assistant answers with placeholders, paste its reply into Put the real values back to swap the real values in again, in your browser.</li>
</ol>
<p>The scan runs in a Web Worker inside the page, and the page's Content Security Policy blocks network connections, so the log is not uploaded anywhere.</p>

<h2>Masking PII on the command line</h2>
<p>For a quick one off with GNU sed, these two expressions replace email addresses and IPv4 addresses:</p>
${code`sed -E 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/EMAIL/g; s/\b([0-9]{1,3}\.){3}[0-9]{1,3}\b/IP/g' app.log > app.masked.log`}
<p>It works, with limits. Every address becomes the same <code>EMAIL</code>, so you can no longer tell two users apart. The IP pattern also hits version strings like 1.2.3.4. And there is nothing for card numbers, which need a Luhn check to avoid masking every long order number.</p>
<p>If you only need to hide which host a request came from, keep the network and zero the last octet:</p>
${code`sed -E 's/\b([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\.[0-9]{1,3}\b/\1.0/g' access.log > access.masked.log`}
<p>The sed that ships with macOS does not support <code>\\b</code>. Install GNU sed, or use <code>perl -pe</code>, which understands the same patterns.</p>

<h2>Stop writing PII into logs</h2>
<p>Masking a copy fixes one paste. For logs your services write every day, fix it at the source:</p>
<ul>
<li>Log a user ID instead of an email address. Support can look the user up when they need to.</li>
<li>Never log full card numbers. If you need to tell cards apart, log the brand and the last four digits.</li>
<li>Decide how long access logs with IP addresses are kept, and truncate or drop the address where you do not need it.</li>
<li>Add redaction to your logger, so fields like <code>email</code>, <code>password</code> and <code>authorization</code> are replaced before anything is written. The guide on <a href="/guides/mask-sensitive-data-in-logs/">masking sensitive data in logs</a> has examples for Node, Python, Java and Go.</li>
</ul>

<h2>What PasteSafe does not catch</h2>
<p>PasteSafe looks for data with a recognizable shape. It does not mask:</p>
<ul>
<li>Names, street addresses, dates of birth, and national ID numbers such as US Social Security numbers.</li>
<li>URL encoded emails like <code>jane.doe%40example.com</code>.</li>
<li>Phone numbers in local formats without a country code, or written with dots. It matches international numbers starting with <code>+</code> and US numbers like <code>(415) 555-0132</code> or <code>415-555-0132</code>.</li>
<li>Card numbers that fail the Luhn check, and loopback addresses such as <code>127.0.0.1</code>, which it skips on purpose.</li>
<li>User IDs, hostnames and anything else that is only personal in context.</li>
</ul>
<p>Read the cleaned text before you share it.</p>
`,
    faq: [
      ['Is an IP address PII?', 'Often, yes. Under the GDPR an IP address is personal data when it can be linked to a person, for example together with your account records or an internet provider\'s records. Treat IP addresses in your own logs as personal data unless you know they belong to servers.'],
      ['Does masking make a log anonymous?', 'Not always. Masking removes the values it finds, but user IDs, timestamps, order numbers and free text can still point to one person. Masking is enough to share a log for debugging. Calling data anonymous is a much higher bar.'],
      ['Can I still debug a log after masking PII?', 'Yes. PasteSafe gives each unique value its own placeholder, so EMAIL_1 on one line is the same person as EMAIL_1 on another. You can also untick a type, such as IP addresses, when you need it for the problem at hand.'],
      ['Does PasteSafe upload my log?', 'No. The log is scanned in your browser, in a background thread with no network code, and the page\'s Content Security Policy blocks connections. Nothing is saved, and closing the tab clears everything.'],
    ],
    related: ['mask-sensitive-data-in-logs', 'sanitize-logs-before-sharing', 'mask-credit-card-numbers'],
  },

  {
    slug: 'mask-sensitive-data-in-logs',
    phrase: 'mask sensitive data in logs',
    title: 'How to mask sensitive data in logs in your code | PasteSafe',
    description: 'Redact passwords, tokens and personal data in logs with pino, Python logging, Logback, Log4j 2 and Go slog, and clean up logs that already contain secrets.',
    h1: 'How to mask sensitive data in logs',
    lead: 'The reliable place to remove passwords, tokens and personal data from logs is the logger itself, before anything is written. Here is how to set that up in Node, Python, Java and Go, and what to do with logs that already contain secrets.',
    example: {
      before: `2026-09-15 09:41:07.312 ERROR SqlExceptionHelper - Connection refused: jdbc:postgresql://db.example.com:5432/billing?user=billing&password=Wint3r-Fake-Pass
2026-09-15 09:41:07.498 DEBUG RestTemplate - POST https://api.example.com/v1/charges headers=[Authorization:"Bearer ${BEARER}"]
2026-09-15 09:41:07.502 INFO  ChargeService - charge failed for jane.doe@example.com, retrying from 203.0.113.9
2026-09-15 09:41:07.610 WARN  LoginController - login failed for admin with password hunter2`,
      hides: ['Wint3r-Fake-Pass', BEARER, 'jane.doe@example.com', '203.0.113.9'],
      keeps: ['with password hunter2'],
    },
    body: `
<h2>Why redact at the logger</h2>
<p>Once a line is written it gets copied: to log files, to a log shipper, to a search index that many people can query, to backups, and into exports for vendors and support. A secret that reaches the first file usually reaches all of them. Removing it where the log line is built is the one place that covers every copy.</p>
<p>There are two ways to do it, and most setups need both:</p>
<ul>
<li><strong>By field.</strong> With structured (JSON) logging, replace known keys such as <code>password</code>, <code>authorization</code>, <code>cookie</code> and <code>email</code>. This is exact and cheap.</li>
<li><strong>By pattern.</strong> Run regular expressions over the message text for values that end up inside strings, such as <code>token=...</code> in a URL or a connection string in an exception. This catches more, costs CPU on every line, and still misses formats you did not think of.</li>
</ul>

<h2>Node.js with pino</h2>
<p>pino has redaction built in. List the paths to replace:</p>
${code`
const pino = require('pino');

const logger = pino({
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'user.email', 'body.password'],
    censor: '[REDACTED]',
  },
});

logger.info({ user: { id: 4821, email: 'jane.doe@example.com' } }, 'login ok');
// ... "user":{"id":4821,"email":"[REDACTED]"},"msg":"login ok"
`}
<p>Without <code>censor</code> the replacement is <code>[Redacted]</code>. Paths are exact, so a password nested under a key you did not list is still logged.</p>

<h2>Python logging</h2>
<p>A filter attached to a handler sees every record that handler writes, including records from other modules' loggers:</p>
${code`
import logging
import re

SECRET = re.compile(r'(password|token|api_key)=[^&\s]+', re.IGNORECASE)

class RedactFilter(logging.Filter):
    def filter(self, record):
        record.msg = SECRET.sub(r'\1=[REDACTED]', record.getMessage())
        record.args = None
        return True

handler = logging.StreamHandler()
handler.addFilter(RedactFilter())
logging.basicConfig(level=logging.INFO, handlers=[handler])

logging.info('retrying %s', 'https://api.example.com/v1?token=abc123&page=2')
# INFO:root:retrying https://api.example.com/v1?token=[REDACTED]&page=2
`}
<p>The filter formats the message with <code>getMessage()</code> first, so values passed as arguments are covered too. Exception tracebacks are added later by the formatter and are not touched.</p>

<h2>Java with Logback or Log4j 2</h2>
<p>Both can rewrite the message in the pattern layout with a regular expression. Logback:</p>
${code`
<encoder>
  <pattern>%d %-5level %logger{36} - %replace(%msg){'(password|token)=\S+', '$1=[REDACTED]'}%n</pattern>
</encoder>
`}
<p>Log4j 2:</p>
${code`
<PatternLayout pattern="%d %-5level %logger{36} - %replace{%msg}{(password|token)=\S+}{$1=[REDACTED]}%n"/>
`}
<p>This only changes what that one appender prints. JSON encoders and other appenders need their own masking.</p>

<h2>Go with log/slog</h2>
${code`
opts := &slog.HandlerOptions{
	ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
		switch a.Key {
		case "password", "token", "authorization", "email":
			return slog.String(a.Key, "[REDACTED]")
		}
		return a
	},
}
logger := slog.New(slog.NewJSONHandler(os.Stdout, opts))
logger.Info("login ok", "user_id", 4821, "email", "jane.doe@example.com")
// {"time":"...","level":"INFO","msg":"login ok","user_id":4821,"email":"[REDACTED]"}
`}

<h2>Test that it keeps working</h2>
<p>Redaction breaks quietly when someone renames a field or adds a new log line. Add one test that logs a known fake secret and fails if it appears in the output. It is a few lines, and it catches the regression the day it happens.</p>

<h2>Logs that already contain secrets</h2>
<p>Logger redaction does nothing for files written before it existed, or for output from third party tools. When you need to share one of those, mask a copy. Before highlights what PasteSafe finds, After is its exact output:</p>
%EXAMPLE%
<ol>
<li>Paste the log into <a href="/">PasteSafe</a> or drop the file onto the editor.</li>
<li>Known key formats (more than 200 rules from gitleaks), Bearer and Basic headers, passwords in connection strings, values under names like password, secret or token, emails, IP addresses, card numbers, IBANs and phone numbers become placeholders.</li>
<li>Copy the cleaned text into the ticket, chat or AI assistant.</li>
</ol>
<p>If a real key was in a log other people could read, rotate it. See <a href="/guides/what-to-do-if-you-leaked-an-api-key/">what to do if you leaked an API key</a>.</p>

<h2>What PasteSafe does not catch</h2>
<ul>
<li>Passwords written as plain words in a sentence, like the last line of the example.</li>
<li>Secrets in formats it has no rule for, when they sit under a neutral name and do not look random enough to count as high entropy.</li>
<li>Names, street addresses and other personal data without a fixed format.</li>
</ul>
`,
    faq: [
      ['What is log masking?', 'Log masking replaces sensitive values in log output, such as passwords, tokens, card numbers and emails, with a fixed marker or a placeholder, so the log can be stored and read without exposing those values.'],
      ['Should I mask in the application or in the log pipeline?', 'In the application when you can, because every later copy is then clean. Masking in a log shipper or log platform is a useful second layer, but by then the raw line has already been written somewhere.'],
      ['Is hashing an email address enough?', 'Not to hide who the user is. Email addresses are easy to guess, so a plain hash can be matched by hashing a list of candidate addresses. A hash is useful for grouping lines by user, not for keeping the user private.'],
      ['Can PasteSafe replace redaction in my logging code?', 'No. PasteSafe cleans a copy of a log before you share it. It does not change the logs your services write, so set up redaction in the logger as well.'],
    ],
    related: ['mask-pii-in-logs', 'sanitize-logs-before-sharing', 'what-to-do-if-you-leaked-an-api-key'],
  },

  {
    slug: 'sanitize-logs-before-sharing',
    phrase: 'sanitize logs',
    title: 'How to sanitize logs before sharing them | PasteSafe',
    description: 'Before a log goes into a GitHub issue, ticket, chat or AI assistant, remove API keys, cookies and customer data. A checklist, an example and CLI options.',
    h1: 'How to sanitize logs before you share them',
    lead: 'Logs get shared all the time: in GitHub issues, vendor tickets, team chats and AI assistants. A few minutes of cleanup keeps keys, session cookies and customer data out of places you do not control.',
    example: {
      before: `2026-09-15 09:41:07 INFO  starting billing-api on db-prod.acme.internal with config:
  DATABASE_URL=postgres://billing:Wint3r-Fake-Pass@db-prod.acme.internal:5432/billing
  STRIPE_SECRET_KEY=${STRIPE_TEST}
  AWS_ACCESS_KEY_ID=${AWS_ID}
  SENTRY_ENVIRONMENT=production
2026-09-15 09:41:09 DEBUG POST https://api.example.com/v1/charges
  Authorization: Bearer ${BEARER}
  Cookie: sessionid=9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c; theme=dark
2026-09-15 09:41:09 ERROR 402 card_declined for ops@example.net from 198.51.100.7`,
      hides: ['Wint3r-Fake-Pass', STRIPE_TEST, AWS_ID, BEARER, 'ops@example.net', '198.51.100.7'],
      keeps: ['db-prod.acme.internal', 'sessionid=9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c', 'SENTRY_ENVIRONMENT=production'],
    },
    body: `
<h2>Where shared logs end up</h2>
<ul>
<li><strong>Public issues and forums</strong> are indexed by search engines and read by bots that look for keys.</li>
<li><strong>Vendor support tickets</strong> live in someone else's helpdesk, with their staff, retention and security.</li>
<li><strong>Team chat</strong> is searchable by everyone in the channel, including people who join later, and synced to phones.</li>
<li><strong>AI assistants</strong> store the conversation on the provider's servers.</li>
</ul>
<p>Deleting the message later does not undo it. A copy may already sit in an email notification, a search index or a backup, and a leaked key keeps working until you revoke it.</p>

<h2>What to remove</h2>
<ul>
<li>Configuration printed at startup: environment variables, connection strings, API keys.</li>
<li>HTTP debug output: <code>Authorization</code> headers, cookies, tokens in query strings.</li>
<li>Private keys and certificates.</li>
<li>Customer data in error messages: emails, IP addresses, card numbers, phone numbers.</li>
<li>Internal details you may not want public: hostnames, account IDs, file paths with user names.</li>
</ul>

<h2>Example: a startup log before and after</h2>
<p>Before highlights what PasteSafe finds. After is its exact output.</p>
%EXAMPLE%
<p>The keys, the database password, the Bearer token, the email and the client IP are replaced. The internal hostname and the session cookie are not: PasteSafe does not treat hostnames as secret, and a <code>sessionid</code> cookie with a hex value, sent together with other cookies, matches none of its rules. That is why the last step below is to read the result.</p>

<h2>Step by step with PasteSafe</h2>
<ol>
<li>Cut the log down to the part that matters. <code>grep -n -B 5 -A 30 ERROR app.log</code> prints each error with 5 lines before it and 30 after. Less text means less to leak.</li>
<li>Paste it into <a href="/">PasteSafe</a> or drop the file onto the editor.</li>
<li>Look through the Findings list, which groups what was masked by type.</li>
<li>Read the cleaned text and replace anything left by hand, like the hostname and cookie above.</li>
<li>Press Copy cleaned text and paste it where it needs to go.</li>
</ol>

<h2>On the command line</h2>
<p><a href="https://github.com/gitleaks/gitleaks">gitleaks</a>, the open source scanner whose rules PasteSafe uses, can check a log for known secret formats. It reports what it finds and does not change the file:</p>
${code`
gitleaks dir -v app.log
cat app.log | gitleaks -v stdin
`}
<p>To replace values in a file, sed handles simple <code>key=value</code> cases:</p>
${code`sed -E 's/((password|secret|token|api_key)=)[^&[:space:]]+/\1REDACTED/g' app.log > app.clean.log`}
<p>A pattern list like this only catches the names you wrote down. Run gitleaks on the cleaned file afterwards to see what is left, and read it anyway.</p>

<h2>What PasteSafe does not catch</h2>
<ul>
<li>Internal hostnames, account IDs and file paths.</li>
<li>Session cookies in a <code>Cookie</code> header with several cookies, when the name ends in id, like <code>sessionid</code> or <code>session_id</code>, or the value is plain hex.</li>
<li>Passwords typed as plain words in a message, and names or street addresses.</li>
</ul>
`,
    faq: [
      ['What does it mean to sanitize a log?', 'Sanitizing a log means removing or replacing the values that should not be shared, such as API keys, passwords, session tokens and personal data, while keeping enough context to debug the problem.'],
      ['What should I remove from logs before posting a GitHub issue?', 'API keys, tokens, passwords, connection strings, cookies, private keys, customer emails, IP addresses and card numbers. Keep error messages, stack traces, versions and timestamps, since those are what maintainers need.'],
      ['Can gitleaks redact secrets in a log file?', 'No. gitleaks finds secrets and reports them. Its --redact option hides the secret values in its own output, but the log file itself stays unchanged.'],
      ['Is a sanitized log safe to post publicly?', 'Only after you have read it. Scanners catch known formats, but hostnames, names and plain passwords in free text can slip through. When in doubt, share it privately with the person who needs it.'],
    ],
    related: ['mask-pii-in-logs', 'sanitize-har-file', 'is-it-safe-to-paste-code-into-chatgpt'],
  },

  {
    slug: 'is-it-safe-to-paste-code-into-chatgpt',
    phrase: 'is it safe to paste code into chatgpt',
    title: 'Is it safe to paste code and logs into ChatGPT? | PasteSafe',
    description: 'What happens to code and logs you paste into ChatGPT, what to take out first, and how to mask keys and customer data in your browser before you hit send.',
    h1: 'Is it safe to paste code and logs into ChatGPT?',
    lead: 'Usually the code is not the problem. The API keys, connection strings and customer data that come along with it are. Here is what happens to what you paste, what to take out first, and how to do that in a few seconds.',
    example: {
      before: `// charge.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fallback = require('stripe')('${STRIPE_TEST}'); // remove before merge

Error: connect ECONNREFUSED 198.51.100.7:5432
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1607:16)
  databaseUrl: 'postgres://app:Wint3r-Fake-Pass@db.example.com:5432/app',
  customer: { id: 4821, email: 'sam.lee@example.org', plan: 'pro' }`,
      hides: [STRIPE_TEST, '198.51.100.7', 'Wint3r-Fake-Pass', 'sam.lee@example.org'],
      keeps: ['process.env.STRIPE_SECRET_KEY'],
    },
    body: `
<h2>The short answer</h2>
<p>It is as safe as sending that text to any outside service, because that is what it is. Code and logs you paste into ChatGPT, Claude, Gemini or Copilot Chat are sent to the provider and stored on its servers. So the real questions are whether your company allows it, and whether the text contains anything you would not email to a stranger.</p>
<p>Whether the code itself may be shared is a question for your company's AI policy. Secrets and personal data are different: a key in a chat is a working credential in a place you do not control, and customer data in a prompt is customer data shared with a third party.</p>

<h2>What happens to what you paste</h2>
<ul>
<li>The conversation is stored by the provider. How long, and whether it can be used to improve models, depends on your plan and settings. ChatGPT, for example, has a data control that stops your chats from being used for training, and business plans come with their own terms.</li>
<li>Stored conversations may be reviewed by the provider, for example to investigate abuse.</li>
<li>You cannot take a message back. Deleting the chat later does not revoke a key that was in it.</li>
<li>Chats can be shared by link, exported, or read by anyone who gets into your account.</li>
</ul>
<p>In 2023 Samsung restricted staff use of generative AI tools after engineers pasted internal source code into ChatGPT, as <a href="https://techcrunch.com/2023/05/02/samsung-bans-use-of-generative-ai-tools-like-chatgpt-after-april-internal-data-leak/">reported by TechCrunch</a>. Nobody was hacked. It was ordinary debugging.</p>

<h2>What to take out before you paste</h2>
<ul>
<li>API keys, tokens and passwords, including ones hardcoded just for testing.</li>
<li>Connection strings with credentials, and <code>.env</code> or config files.</li>
<li>Private keys and certificates.</li>
<li>Customer data in logs, fixtures and database dumps: emails, IP addresses, card numbers, phone numbers.</li>
<li>Anything your company classifies as confidential, such as unreleased product names or internal hostnames.</li>
</ul>
<p>Code that reads a secret from the environment, like <code>process.env.STRIPE_SECRET_KEY</code>, is fine to paste. The value is not in it.</p>

<h2>Example: a question with a leak in it</h2>
<p>A typical paste: a bit of code and the error it throws. Before highlights what PasteSafe finds, After is its exact output.</p>
%EXAMPLE%
<p>The environment variable reference stays, because it holds no secret. The hardcoded test key, the database password, the IP address and the customer email are replaced. The AI can still see that there is a key, a database URL and a customer, which is all it needs to answer.</p>

<h2>How to paste safely with PasteSafe</h2>
<ol>
<li>Paste the code or log into <a href="/">PasteSafe</a>. The scan runs in your browser and nothing is uploaded.</li>
<li>Check the Findings list and read the cleaned text.</li>
<li>Press Copy cleaned text and paste that into ChatGPT, Claude or another assistant.</li>
<li>If the answer refers to placeholders, for example "set <code>STRIPE_KEY_1</code> in your environment", paste it into Put the real values back to get a version with the real values, still in your browser.</li>
</ol>

<h2>If you already pasted a key</h2>
<p>Rotate it. Deleting the chat is fine too, but it does not make the key stop working. <a href="/guides/what-to-do-if-you-leaked-an-api-key/">What to do if you leaked an API key</a> walks through it.</p>

<h2>What PasteSafe does not catch</h2>
<ul>
<li>Confidential business logic, product names and internal URLs. They are not secrets in a format a scanner can recognize.</li>
<li>Names, street addresses and plain passwords written in comments or prose.</li>
<li>Secrets split across lines or assembled from pieces in code.</li>
</ul>
`,
    faq: [
      ['Does ChatGPT store the code I paste?', 'Yes. Conversations are stored on OpenAI\'s servers. How long they are kept and whether they are used to improve models depends on your plan and your data control settings, so check both, and your company\'s policy, before pasting work code.'],
      ['Is it safe to paste API keys into ChatGPT?', 'No. Treat a key you pasted into any chat as leaked and rotate it. Mask keys before pasting: the AI does not need the real value to help with the code around it.'],
      ['Can other ChatGPT users see my code?', 'Other users do not see your conversations unless you share a link. The risks are storage on the provider\'s servers, possible use for training depending on your settings, and anyone who gets into your account.'],
      ['Does PasteSafe work with Claude, Gemini and Copilot too?', 'Yes. PasteSafe cleans text in your browser and you paste the result wherever you like, so it works the same for any assistant, ticket system or chat.'],
    ],
    related: ['what-to-do-if-you-leaked-an-api-key', 'share-env-file-safely', 'sanitize-logs-before-sharing'],
  },

  {
    slug: 'what-to-do-if-you-leaked-an-api-key',
    phrase: 'what happens if you leak an api key',
    title: 'What to do if you leaked an API key or token | PasteSafe',
    description: 'Revoke or rotate the key first. Then check whether it was used, remove it from git, chat or logs, and stop the next leak. Steps for AWS, Stripe and GitHub.',
    h1: 'What to do if you leaked an API key',
    lead: 'Revoke or rotate the key first, before anything else. Deleting the commit, message or chat does not stop the key from working. Then check whether it was used, clean up where it leaked, and make the next leak less likely.',
    example: {
      before: `2026-09-15T09:41:07Z DEBUG stripe: 401 Invalid API Key provided: ${STRIPE_TEST}
2026-09-15T09:41:08Z INFO  aws: using credentials ${AWS_ID} from profile deploy
2026-09-15T09:41:08Z DEBUG GET https://api.example.com/v2/export?api_key=Qm9vbGVhbkZha2VLZXkxMjM0NTY3OA
2026-09-15T09:41:09Z DEBUG headers: {"X-Api-Key": "3f9a2c7e1b8d4f6a0c5e9b2d7a1f4c8e"}`,
      hides: [STRIPE_TEST, AWS_ID, 'Qm9vbGVhbkZha2VLZXkxMjM0NTY3OA', '3f9a2c7e1b8d4f6a0c5e9b2d7a1f4c8e'],
    },
    body: `
<h2>1. Revoke or rotate the key now</h2>
<p>Anyone who has the key can use it until the provider stops accepting it, and only revoking it does that. If the key leaked somewhere public, disable it right away and accept a short outage. If it leaked somewhere private, you can create the replacement first, deploy it, and then disable the old key.</p>
<p>How that looks with a few common providers:</p>
<ul>
<li><strong>AWS access keys:</strong> create a new key, update everything that uses it, then deactivate and delete the old one.</li>
<li><strong>Stripe:</strong> in the Dashboard, open the API keys page under Developers and use Roll key on the secret key. You can choose when the old key stops working.</li>
<li><strong>OpenAI, Anthropic and other AI APIs:</strong> delete the key on the API keys page of the console and create a new one.</li>
<li><strong>GitHub personal access tokens:</strong> delete the token under Settings, Developer settings, Personal access tokens, and create a new one with the smallest scope that works.</li>
<li><strong>Database passwords:</strong> set a new password for the user, for example with <code>ALTER USER app WITH PASSWORD '...';</code> in PostgreSQL, then update every connection string.</li>
</ul>
<p>For AWS with the CLI, where <code>deploy-bot</code> is the IAM user that owns the key:</p>
${code`
aws iam create-access-key --user-name deploy-bot
aws iam update-access-key --user-name deploy-bot --access-key-id ${AWS_ID} --status Inactive
aws iam delete-access-key --user-name deploy-bot --access-key-id ${AWS_ID}
`}
<p>Not sure which service a key belongs to? Paste the text around it into <a href="/">PasteSafe</a>. For known formats the placeholder is named after the rule that matched, such as <code>STRIPE_KEY_1</code>, <code>AWS_ACCESS_KEY_1</code> or <code>OPENAI_API_KEY_1</code>.</p>

<h2>2. Check whether it was used</h2>
<ul>
<li>Look at the provider's usage and billing pages for activity since the leak.</li>
<li>Read the audit logs. On AWS, CloudTrail can list the management events of the last 90 days made with a specific key, per region.</li>
<li>Look for things you did not create: new users or keys, servers in regions you do not use, changed webhooks, emails or messages you did not send.</li>
<li>If the key could read customer data and there are signs it was used, bring in whoever handles security incidents at your company. There may be a duty to notify people.</li>
</ul>
${code`aws cloudtrail lookup-events --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=${AWS_ID}`}

<h2>3. Remove it from where it leaked</h2>
<ul>
<li><strong>A git repository:</strong> deleting the file in a new commit leaves the key in the history. See <a href="/guides/remove-secrets-from-git-history/">how to remove a secret from git history</a>.</li>
<li><strong>A chat message, ticket or issue:</strong> edit or delete it, and remember that email notifications may already contain the text.</li>
<li><strong>An AI chat:</strong> delete the conversation. The provider may keep it for a while, which is one more reason the key has to be rotated.</li>
<li><strong>A log or monitoring tool:</strong> delete the affected entries if the tool allows it, and fix the code that logged the key.</li>
</ul>

<h2>How keys leak through logs</h2>
<p>A common path is a debug log that prints a request, an SDK error that echoes the key, or a startup message that dumps the configuration. The log then gets pasted into an issue or an AI chat. Here is what PasteSafe does with such a log. Before highlights what it finds, After is its exact output:</p>
%EXAMPLE%

<h2>4. Make the next leak less likely</h2>
<ul>
<li>Keep keys out of code. Load them from environment variables or a secrets manager.</li>
<li>Scan before you commit. gitleaks runs as a <a href="https://pre-commit.com/">pre-commit</a> hook, and GitHub push protection blocks many known key formats when you push.</li>
<li>Give keys the smallest permissions and, where the provider supports it, an expiry date or IP restrictions.</li>
<li>Mask logs before sharing them. <a href="/">PasteSafe</a> does it in your browser.</li>
</ul>

<h2>What PasteSafe cannot do</h2>
<p>PasteSafe never contacts any service, so it cannot tell you whether a key is valid, whether it was used, or revoke it for you. It also misses keys in formats it has no rule for when they sit under a neutral name and do not look random. The fix for a leaked key is always in the provider's own console.</p>
`,
    faq: [
      ['What happens if you leak an API key?', 'Anyone who finds it can use it with the key\'s permissions until you revoke it. Depending on the key, that means usage charges on your account, access to your data, or messages and payments sent in your name. Keys in public repositories are found by automated scanners.'],
      ['Is deleting the commit or message enough?', 'No. The key still works, and copies may already exist in clones, forks, notifications, caches and backups. Revoke or rotate the key first, then clean up.'],
      ['How do I know if a leaked key was used?', 'Check the provider\'s usage, billing and audit logs for activity you do not recognize since the leak, such as AWS CloudTrail events for that access key ID. If the logs show nothing, still rotate the key.'],
      ['Can PasteSafe check if a key is still valid?', 'No. PasteSafe never makes network requests, so it cannot test a key. It finds and masks keys in text, so they do not leak again when you share a log.'],
    ],
    related: ['remove-secrets-from-git-history', 'sanitize-logs-before-sharing', 'share-env-file-safely'],
  },

  {
    slug: 'remove-secrets-from-git-history',
    phrase: 'remove secret from git history',
    title: 'How to remove a secret from git history | PasteSafe',
    description: 'Rotate the secret, find every commit that contains it, rewrite history with git filter-repo or BFG, and clean up forks, clones and pull request refs.',
    h1: 'How to remove a secret from git history',
    lead: 'First rotate the secret, because rewriting history does not stop it from working. Then find every commit that contains it, rewrite the history with git filter-repo or BFG, and clean up the copies a force push does not reach.',
    example: {
      before: `commit 3f1c9a7e2b8d4f60c5e9b2d7a1f4c8e93b6d2a10
Author: Sam Lee <sam.lee@example.org>
Date:   Tue Sep 15 09:41:07 2026 +0000

    add local config

diff --git a/.env b/.env
new file mode 100644
--- /dev/null
+++ b/.env
@@ -0,0 +1,4 @@
+DATABASE_URL=postgres://app:Wint3r-Fake-Pass@localhost:5432/app
+STRIPE_SECRET_KEY=${STRIPE_TEST}
+JWT_SIGNING_SECRET=fake-signing-secret-9f8a7b6c
+LOG_LEVEL=debug`,
      hides: ['Wint3r-Fake-Pass', STRIPE_TEST, 'fake-signing-secret-9f8a7b6c', 'sam.lee@example.org'],
      keeps: ['3f1c9a7e2b8d4f60c5e9b2d7a1f4c8e93b6d2a10', 'LOG_LEVEL=debug'],
    },
    body: `
<h2>Rotate first</h2>
<p>Once a secret has been pushed, assume someone has a copy. Clones, forks, CI caches and pull request references can all hold the old commits, and public repositories are watched by automated scanners. GitHub's own guide says the first step is to revoke or rotate the secret. After that, removing it from history is cleanup, not the fix. <a href="/guides/what-to-do-if-you-leaked-an-api-key/">What to do if you leaked an API key</a> covers rotation for common providers.</p>

<h2>Find every commit that contains it</h2>
<p><a href="https://github.com/gitleaks/gitleaks">gitleaks</a> scans the whole history of a repository:</p>
${code`gitleaks git -v .`}
<p>If you know the value, or the start of it, git lists every commit that added or removed it:</p>
${code`git log --all -p -S 'sk_test_51FakeKey'`}
<p>To see what else a suspicious commit exposes, paste the output of <code>git show</code> into <a href="/">PasteSafe</a>. The Findings list shows each masked value next to its placeholder, which helps you build the list of strings to remove. Before highlights what PasteSafe finds, After is its exact output:</p>
%EXAMPLE%
<p>The commit hash is left alone. The author email is masked too: it is personal data, but not something you need to remove from history.</p>

<h2>Rewrite history with git filter-repo</h2>
<p><a href="https://github.com/newren/git-filter-repo">git filter-repo</a> is the tool GitHub's documentation uses. Work in a fresh clone. Put the values to remove in a text file outside the repository, one per line:</p>
${code`
${STRIPE_TEST}
Wint3r-Fake-Pass==>REMOVED_DB_PASSWORD
regex:JWT_SIGNING_SECRET=.*==>JWT_SIGNING_SECRET=REMOVED
`}
<p>Each line is literal text unless it starts with <code>regex:</code> or <code>glob:</code>. Matches are replaced with <code>***REMOVED***</code>, or with the text after <code>==&gt;</code>. Then run:</p>
${code`git filter-repo --sensitive-data-removal --replace-text ../passwords.txt`}
<p>To drop a whole file from every commit instead, for example a committed <code>.env</code>:</p>
${code`git filter-repo --sensitive-data-removal --invert-paths --path .env`}
<p><code>--sensitive-data-removal</code> needs git filter-repo 2.47 or later. It fetches all refs first and prints the follow up steps for the remote and other clones.</p>

<h2>Or use BFG Repo-Cleaner</h2>
<p><a href="https://rtyley.github.io/bfg-repo-cleaner/">BFG</a> is an older alternative that many guides still use. It works on a mirror clone and by default does not change your latest commit, so remove the secret from the current files and commit that first:</p>
${code`
git clone --mirror https://github.com/acme/billing.git
bfg --replace-text passwords.txt billing.git
cd billing.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
`}

<h2>Push and clean up the copies</h2>
<ol>
<li>Force push the rewritten branches and tags, following the instructions filter-repo prints.</li>
<li>Ask everyone with a clone to delete it and clone again. One push from an old clone brings the secret back.</li>
<li>On GitHub, old commits can stay reachable through forks, pull request references and cached views. GitHub's guide to <a href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository">removing sensitive data from a repository</a> explains when to contact GitHub Support.</li>
<li>Delete CI caches and build artifacts made from the old commits.</li>
</ol>

<h2>Keep it from happening again</h2>
<ul>
<li>Add <code>.env</code> and other local config files to <code>.gitignore</code>, and commit a <code>.env.example</code> with names only.</li>
<li>Run gitleaks as a pre-commit hook. Add this to <code>.pre-commit-config.yaml</code>, using the latest release tag for <code>rev</code>:</li>
</ul>
${code`
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.24.2
    hooks:
      - id: gitleaks
`}
<ul>
<li>Turn on push protection for the repository if your git host offers it.</li>
</ul>

<h2>What PasteSafe does not do</h2>
<p>PasteSafe never touches your repository. It masks a copy of the text you paste, which helps when reviewing or sharing a diff, but the history still has to be rewritten with git filter-repo or BFG using the real values.</p>
`,
    faq: [
      ['Does deleting the file in a new commit remove the secret?', 'No. The file is gone from the latest commit, but every earlier commit still contains it, and anyone with access can check out or browse those commits. Rotate the secret and rewrite the history.'],
      ['Should I use git filter-repo or BFG?', 'Either works. GitHub\'s documentation uses git filter-repo, which can also remove files by path and prints cleanup steps with --sensitive-data-removal. BFG replaces text on a mirror clone and leaves your latest commit alone by default.'],
      ['Do I still need to rotate the key after rewriting history?', 'Yes. Rewriting history does not reach existing clones, forks or anything a scanner already copied. Rotation is what makes the leaked value useless.'],
      ['Does a force push remove the secret from GitHub?', 'Not completely. Old commits can stay reachable through forks, pull request references and cached views. GitHub\'s guide on removing sensitive data explains when to contact GitHub Support.'],
    ],
    related: ['what-to-do-if-you-leaked-an-api-key', 'share-env-file-safely', 'sanitize-logs-before-sharing'],
  },

  {
    slug: 'sanitize-har-file',
    phrase: 'sanitize har file',
    title: 'How to sanitize a HAR file before you share it | PasteSafe',
    description: 'HAR files hold session cookies, tokens and passwords. See what Chrome\'s sanitized export removes, clean up with jq, and mask what is left in your browser.',
    h1: 'How to sanitize a HAR file',
    lead: 'A HAR file is a recording of everything your browser sent and received, including session cookies and tokens that let someone act as you. Here is what is in one, what Chrome\'s sanitized export removes, and how to clean the rest.',
    example: {
      before: String.raw`{
  "request": {
    "method": "POST",
    "url": "https://api.example.com/v1/login?api_key=Qm9vbGVhbkZha2VLZXkxMjM0NTY3OA",
    "headers": [
      { "name": "Authorization", "value": "Bearer ${BEARER}" },
      { "name": "Cookie", "value": "sessionid=9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c; theme=dark" }
    ],
    "postData": {
      "mimeType": "application/json",
      "text": "{\"email\":\"jane.doe@example.com\",\"password\":\"Tr0ub4dor-3x\"}"
    }
  },
  "serverIPAddress": "198.51.100.7"
}`,
      hides: ['Qm9vbGVhbkZha2VLZXkxMjM0NTY3OA', BEARER, 'jane.doe@example.com', '198.51.100.7'],
      keeps: ['sessionid=9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c', 'Tr0ub4dor-3x'],
    },
    body: `
<h2>What is in a HAR file</h2>
<p>HAR (HTTP Archive) is a JSON format for recording browser network traffic. Support teams ask for one because it shows exactly what happened. For each request it can contain:</p>
<ul>
<li>The full URL, including query strings such as <code>?token=</code> or <code>?api_key=</code>.</li>
<li>Request and response headers, including <code>Cookie</code>, <code>Set-Cookie</code> and <code>Authorization</code>.</li>
<li>The parsed cookies again, in separate <code>cookies</code> arrays.</li>
<li>Request bodies, including the password you typed if you signed in while recording.</li>
<li>Response bodies: account details, API responses, sometimes OAuth tokens.</li>
<li>The IP address of the server that answered.</li>
</ul>
<p>The session cookie is the dangerous part. It is what keeps you signed in, so whoever has a valid one can use your session without your password or second factor, until the session ends.</p>

<h2>What Chrome's sanitized export removes</h2>
<p>Chrome DevTools exports a sanitized HAR by default. According to the <a href="https://developer.chrome.com/docs/devtools/network/reference">Network panel reference</a>, it leaves out the <code>Cookie</code>, <code>Set-Cookie</code> and <code>Authorization</code> headers. To export them you have to turn on Allow to generate HAR with sensitive data in the DevTools network preferences.</p>
<p>That is a good start, but everything else stays: tokens in URLs, API keys in custom headers like <code>X-Api-Key</code>, passwords in request bodies and personal data in responses. Other browsers and older versions may export everything, so check the file before you send it.</p>

<h2>Clean headers and cookies with jq</h2>
<p>This <a href="https://github.com/jqlang/jq">jq</a> command replaces sensitive headers and empties the cookie arrays in every entry:</p>
${code`
jq '(.log.entries[].request.headers[], .log.entries[].response.headers[])
      |= (if (.name | test("^(authorization|cookie|set-cookie|x-api-key)$"; "i")) then .value = "REDACTED" else . end)
    | .log.entries[].request.cookies = []
    | .log.entries[].response.cookies = []' in.har > clean.har
`}
<p>If the support team does not need the bodies, empty those too. It also makes the file much smaller:</p>
${code`jq '(.log.entries[].request.postData | select(.) | .text) = "" | .log.entries[].response.content.text = ""' clean.har > small.har`}

<h2>Mask what is left with PasteSafe</h2>
<p>A HAR file is text, so you can drop it straight onto the <a href="/">PasteSafe</a> editor. It is read on your device and scanned in your browser. Here is a trimmed HAR entry. Before highlights what PasteSafe finds, After is its exact output:</p>
%EXAMPLE%
<p>The Bearer token, the API key in the URL, the email and the server IP are masked. Two things are not: the password inside the escaped JSON request body, and the <code>sessionid</code> cookie with a plain hex value. The jq commands above take care of both, which is why it makes sense to run them first.</p>
<ol>
<li>Export a sanitized HAR, then run the jq commands.</li>
<li>Drop the file onto PasteSafe. HAR files with bodies are often several megabytes. PasteSafe handles that, but above 300 KB it shows the result as plain text without highlights.</li>
<li>Search the cleaned text for your own email, user name and anything from the pages you visited that you would not want shared.</li>
<li>Copy the cleaned text, save it as a new file with the <code>.har</code> extension, and send that.</li>
</ol>

<h2>What PasteSafe does not catch in a HAR file</h2>
<ul>
<li>Passwords and tokens inside escaped JSON strings, such as the request body in <code>postData.text</code>.</li>
<li>Cookie header values that hold several cookies, like the one in the example.</li>
<li>Personal data without a fixed format in response bodies: names, addresses, order details.</li>
<li>Anything inside base64 encoded bodies.</li>
</ul>
`,
    faq: [
      ['What is a sanitized HAR file?', 'A HAR file with sensitive data removed. In Chrome DevTools the default sanitized export leaves out the Cookie, Set-Cookie and Authorization headers. Tokens in URLs, custom headers and request or response bodies are still included.'],
      ['Does a HAR file contain passwords?', 'It can. If you signed in while recording, the login request body with your password is in the file. It also holds session cookies and tokens, which work without the password.'],
      ['Is it safe to send a HAR file to support?', 'Only to a support channel you trust, and only after sanitizing it. Record just the steps that show the problem, sign out afterwards to end the session, and remove cookies, tokens and bodies you do not need to share.'],
      ['Can PasteSafe open a .har file?', 'Yes. Drop the file onto the editor and it is read and scanned in your browser, with nothing uploaded. Copy the cleaned text and save it as a new .har file.'],
    ],
    related: ['is-it-safe-to-share-a-jwt', 'sanitize-logs-before-sharing', 'mask-pii-in-logs'],
  },

  {
    slug: 'mask-credit-card-numbers',
    phrase: 'mask credit card number',
    title: 'How to mask credit card numbers in logs and text | PasteSafe',
    description: 'Mask card numbers in logs and text: how to spot a PAN with the Luhn check, masking in JavaScript, Python and sed, and what PCI DSS says about display.',
    h1: 'How to mask credit card numbers in logs and text',
    lead: 'Card numbers slip into payment error logs, request dumps, CSV exports and support tickets. Here is how to recognize them, how to mask them in code or on the command line, and how to clean a log you need to share.',
    example: {
      before: `2026-09-15T09:41:09Z ERROR charge declined card=4242 4242 4242 4242 exp=12/34 cvc=123 name="Jane Doe"
2026-09-15T09:41:10Z INFO  retry pan=5555555555554444 amount=49.00 currency=USD
2026-09-15T09:41:11Z INFO  amex 3782 822463 10005 approved, receipt to jane.doe@example.com
2026-09-15T09:41:12Z WARN  import row 88: 4242.4242.4242.4242 stored as 424242******4242`,
      hides: ['4242 4242 4242 4242', '5555555555554444', '3782 822463 10005', 'jane.doe@example.com'],
      keeps: ['exp=12/34', 'cvc=123', 'Jane Doe', '4242.4242.4242.4242', '424242******4242'],
    },
    body: `
<h2>Why card numbers in logs are a problem</h2>
<p>A card number, or PAN (primary account number), is exactly what fraudsters want, and handling it is regulated. PCI DSS, the security standard for anyone who processes card data, requires the PAN to be masked when displayed, so that at most the BIN (the first digits, which identify the issuer) and the last four digits are visible. In PCI DSS 4.0 that is requirement 3.4.1. Stored PANs must be unreadable, and card security codes must not be kept at all after authorization.</p>
<p>A log file full of card numbers means the log storage, its backups and everyone who can read them are handling card data too.</p>

<h2>How to recognize a card number</h2>
<ul>
<li><strong>Length:</strong> 13 to 19 digits, usually printed in groups of four. American Express uses 15 digits grouped 4, 6 and 5.</li>
<li><strong>Prefix:</strong> the first digits identify the network. Visa starts with 4, Mastercard with 51 to 55 or 2221 to 2720, American Express with 34 or 37.</li>
<li><strong>Checksum:</strong> the last digit is a Luhn check digit. Starting from the right, double every second digit, subtract 9 from any result over 9, and add everything up. A valid number gives a multiple of 10.</li>
</ul>
<p>The Luhn check is what separates a card number from an order ID or a timestamp. It does not prove a card exists: the test numbers below all pass it.</p>

<h2>Example: masking card numbers in a log</h2>
<p>These are the standard test card numbers. Before highlights what PasteSafe finds, After is its exact output.</p>
%EXAMPLE%
<p>The Visa, Mastercard and American Express numbers each get their own placeholder. The expiry date, the CVC and the cardholder name stay, and so does the number written with dots, because PasteSafe only accepts spaces or dashes between groups. The already masked number is left alone, which is what you want.</p>

<h2>Mask a card number in code</h2>
<p>To display a card number, keep only the last four digits. In JavaScript:</p>
${code`
const maskPan = pan => pan.replace(/\d(?=(?:\D*\d){4})/g, '*');

maskPan('4242 4242 4242 4242'); // '**** **** **** 4242'
`}
<p>To find card numbers in free text, match candidates first and keep only those that pass the Luhn check. In Python:</p>
${code`
import re

CANDIDATE = re.compile(r'\b(?:\d[ -]?){12,18}\d\b')

def luhn_ok(digits):
    total = 0
    for i, d in enumerate(reversed(digits)):
        n = int(d)
        if i % 2:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0

def mask_cards(text):
    def repl(m):
        digits = re.sub(r'\D', '', m.group())
        return '[CARD]' if luhn_ok(digits) else m.group()
    return CANDIDATE.sub(repl, text)

print(mask_cards('card 4242 4242 4242 4242 order 1234 5678 9012 3456'))
# card [CARD] order 1234 5678 9012 3456
`}
<p>This is a starting point: two numbers written next to each other can merge into one candidate that fails the check.</p>

<h2>On the command line</h2>
${code`sed -E 's/\b([0-9]{4}[ -]?){3}[0-9]{4}\b/[CARD]/g' payments.log > payments.masked.log`}
<p>This masks any 16 digit number in groups of four. There is no Luhn check, so it also masks order numbers, and it misses 15 digit American Express numbers.</p>

<h2>Clean a log with PasteSafe</h2>
<ol>
<li>Paste the log into <a href="/">PasteSafe</a>, or drop the file onto the editor.</li>
<li>Card numbers that pass the prefix and Luhn checks become <code>CARD_1</code>, <code>CARD_2</code> and so on. The same card always gets the same placeholder, so you can still see that two failed charges used the same card.</li>
<li>Remove expiry dates, CVCs and names by hand if they are in the log.</li>
<li>Copy the cleaned text and share it.</li>
</ol>

<h2>What PasteSafe does not catch</h2>
<ul>
<li>Expiry dates, CVCs and cardholder names.</li>
<li>Numbers with dots or other separators between groups, and numbers that fail the Luhn check, such as a mistyped card number.</li>
<li>Card numbers split across fields or lines.</li>
</ul>
<p>It recognizes numbers that start like Visa, Mastercard, American Express, Diners Club, JCB, Discover and UnionPay cards. Check the result before you share it.</p>
`,
    faq: [
      ['What does masking a credit card number mean?', 'Replacing most of its digits so the full number cannot be read, for example **** **** **** 4242. People can still recognize which card was used without seeing the number.'],
      ['How many digits of a card number can I show?', 'PCI DSS allows at most the BIN and the last four digits to be displayed to people without a business need to see more. Most apps show only the last four.'],
      ['How can I tell if a number is a credit card number?', 'Check the length (13 to 19 digits), the prefix and the Luhn checksum. A number that passes all three is shaped like a card number, but only the card network can say whether the card exists.'],
      ['Does PasteSafe keep the card numbers it finds?', 'Only in the memory of your browser tab, so it can put them back into an AI reply if you ask it to. Nothing is uploaded or saved, and closing the tab clears it.'],
    ],
    related: ['mask-pii-in-logs', 'mask-sensitive-data-in-logs', 'sanitize-logs-before-sharing'],
  },

  {
    slug: 'share-env-file-safely',
    phrase: 'how to share .env files securely',
    title: 'How to share .env files securely with your team | PasteSafe',
    description: 'Share .env values through a secrets manager, commit a .env.example, and mask credentials when you only need to show the file to an AI, an issue or support.',
    h1: 'How to share .env files securely',
    lead: 'Sharing a <code>.env</code> file can mean two things: giving a teammate the values so the app runs, or showing the file to an AI assistant, an issue or a support ticket to debug it. They need different tools.',
    example: {
      before: `# billing-api, local development
NODE_ENV=development
PORT=3000
ADMIN_USER=admin
S3_BUCKET=acme-billing-exports
DATABASE_URL=postgres://billing:Wint3r-Fake-Pass@localhost:5432/billing
REDIS_URL=redis://:FakeRedisPass42@cache.internal:6379
STRIPE_SECRET_KEY=${STRIPE_TEST}
JWT_SECRET=fake-jwt-signing-secret-9f8a7b
SMTP_PASSWORD=Fake-Smtp-Pass-1
ALERT_EMAIL=ops@example.net`,
      hides: ['Wint3r-Fake-Pass', STRIPE_TEST, 'fake-jwt-signing-secret-9f8a7b', 'Fake-Smtp-Pass-1', 'ops@example.net'],
      keeps: ['NODE_ENV=development', 'PORT=3000', 'ADMIN_USER=admin', 'S3_BUCKET=acme-billing-exports', 'redis://:FakeRedisPass42@cache.internal:6379'],
    },
    body: `
<h2>Do not paste the file into chat or email</h2>
<p>A <code>.env</code> file is a list of working credentials. Sent in Slack, Teams or email, it becomes searchable by everyone with access to that conversation, synced to their phones, kept in backups and exports, and it stays valid until every key in it is rotated. If that already happened, rotate the keys: <a href="/guides/what-to-do-if-you-leaked-an-api-key/">what to do if you leaked an API key</a> covers how.</p>

<h2>Sharing the values with a teammate</h2>
<ul>
<li><strong>Use a secrets manager or a shared password manager vault.</strong> Cloud providers have one (AWS Secrets Manager, Google Cloud Secret Manager, Azure Key Vault), and team password managers have shared vaults. Access is granted per person and can be revoked when someone leaves.</li>
<li><strong>Give each developer their own development keys</strong> where the provider allows it, such as Stripe test mode keys, instead of passing one production key around.</li>
<li><strong>Commit a template with names only</strong>, and keep <code>.env</code> in <code>.gitignore</code>. This command writes a <code>.env.example</code> with the values removed. It also cuts comments that contain an equals sign, so skim the result:</li>
</ul>
${code`sed -E 's/=.*/=/' .env > .env.example`}
<ul>
<li><strong>If a file really has to travel, encrypt it</strong> for the one person who needs it, for example with <a href="https://github.com/FiloSottile/age">age</a> and their public key. They decrypt it with their private key:</li>
</ul>
${code`
age -r <recipient-public-key> -o .env.age .env
age -d -i key.txt -o .env .env.age
`}

<h2>Sharing the shape to debug it</h2>
<p>To ask an AI assistant why the app cannot connect, or to attach the config to an issue, you need the variable names and the harmless values, not the credentials. That is what masking is for. Before highlights what PasteSafe finds, After is its exact output:</p>
%EXAMPLE%
<p>The database password, the Stripe key, the JWT secret, the SMTP password and the email are replaced. <code>NODE_ENV</code>, <code>PORT</code> and the bucket name stay, which is often exactly what the AI needs to see. The Redis URL keeps its password, because there is no user name before the colon. Replace that one by hand.</p>
<ol>
<li>Paste the <code>.env</code> into <a href="/">PasteSafe</a>. It runs in your browser.</li>
<li>Values under names like <code>PASSWORD</code>, <code>SECRET</code>, <code>TOKEN</code>, <code>API_KEY</code> or <code>PRIVATE_KEY</code>, passwords in connection URLs with a user name, and known key formats become placeholders.</li>
<li>Read the result, fix anything left, and copy it.</li>
<li>If the AI answers with placeholders, paste the reply into Put the real values back to see it with your values, still in your browser.</li>
</ol>

<h2>What PasteSafe does not catch in a .env file</h2>
<ul>
<li>Passwords in URLs without a user name, like <code>redis://:password@host</code>.</li>
<li>Short or simple values under neutral names, such as <code>ADMIN_USER=admin</code>.</li>
<li>Hostnames, bucket names and account IDs, which may be internal but are not secrets.</li>
</ul>
`,
    faq: [
      ['Should I commit my .env file to git?', 'No. Add .env to .gitignore and commit a .env.example with the variable names and empty or dummy values. If a .env was already committed, rotate the keys in it and remove it from the history.'],
      ['What is the safest way to share environment variables with a team?', 'A secrets manager or a shared vault in a team password manager, with access per person. You can see who has access and revoke it, which you cannot do with a file sent in chat.'],
      ['Is it safe to send a .env file over Slack?', 'No. The file stays in the channel history, search and exports for as long as the workspace keeps messages, and anyone who can read it can use the keys. Use a secrets manager, or at least encrypt the file for one person.'],
      ['Can I paste my .env into ChatGPT to debug it?', 'Mask it first. With placeholders the AI still sees every variable name and the harmless values like ports and modes, which is usually what the problem is about, but none of the credentials.'],
    ],
    related: ['what-to-do-if-you-leaked-an-api-key', 'remove-secrets-from-git-history', 'is-it-safe-to-paste-code-into-chatgpt'],
  },

  {
    slug: 'is-it-safe-to-share-a-jwt',
    phrase: 'is it safe to share jwt token',
    title: 'Is it safe to share a JWT token in logs or chat? | PasteSafe',
    description: 'A JWT works for whoever holds it until it expires, and anyone can read its payload. Learn where tokens leak, how to decode one locally and how to mask it.',
    h1: 'Is it safe to share a JWT token?',
    lead: 'Not while it is valid. A JWT is usually a bearer credential: whoever holds it can call the API as that user until it expires. And its payload is readable by anyone, even after it expires.',
    example: {
      before: `GET /v1/invoices HTTP/1.1
Host: api.example.com
Authorization: Bearer ${ACCESS_JWT}
Cookie: refresh_token=${REFRESH_JWT}; theme=dark

HTTP/1.1 302 Found
Location: https://app.example.com/callback?id_token=${ID_JWT}&state=af0ifjsldkj

decoded: {"sub":"4821","email":"jane.doe@example.com","role":"admin"}`,
      hides: [ACCESS_JWT, REFRESH_JWT, 'jane.doe@example.com'],
      keeps: [ID_JWT, '"sub":"4821"', '"role":"admin"'],
    },
    body: `
<h2>What a JWT is</h2>
<p>A JSON Web Token is three base64url encoded parts joined by dots: a header, a payload and a signature. The payload typically holds a user ID, often an email address and roles, and an expiry time in the <code>exp</code> claim.</p>
<p>Two properties matter when you are about to paste one somewhere:</p>
<ul>
<li><strong>It works for whoever has it.</strong> An API that accepts a JWT in an <code>Authorization: Bearer</code> header or a cookie does not know who is sending it. A copied token works like the original until it expires, unless the server keeps a list of revoked tokens.</li>
<li><strong>It is signed, not encrypted.</strong> The signature stops anyone from changing the payload, but anyone can read it. An expired token still shows the user's ID, email and roles. Encrypted tokens (JWE) exist, but they are much less common.</li>
</ul>
<p>Refresh tokens are worse: they last longer and can be exchanged for new access tokens.</p>

<h2>Where JWTs leak</h2>
<ul>
<li>Debug logs that print request headers.</li>
<li>HAR files and Copy as cURL output from browser DevTools, which include headers and cookies.</li>
<li>URLs: some sign in flows return tokens in the redirect URL, which can end up in browser history and, when the token is in the query string, in server logs.</li>
<li>Screenshots of DevTools, local storage or cookies.</li>
<li>Bug reports and AI chats where someone pasted the token to ask what is wrong with it.</li>
</ul>

<h2>Decode a JWT without pasting it into a website</h2>
<p>You do not need an online decoder to read the payload. With Node.js or Python:</p>
${code`
node -e "console.log(Buffer.from(process.argv[1].split('.')[1], 'base64url').toString())" "$TOKEN"
python3 -c "import base64,sys; p=sys.argv[1].split('.')[1]; print(base64.urlsafe_b64decode(p + '=' * (-len(p) % 4)).decode())" "$TOKEN"
`}
<p>Both print the payload JSON. Neither checks the signature, which is fine when you only want to read it.</p>

<h2>Mask JWTs before sharing</h2>
<p>Before highlights what PasteSafe finds, After is its exact output:</p>
%EXAMPLE%
<p>The token in the header and the refresh token cookie each get their own placeholder. The token in the redirect URL does not: PasteSafe can miss a JWT in a query string when another parameter follows it, so shorten such URLs by hand. On the decoded payload line only the email is masked. The user ID and role stay, so remove decoded payloads by hand if those matter.</p>
<ol>
<li>Paste the log, request or HAR excerpt into <a href="/">PasteSafe</a>.</li>
<li>JWTs become <code>JWT_1</code>, other Bearer tokens <code>BEARER_TOKEN_1</code>, and values under names like <code>token</code> or <code>secret</code> become <code>SECRET_1</code>.</li>
<li>Read the result and copy it.</li>
</ol>

<h2>If a valid token leaked</h2>
<ul>
<li>Revoke the refresh token and end the session in your identity provider, if it supports that. The access token itself may keep working until it expires.</li>
<li>If tokens cannot be revoked one by one, rotating the signing key is the immediate fix. It invalidates every token signed with that key, so everyone has to sign in again.</li>
<li>Keep access token lifetimes short, so a leaked token stops working soon.</li>
</ul>

<h2>What PasteSafe does not catch</h2>
<ul>
<li>A JWT in a URL query string with another parameter after it, like the redirect URL above.</li>
<li>A JWT split across lines, for example in wrapped log output.</li>
<li>Decoded payloads: user IDs, names and roles in plain JSON.</li>
<li>Opaque session tokens such as a <code>sessionid</code> cookie with a hex value, sent together with other cookies.</li>
</ul>
`,
    faq: [
      ['Is it safe to share a JWT token?', 'Not while it is valid. Anyone who has it can use it until it expires, and anyone can read its payload even after that. Mask it before sharing a log, and share only the decoded claims you need.'],
      ['Can a JWT be decoded without the secret?', 'Yes. The header and payload are only base64url encoded, so anyone can read them. The secret or private key is needed to create a valid signature, not to read the token.'],
      ['Does an expired JWT still expose data?', 'Yes. It no longer grants access, but the payload still shows whatever the issuer put in it, such as the user ID, email address and roles.'],
      ['Can I revoke a JWT?', 'Not on its own. A server accepts a valid JWT until it expires unless it keeps a list of revoked tokens or the signing key is rotated. Revoking the refresh token stops new access tokens from being issued.'],
    ],
    related: ['sanitize-har-file', 'what-to-do-if-you-leaked-an-api-key', 'sanitize-logs-before-sharing'],
  },
];
