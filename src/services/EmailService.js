import nodemailer from 'nodemailer';

const REQUIRED_ENV = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS'];
const failureLog = { count: 0, limit: 2 };

class EmailService {
  /**
   * Three modes, decided once at boot:
   * - smtp:    EMAIL_HOST + EMAIL_USER + EMAIL_PASS all set → real delivery.
   * - preview: no credentials, development → Ethereal test inbox. Messages are really
   *            sent and a preview URL is logged, so the flows can be exercised end to end
   *            without a mailbox. Disable with EMAIL_DEV_PREVIEW=false.
   * - disabled: production without credentials. Nothing is sent and nothing throws.
   *
   * Passing `auth` with an empty user/pass is what produced "Missing credentials for
   * PLAIN" for every recipient, so the transport is only created when credentials exist.
   */
  constructor() {
    this.transporter = null;
    this.previewAccount = null;
    this.missing = REQUIRED_ENV.filter((key) => !String(process.env[key] || '').trim());
    const isProduction = process.env.NODE_ENV === 'production';
    const previewAllowed = String(process.env.EMAIL_DEV_PREVIEW || '').toLowerCase() !== 'false';

    if (!this.missing.length) {
      this.mode = 'smtp';
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      console.log(`Email: sending through ${process.env.EMAIL_HOST} as ${process.env.EMAIL_USER}.`);
      return;
    }

    if (!isProduction && previewAllowed) {
      this.mode = 'preview';
      console.log(
        `Email: ${this.missing.join(', ')} not set, so messages go to an Ethereal test inbox ` +
        'and a preview link is logged for each one. Fill those in .env to send for real.'
      );
      return;
    }

    this.mode = 'disabled';
    console.warn(
      `Email delivery is disabled: ${this.missing.join(', ')} not set. ` +
      'In-app notifications and task creation are unaffected.'
    );
  }

  isConfigured() {
    return this.mode !== 'disabled';
  }

  /** Ethereal account is created lazily, so a slow network never delays boot. */
  async transporterFor() {
    if (this.transporter) return this.transporter;
    if (this.mode !== 'preview') return null;

    if (!this.previewAccount) {
      this.previewAccount = await nodemailer.createTestAccount();
    }

    this.transporter = nodemailer.createTransport({
      host: this.previewAccount.smtp.host,
      port: this.previewAccount.smtp.port,
      secure: this.previewAccount.smtp.secure,
      auth: { user: this.previewAccount.user, pass: this.previewAccount.pass }
    });
    return this.transporter;
  }

  fromAddress() {
    const explicit = String(process.env.EMAIL_FROM || '').trim();
    if (explicit) return `"Rwanda Task Management" <${explicit}>`;
    if (this.mode === 'smtp') return `"Rwanda Task Management" <${process.env.EMAIL_USER}>`;
    return '"Rwanda Task Management" <no-reply@rtms.local>';
  }

  async send({ to, subject, html }) {
    let transporter = null;
    try {
      transporter = await this.transporterFor();
    } catch (error) {
      this.logFailure(`could not open a mail transport (${error.message})`);
      return { skipped: true, reason: 'EMAIL_TRANSPORT_UNAVAILABLE', error: error.message };
    }

    if (!transporter) {
      // Callers treat a resolved send as "notified"; skipping is the documented
      // behaviour when no mail server is available.
      return { skipped: true, reason: 'EMAIL_NOT_CONFIGURED' };
    }

    try {
      const info = await transporter.sendMail({ from: this.fromAddress(), to, subject, html });
      if (this.mode === 'preview') {
        const url = nodemailer.getTestMessageUrl(info);
        if (url) console.log(`Email preview for ${to}: ${url}`);
      }
      return info;
    } catch (error) {
      // A failed notification must never break the action that triggered it, and it must
      // not flood the log once per recipient. Two lines, then quiet.
      this.logFailure(`${to}: ${error.message}`);
      return { skipped: true, reason: 'EMAIL_SEND_FAILED', error: error.message };
    }
  }

  logFailure(detail) {
    failureLog.count += 1;
    if (failureLog.count <= failureLog.limit) {
      console.warn(`Email not sent (${detail})${failureLog.count === failureLog.limit ? ' — further failures will be silent' : ''}`);
    }
  }


  async sendOrganizationApproved(organization, code, credentials = null) {
    const credentialsHtml = credentials ? `
      <div style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:16px;margin:16px 0;border-radius:4px">
        <p style="margin:0;font-weight:bold;color:#2e7d32">Your Admin Login Credentials</p>
        <p style="margin:8px 0 0"><strong>Email:</strong> ${credentials.email}</p>
        <p style="margin:4px 0 0"><strong>Temporary Password:</strong> <code style="background:#f5f5f5;padding:2px 6px;border-radius:3px">${credentials.password}</code></p>
        <p style="margin:8px 0 0;font-size:12px;color:#666">Please change your password after first login.</p>
      </div>` : '';

    return this.send({
      to: organization.contact_email,
      subject: 'Organization Approved – Your Access Code & Login Details',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
          <div style="background:#003366;padding:24px;text-align:center">
            <h1 style="color:#C9A227;margin:0">Rwanda Task Management</h1>
          </div>
          <div style="padding:32px">
            <h2 style="color:#003366">Congratulations! Your Organization Has Been Approved</h2>
            <p>Dear <strong>${organization.name}</strong>,</p>
            <p>Your organization has been reviewed and approved by the District Administrator.</p>
            <div style="background:#f5f5f5;border-left:4px solid #C9A227;padding:16px;margin:24px 0;border-radius:4px">
              <p style="margin:0;font-size:14px;color:#666">Your Organization Access Code</p>
              <p style="margin:8px 0 0;font-size:32px;font-weight:bold;color:#003366;letter-spacing:4px">${code}</p>
            </div>
            <p>Share this code with your teachers and students so they can join your organization.</p>
            ${credentialsHtml}
            <p style="color:#888;font-size:12px">Keep this code secure. Do not share it publicly.</p>
          </div>
        </div>
      `
    });
  }

  async sendOrganizationRejected(organization, reason) {
    return this.send({
      to: organization.contact_email,
      subject: 'Organization Registration Update',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
          <div style="background:#003366;padding:24px;text-align:center">
            <h1 style="color:#C9A227;margin:0">Rwanda Task Management</h1>
          </div>
          <div style="padding:32px">
            <h2 style="color:#c0392b">Registration Not Approved</h2>
            <p>Dear <strong>${organization.name}</strong>,</p>
            <p>After review, your organization registration was not approved.</p>
            <div style="background:#fff5f5;border-left:4px solid #c0392b;padding:16px;margin:24px 0;border-radius:4px">
              <p style="margin:0;font-weight:bold">Reason:</p>
              <p style="margin:8px 0 0">${reason}</p>
            </div>
            <p>You may re-apply after addressing the issues mentioned above.</p>
          </div>
        </div>
      `
    });
  }

  async sendTaskAssigned(user, task) {
    return this.send({
      to: user.email,
      subject: `New Task: ${task.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
          <div style="background:#003366;padding:24px;text-align:center">
            <h1 style="color:#C9A227;margin:0">Rwanda Task Management</h1>
          </div>
          <div style="padding:32px">
            <h2 style="color:#003366">New Task Assigned</h2>
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>A new task has been assigned to you:</p>
            <div style="background:#f5f5f5;padding:16px;border-radius:4px;margin:16px 0">
              <p><strong>Title:</strong> ${task.title}</p>
              <p><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
              <p><strong>Priority:</strong> ${task.priority}</p>
            </div>
            <p>Log in to your dashboard to view and submit this task.</p>
          </div>
        </div>
      `
    });
  }

  async sendTaskReminder(user, task, hoursLeft) {
    return this.send({
      to: user.email,
      subject: `Reminder: "${task.title}" due in ${hoursLeft} hours`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
          <div style="background:#C9A227;padding:24px;text-align:center">
            <h1 style="color:#003366;margin:0">⏰ Task Reminder</h1>
          </div>
          <div style="padding:32px">
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>This is a reminder that your task is due soon:</p>
            <div style="background:#fff8e1;border-left:4px solid #C9A227;padding:16px;border-radius:4px;margin:16px 0">
              <p><strong>${task.title}</strong></p>
              <p>Due in <strong>${hoursLeft} hours</strong></p>
            </div>
            <p>Please submit before the deadline to avoid late penalties.</p>
          </div>
        </div>
      `
    });
  }
}

export default new EmailService();
