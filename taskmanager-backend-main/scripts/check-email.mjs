/**
 * Diagnoses the mail configuration and, when credentials are complete, sends a real
 * test message.
 *
 *   npm run email:check
 *   npm run email:check -- you@example.com     # send the test to a specific address
 *
 * Prints the exact reason mail would not be delivered, instead of leaving it to be
 * inferred from "Missing credentials for PLAIN" during a task publish.
 */
import 'dotenv/config';
import nodemailer from 'nodemailer';

const HOST = String(process.env.EMAIL_HOST || '').trim();
const PORT = parseInt(process.env.EMAIL_PORT) || 587;
const USER = String(process.env.EMAIL_USER || '').trim();
const PASS = String(process.env.EMAIL_PASS || '').trim();
const FROM = String(process.env.EMAIL_FROM || '').trim() || USER;
const TEST_TO = String(process.argv[2] || USER || '').trim();

const line = (label, value) => console.log(`${label.padEnd(14)} ${value}`);

console.log('\nRTMS mail configuration\n-----------------------');
line('NODE_ENV', process.env.NODE_ENV || '(unset)');
line('EMAIL_HOST', HOST || '(unset)');
line('EMAIL_PORT', String(PORT));
line('EMAIL_USER', USER ? `${USER.slice(0, 3)}${'*'.repeat(Math.max(0, USER.length - 3))}` : '(unset)');
line('EMAIL_PASS', PASS ? `set (${PASS.length} characters)` : '(unset)');
line('EMAIL_FROM', FROM || '(falls back to EMAIL_USER)');

const missing = [
  !HOST && 'EMAIL_HOST',
  !USER && 'EMAIL_USER',
  !PASS && 'EMAIL_PASS',
].filter(Boolean);

if (missing.length) {
  console.log(`\nRESULT: mail would not be delivered for real — missing ${missing.join(', ')}.`);
  console.log('        The API falls back to the Ethereal test inbox in development');
  console.log('        (preview links in the log) and sends nothing in production.');

  if (missing.includes('EMAIL_PASS') || missing.includes('EMAIL_USER')) {
    console.log('\nGmail note: EMAIL_PASS must be a 16-character App Password, not the normal');
    console.log('account password, and 2-Step Verification must be enabled to create one:');
    console.log('  https://myaccount.google.com/apppasswords');
  }
  process.exit(1);
}

if (!TEST_TO) {
  console.log('\nRESULT: credentials present, but no recipient to test with.');
  console.log('        Run: npm run email:check -- you@example.com');
  process.exit(1);
}

const transporter = nodemailer.createTransport({ host: HOST, port: PORT, secure: false, auth: { user: USER, pass: PASS } });

try {
  await transporter.verify();
  line('SMTP verify', 'connection + authentication OK');
} catch (error) {
  console.log(`\nRESULT: SMTP connection/authentication failed — ${error.message}`);
  process.exit(1);
}

try {
  const info = await transporter.sendMail({
    from: `"Rwanda Task Management" <${FROM}>`,
    to: TEST_TO,
    subject: 'RTMS mail configuration test',
    html: '<p>This message confirms that RTMS can send email through your SMTP settings.</p>',
  });
  console.log(`\nRESULT: test message accepted for ${TEST_TO}`);
  line('Message id', info.messageId);
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) line('Preview', preview);
} catch (error) {
  console.log(`\nRESULT: sending failed — ${error.message}`);
  process.exit(1);
}
