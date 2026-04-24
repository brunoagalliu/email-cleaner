const cache = new Map();

const DOH_URL = 'https://dns.google/resolve';

async function checkMX(email) {
  const domain = email.split('@')[1];

  if (cache.has(domain)) {
    return cache.get(domain);
  }

  let result;
  try {
    const res = await fetch(`${DOH_URL}?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);

    const data = await res.json();

    // Status 0 = NOERROR, 3 = NXDOMAIN
    if (data.Status === 3) {
      result = { valid: false, reason: 'domain_not_found' };
    } else if (data.Status !== 0 || !data.Answer?.length) {
      result = { valid: false, reason: 'no_mx_records' };
    } else {
      result = { valid: true };
    }
  } catch (err) {
    result = { valid: false, reason: 'dns_lookup_failed' };
  }

  cache.set(domain, result);
  return result;
}

async function warmDomainCache(domains, concurrency = 50) {
  const unique = [...new Set(domains)].filter(d => !cache.has(d));
  for (let i = 0; i < unique.length; i += concurrency) {
    await Promise.all(unique.slice(i, i + concurrency).map(domain =>
      checkMX(`x@${domain}`)
    ));
  }
}

module.exports = { checkMX, warmDomainCache };
