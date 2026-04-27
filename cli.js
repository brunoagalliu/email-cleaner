#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { loadFile, writeResults } = require('./src/csvHandler');
const { processEmails } = require('./src/processor');

program
  .name('email-cleaner')
  .description('Clean and validate email lists from CSV or TXT files')
  .version('1.0.0');

program
  .command('clean <file>')
  .description('Clean an email list file (CSV or TXT)')
  .option('-o, --output <path>', 'Output file path (default: <input>_cleaned.csv)')
  .option('-c, --concurrency <number>', 'Parallel DNS lookups', '20')
  .option('--min-score <number>', 'Minimum score to keep (0-100)', '50')
  .option('--filter', 'Only output emails that pass the min-score threshold')
  .option('--smtp', 'Enable SMTP verification (requires SMTP_CHECKER_URL and SMTP_CHECKER_SECRET env vars)')
  .action(async (file, options) => {
    const inputPath = path.resolve(file);

    if (!fs.existsSync(inputPath)) {
      console.error(chalk.red(`File not found: ${inputPath}`));
      process.exit(1);
    }

    const outputPath = options.output
      ? path.resolve(options.output)
      : inputPath.replace(/(\.[^.]+)$/, '_cleaned.csv');

    const minScore = parseInt(options.minScore, 10);
    const concurrency = parseInt(options.concurrency, 10);

    console.log(chalk.cyan('\n Email Cleaner'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.gray(`Input:       ${inputPath}`));
    console.log(chalk.gray(`Output:      ${outputPath}`));
    console.log(chalk.gray(`Min score:   ${minScore}`));
    console.log(chalk.gray(`Concurrency: ${concurrency}`));
    console.log(chalk.gray('─'.repeat(40)) + '\n');

    console.log(chalk.yellow('Loading file...'));
    const { emails, columnName } = await loadFile(inputPath);

    if (emails.length === 0) {
      console.error(chalk.red('No emails found in file.'));
      process.exit(1);
    }

    console.log(chalk.yellow(`Found ${emails.length} email(s). Starting validation...\n`));

    const startTime = Date.now();
    let lastPct = -1;

    const results = await processEmails(
      emails.map(e => e.email),
      {
        concurrency,
        smtpCheck: !!options.smtp,
        onProgress(done, total) {
          const pct = Math.floor((done / total) * 100);
          if (pct !== lastPct) {
            process.stdout.write(`\r  Progress: ${chalk.cyan(pct + '%')} (${done}/${total})`);
            lastPct = pct;
          }
        },
      }
    );

    console.log('\n');

    // Stats
    const valid   = results.filter(r => r.status === 'valid').length;
    const risky   = results.filter(r => r.status === 'risky').length;
    const invalid = results.filter(r => r.status === 'invalid').length;
    const typos   = results.filter(r => r.suggestion).length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.green(`  Valid:    ${valid}`));
    console.log(chalk.yellow(`  Risky:    ${risky}`));
    console.log(chalk.red(`  Invalid:  ${invalid}`));
    if (typos > 0) console.log(chalk.magenta(`  Typos:    ${typos} (see suggestion column)`));
    console.log(chalk.gray(`  Time:     ${elapsed}s`));
    console.log(chalk.gray('─'.repeat(40)));

    const outputRows = options.filter
      ? results.filter(r => r.score >= minScore)
      : results;

    const originalRows = emails.map(e => e.row);
    await writeResults(outputRows, outputPath, options.filter ? null : originalRows);

    console.log(chalk.green(`\nSaved ${outputRows.length} rows to: ${outputPath}\n`));
  });

program
  .command('check <email>')
  .description('Validate a single email address')
  .action(async (email) => {
    const { validateEmail } = require('./src/processor');
    console.log(chalk.cyan(`\nChecking: ${email}\n`));
    const result = await validateEmail(email);

    const statusColor = result.status === 'valid' ? chalk.green
      : result.status === 'risky' ? chalk.yellow
      : chalk.red;

    console.log(`  Status:     ${statusColor(result.status.toUpperCase())}`);
    console.log(`  Score:      ${result.score}/100`);
    if (result.reasons) console.log(`  Issues:     ${chalk.gray(result.reasons)}`);
    if (result.suggestion) console.log(`  Suggestion: ${chalk.magenta(result.suggestion)}`);
    console.log();
  });

program.parse(process.argv);
