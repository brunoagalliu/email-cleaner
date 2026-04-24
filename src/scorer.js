// Score weights — deductions per issue
const DEDUCTIONS = {
  invalid_syntax:      100,
  empty_or_invalid_input: 100,
  local_part_too_long: 100,
  domain_too_long:     100,
  email_too_long:      100,
  domain_not_found:    100,
  no_mx_records:        80,
  dns_lookup_failed:    40,
  disposable_email:     90,
  role_based_email:     30,
  possible_typo:        20,
};

// Status thresholds
function getStatus(score) {
  if (score >= 80) return 'valid';
  if (score >= 50) return 'risky';
  if (score >= 1)  return 'invalid';
  return 'invalid';
}

function scoreResult(checks) {
  let score = 100;
  const reasons = [];

  for (const check of checks) {
    if (check.reason && DEDUCTIONS[check.reason] !== undefined) {
      score -= DEDUCTIONS[check.reason];
      reasons.push(check.reason);
    }
  }

  score = Math.max(0, score);

  return {
    score,
    status: getStatus(score),
    reasons: reasons.join(', '),
  };
}

module.exports = { scoreResult };
