const dns = require('dns').promises;

const cache = new Map();

async function checkMX(email) {
  const domain = email.split('@')[1];

  if (cache.has(domain)) {
    return cache.get(domain);
  }

  try {
    const records = await dns.resolveMx(domain);
    const result = records && records.length > 0
      ? { valid: true }
      : { valid: false, reason: 'no_mx_records' };
    cache.set(domain, result);
    return result;
  } catch (err) {
    let reason = 'dns_lookup_failed';
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      reason = 'domain_not_found';
    }
    const result = { valid: false, reason };
    cache.set(domain, result);
    return result;
  }
}

module.exports = { checkMX };
