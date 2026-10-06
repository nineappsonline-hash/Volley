const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const webhook = read('src/app/webhook/route.ts');
const sessionRoute = read('src/app/api/payments/kashier/route.ts');
const confirmRoute = read('src/app/api/payments/kashier/confirm/route.ts');
const resultPage = read('src/app/payment-result/page.tsx');

// The session verify endpoint keeps a trailing /payment — it was missing, so
// every webhook hit a 404 and returned 503, leaving every order "pending".
assert.match(
  webhook,
  /kashierRequest\(`\/v3\/payment\/sessions\/\$\{encodeURIComponent\(order\.session_id\)\}\/payment`,undefined,\{timeoutMs:8000\}\)/,
  'the webhook reads a session through the documented /:sessionId/payment endpoint'
);
assert.doesNotMatch(
  webhook,
  /kashierRequest\(`\/\$\{encodeURIComponent\(order\.session_id\)\}`,u/,
  'the old /:sessionId (no /payment) endpoint is gone'
);
assert.match(
  sessionRoute,
  /kashierRequest\('\/v3\/payment\/sessions',\{merchantId:/,
  'creating a session still posts to /v3/payment/sessions'
);

// Settlement must not depend on the session read: a signed webhook is the
// authority, and the read returns {message,data} or 404 for purged sessions.
const settleAt = webhook.indexOf("db.rpc('settle_kashier_order'");
const readAt = webhook.indexOf('/payment`,undefined');
assert.ok(settleAt !== -1, 'the webhook calls settle_kashier_order');
assert.ok(readAt !== -1 && readAt > settleAt, 'settlement runs before the audit read');
assert.doesNotMatch(
  webhook.slice(settleAt, webhook.indexOf('return new Response(null,{status:200})')),
  /return /,
  'the audit read only logs; a slow or unreadable session must not prevent settlement'
);
assert.doesNotMatch(webhook, /session\.status!=='PAID'/, 'no shape-locked status gate remains');
assert.match(webhook, /p_transaction:String\(data\.transactionId\)/, 'the signed transaction id is what is recorded');
assert.match(webhook, /p_amount:data\.amount,p_currency:data\.currency/, 'the signed amount and currency are passed through');

// The return landing page reconciles a payment whose webhook was lost, but
// only after Kashier itself confirms the session is paid.
assert.ok(fs.existsSync(path.join(root, 'src/app/api/payments/kashier/confirm/route.ts')), 'confirm route exists');
assert.match(confirmRoute, /order\.user_id!==user\.id/, 'a user can only reconcile their own order');
assert.match(confirmRoute, /PAID_TRANSACTION_STATUSES/, 'reconciliation requires a paid session');
assert.match(confirmRoute, /if\(!transactionId\)return/i, 'it never settles without a transaction id from Kashier');
assert.match(confirmRoute, /db\.rpc\('settle_kashier_order'/, 'it settles through the same idempotent RPC');
assert.match(
  confirmRoute.split("db.rpc('settle_kashier_order'")[0],
  /\/v3\/payment\/sessions\/\$\{encodeURIComponent\(order\.session_id\)\}\/payment/,
  'it verifies the session via the documented endpoint'
);
assert.match(resultPage, /\/api\/payments\/kashier\/confirm/, 'the status page triggers reconciliation when stuck pending');
assert.match(resultPage, /if\(j\?\.status==='paid'\)\{setStatus\('paid'\);return;\}/, 'it stops polling once reconciled');

console.log('PASS: Kashier webhooks use the correct endpoint and never block settlement');
console.log('PASS: a lost webhook is reconciled from the return landing page, guarded by Kashier proof');