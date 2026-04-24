const mailcheck = require('mailcheck');

// Common domains and TLDs mailcheck uses for suggestions
const DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'msn.com', 'live.com', 'me.com', 'mac.com',
  'comcast.net', 'att.net', 'verizon.net', 'sbcglobal.net', 'cox.net',
  'earthlink.net', 'charter.net', 'bellsouth.net', 'optonline.net',
  'mail.com', 'protonmail.com', 'proton.me', 'pm.me',
  'zoho.com', 'yandex.com', 'gmx.com', 'gmx.net',
];

const SECOND_LEVEL_DOMAINS = [
  'gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'aol', 'msn',
  'live', 'comcast', 'att', 'verizon', 'protonmail', 'zoho', 'yandex', 'gmx',
];

const TOP_LEVEL_DOMAINS = ['com', 'net', 'org', 'edu', 'gov', 'io', 'co', 'me'];

function checkTypo(email) {
  return new Promise((resolve) => {
    mailcheck.run({
      email,
      domains: DOMAINS,
      secondLevelDomains: SECOND_LEVEL_DOMAINS,
      topLevelDomains: TOP_LEVEL_DOMAINS,
      suggested(suggestion) {
        resolve({
          hasTypo: true,
          suggestion: suggestion.full,
          reason: 'possible_typo',
        });
      },
      empty() {
        resolve({ hasTypo: false, suggestion: null });
      },
    });
  });
}

module.exports = { checkTypo };
