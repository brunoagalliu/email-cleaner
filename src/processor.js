const { checkSyntax } = require('./validators/syntax');
const { checkMX, warmDomainCache } = require('./validators/dns');
const { checkDisposable } = require('./validators/disposable');
const { checkRoleEmail } = require('./validators/roleEmail');
const { checkTypo } = require('./validators/typo');
const { smtpCheckBatch } = require('./validators/smtp');
const { scoreResult } = require('./scorer');

async function validateEmail(rawEmail, smtpResults = {}) {
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
      smtp_status: 'skipped',
    };
  }

  const email = syntaxResult.email;

  const disposableResult = checkDisposable(email);
  const roleResult = checkRoleEmail(email);

  if (!disposableResult.valid) checks.push(disposableResult);
  if (!roleResult.valid) checks.push(roleResult);

  const [mxResult, typoResult] = await Promise.all([
    checkMX(email),
    checkTypo(email),
  ]);

  if (!mxResult.valid) checks.push(mxResult);
  if (typoResult.hasTypo) checks.push({ reason: 'possible_typo' });

  // Apply SMTP result if available
  const smtpStatus = smtpResults[email] || 'skipped';
  if (smtpStatus === 'invalid') checks.push({ reason: 'smtp_invalid' });
  if (smtpStatus === 'catch-all') checks.push({ reason: 'smtp_catch_all' });

  const { score, status, reasons } = scoreResult(checks);

  return {
    original: rawEmail,
    email,
    score,
    status,
    reasons,
    suggestion: typoResult.suggestion || '',
    smtp_status: smtpStatus,
  };
}

async function processEmails(emails, { concurrency = 50, smtpCheck = false, onProgress } = {}) {
  // Phase 1: pre-warm DNS cache for all unique domains
  const validEmails = emails.filter(e => e && e.includes('@'));
  const domains = validEmails.map(e => e.trim().toLowerCase().split('@')[1]).filter(Boolean);
  await warmDomainCache(domains, concurrency);

  // Phase 2: SMTP batch check (optional)
  let smtpResults = {};
  if (smtpCheck) {
    const syntaxValid = validEmails.filter(e => {
      const r = checkSyntax(e);
      return r.valid;
    }).map(e => e.trim().toLowerCase());
    smtpResults = await smtpCheckBatch(syntaxValid);
  }

  // Phase 3: validate all emails
  const results = [];
  let completed = 0;

  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(e => validateEmail(e, smtpResults)));
    results.push(...batchResults);
    completed += batch.length;
    if (onProgress) onProgress(completed, emails.length);
  }

  return results;
}

module.exports = { validateEmail, processEmails };
