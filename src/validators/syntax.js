const validator = require('validator');

function checkSyntax(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'empty_or_invalid_input' };
  }

  const trimmed = email.trim().toLowerCase();

  if (!validator.isEmail(trimmed)) {
    return { valid: false, reason: 'invalid_syntax' };
  }

  // Extra checks validator.isEmail misses
  const [local, domain] = trimmed.split('@');
  if (local.length > 64) {
    return { valid: false, reason: 'local_part_too_long' };
  }
  if (domain.length > 255) {
    return { valid: false, reason: 'domain_too_long' };
  }
  if (trimmed.length > 320) {
    return { valid: false, reason: 'email_too_long' };
  }

  return { valid: true, email: trimmed };
}

module.exports = { checkSyntax };
