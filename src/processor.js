const { checkSyntax } = require('./validators/syntax');
const { checkMX, warmDomainCache } = require('./validators/dns');
const { checkDisposable } = require('./validators/disposable');
const { checkRoleEmail } = require('./validators/roleEmail');
const { checkTypo } = require('./validators/typo');
const { scoreResult } = require('./scorer');

async function validateEmail(rawEmail) {
  const checks = [];

  const syntaxResult = checkSyntax(rawEmail);
  if (!syntaxResult.valid) {
    checks.push(syntaxResult);
    const { score, status, reasons } = scoreResult(checks);
    return {
      original: rawEmail,
      email: rawEmail?.trim().toLowerCase() || '',
      score,
      status,
      reasons,
      suggestion: '',
    };
  }

  const email = syntaxResult.email;

  const disposableResult = checkDisposable(email);
  const roleResult = checkRoleEmail(email);

  if (!disposableResult.valid) checks.push(disposableResult);
  if (!roleResult.valid) checks.push(roleResult);

  // MX is a cache hit after pre-warming; run with typo check in parallel
  const [mxResult, typoResult] = await Promise.all([
    checkMX(email),
    checkTypo(email),
  ]);

  if (!mxResult.valid) checks.push(mxResult);
  if (typoResult.hasTypo) checks.push({ reason: 'possible_typo' });

  const { score, status, reasons } = scoreResult(checks);

  return {
    original: rawEmail,
    email,
    score,
    status,
    reasons,
    suggestion: typoResult.suggestion || '',
  };
}

async function processEmails(emails, { concurrency = 50, onProgress } = {}) {
  // Phase 1: resolve all unique domains in parallel before touching emails.
  // This fills the cache so every MX check below is an instant lookup.
  const validEmails = emails.filter(e => e && e.includes('@'));
  const domains = validEmails.map(e => e.trim().toLowerCase().split('@')[1]).filter(Boolean);
  await warmDomainCache(domains, concurrency);

  // Phase 2: validate all emails (MX checks are now cache hits)
  const results = [];
  let completed = 0;

  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(validateEmail));
    results.push(...batchResults);
    completed += batch.length;
    if (onProgress) onProgress(completed, emails.length);
  }

  return results;
}

module.exports = { validateEmail, processEmails };
