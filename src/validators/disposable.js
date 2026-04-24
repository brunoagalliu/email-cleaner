const disposableDomains = new Set(require('disposable-email-domains'));

// Additional domains not always in the package
const extraBlocklist = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
  'spam4.me', 'trashmail.at', 'trashmail.io', 'trashmail.me', 'trashmail.net',
  'yopmail.com', 'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc',
  'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf', 'moncourrier.fr.nf',
  'monemail.fr.nf', 'monmail.fr.nf', 'dispostable.com', 'maildrop.cc',
  'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org', 'tempr.email',
  'discard.email', 'spamhereplease.com', 'spamthisplease.com',
]);

function checkDisposable(email) {
  const domain = email.split('@')[1];
  const isDisposable = disposableDomains.has(domain) || extraBlocklist.has(domain);
  return {
    valid: !isDisposable,
    reason: isDisposable ? 'disposable_email' : null,
  };
}

module.exports = { checkDisposable };
