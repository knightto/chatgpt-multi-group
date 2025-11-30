const { Resend } = require('resend');
const Subscriber = require('../models/Subscriber');

const resendApiKey = process.env.RESEND_API_KEY || null;
const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

let resend = null;
if (resendApiKey) {
  resend = new Resend(resendApiKey);
} else {
  console.warn('RESEND_API_KEY missing; email sends will be logged but not sent.');
}

async function sendEmail(to, subject, html) {
  if (!resend) {
    console.log('[EMAIL-LOG]', { to, subject });
    return { ok: false, skipped: true };
  }

  try {
    const result = await resend.emails.send({
      from: 'tee-times@mg.example.com',
      to,
      subject,
      html
    });
    return { ok: true, result };
  } catch (err) {
    console.error('Error sending email via Resend:', err);
    return { ok: false, error: err.message };
  }
}

function frameEmail(title, bodyHtml) {
  return `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding:16px;">
      <h2 style="color:#14532d;">${title}</h2>
      <div>${bodyHtml}</div>
      <hr style="margin:24px 0;">
      <p style="font-size:12px;color:#6b7280;">
        Sent by Multi-Group Tee Times • <a href="${siteUrl}" style="color:#2563eb;">Visit site</a>
      </p>
    </div>
  `;
}

async function sendEmailToSubscribers(groupId, subject, bodyHtml) {
  const subs = await Subscriber.find({ groupId });
  if (!subs.length) return { ok: true, sent: 0 };

  let sent = 0;
  for (const sub of subs) {
    const html = frameEmail(subject, `
      ${bodyHtml}
      <p style="margin-top:16px;font-size:12px;">
        To unsubscribe, click
        <a href="${siteUrl}/unsubscribe/${encodeURIComponent(sub.unsubscribeToken)}">here</a>.
      </p>
    `);

    const result = await sendEmail(sub.email, subject, html);
    if (result.ok && !result.skipped) sent++;
  }
  return { ok: true, sent };
}

async function sendAdminEmail(subject, html) {
  const env = process.env.ADMIN_EMAILS || '';
  const emails = env.split(',').map(s => s.trim()).filter(Boolean);
  if (!emails.length) {
    console.warn('ADMIN_EMAILS not set; skipping admin email.');
    return { ok: false, sent: 0 };
  }
  let sent = 0;
  for (const e of emails) {
    const result = await sendEmail(e, subject, frameEmail(subject, html));
    if (result.ok && !result.skipped) sent++;
  }
  return { ok: true, sent };
}

module.exports = {
  sendEmail,
  sendEmailToSubscribers,
  sendAdminEmail,
  frameEmail
};
