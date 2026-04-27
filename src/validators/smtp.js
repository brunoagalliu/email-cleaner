const SMTP_URL = process.env.SMTP_CHECKER_URL;
const SMTP_SECRET = process.env.SMTP_CHECKER_SECRET;

// Domains known to block SMTP probes and return false positives
const SMTP_BLOCKED_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.es', 'hotmail.it',
  'outlook.com', 'outlook.co.uk', 'outlook.fr', 'outlook.de', 'outlook.es',
  'live.com', 'live.co.uk', 'live.fr', 'live.de', 'live.nl',
  'msn.com',
  'icloud.com', 'me.com', 'mac.com',
]);

// Group emails by domain and call the SMTP checker in one request per domain
async function smtpCheckBatch(emails) {
  if (!SMTP_URL || !SMTP_SECRET) {
    return {};
  }

  // Group by domain — skip known-blocked domains
  const byDomain = {};
  const results = {};

  for (const email of emails) {
    const domain = email.split('@')[1];
    if (!domain) continue;
    if (SMTP_BLOCKED_DOMAINS.has(domain)) {
      results[email] = 'unknown'; // blocked provider — can't reliably check
      continue;
    }
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain].push(email);
  }

  await Promise.all(
    Object.entries(byDomain).map(async ([domain, domainEmails]) => {
      try {
        const res = await fetch(`${SMTP_URL}/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-secret': SMTP_SECRET,
          },
          body: JSON.stringify({ domain, emails: domainEmails }),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.results) {
          for (const [email, status] of Object.entries(data.results)) {
            results[email] = status; // 'valid', 'invalid', 'catch-all'
          }
        } else {
          // Checker returned an error for this domain
          for (const email of domainEmails) {
            results[email] = 'unknown';
          }
        }
      } catch {
        for (const email of domainEmails) {
          results[email] = 'unknown';
        }
      }
    })
  );

  return results;
}

module.exports = { smtpCheckBatch };
