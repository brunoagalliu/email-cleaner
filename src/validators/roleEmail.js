const ROLE_PREFIXES = new Set([
  'admin', 'administrator', 'webmaster', 'hostmaster', 'postmaster',
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'info', 'information', 'contact', 'support', 'help', 'helpdesk',
  'sales', 'marketing', 'billing', 'accounts', 'accounting',
  'hr', 'jobs', 'careers', 'recruitment', 'hiring',
  'abuse', 'security', 'privacy', 'legal', 'compliance',
  'root', 'daemon', 'mailer', 'mailer-daemon', 'bounce', 'bounces',
  'newsletter', 'notifications', 'alerts', 'updates', 'news',
  'team', 'office', 'hello', 'hi', 'media', 'press', 'pr',
  'enquiries', 'enquiry', 'general', 'service', 'services',
]);

function checkRoleEmail(email) {
  const local = email.split('@')[0].toLowerCase();
  const isRole = ROLE_PREFIXES.has(local);
  return {
    valid: !isRole,
    reason: isRole ? 'role_based_email' : null,
  };
}

module.exports = { checkRoleEmail };
