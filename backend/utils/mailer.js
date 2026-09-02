import nodemailer from 'nodemailer';

/* ==========================================================================
   Outbound email.

   Everything here is built from environment variables and nothing is assumed.
   If SMTP is not configured the transport is simply absent, and every call
   reports `skipped` rather than throwing — a project running without mail
   credentials should still accept a contact message, not 500 on it.

   What it must never do is report success it did not achieve. `send` returns
   what actually happened, and the caller passes that on to the customer, so a
   screen that says "sent" means sent.

   Required to switch it on:
     SMTP_HOST      smtp.gmail.com, smtp.sendgrid.net, ...
     SMTP_PORT      587 for STARTTLS, 465 for implicit TLS
     SMTP_USER      the mailbox or API user
     SMTP_PASS      its password or API key
   Optional:
     SMTP_FROM      the From address (defaults to SMTP_USER)
     SUPPORT_EMAIL  where contact messages land (defaults to SMTP_USER)
   ========================================================================== */

const cfg = () => ({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
  support: process.env.SUPPORT_EMAIL || process.env.SMTP_USER,
});

export const isMailConfigured = () => {
  const c = cfg();
  return Boolean(c.host && c.user && c.pass);
};

export const supportAddress = () => cfg().support || null;

/* One transport, made on first use. Built lazily rather than at import time so
   the module can be loaded — and the rest of the app can boot — on a machine
   with no mail settings at all. */
let transport = null;
const getTransport = () => {
  if (transport) return transport;
  const c = cfg();
  transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    /* 465 is implicit TLS; 587 and 25 start plain and upgrade with STARTTLS.
       Getting this wrong is the usual cause of a connection that hangs and
       then times out with nothing useful in the log. */
    secure: c.port === 465,
    auth: { user: c.user, pass: c.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transport;
};

/* Returns { ok, skipped, error }. Never throws: a caller's own work has
   usually already succeeded by the time it asks for an email, and losing that
   because a mail server was unreachable would be the worse failure. */
export async function sendMail({ to, subject, text, html, replyTo }) {
  if (!isMailConfigured()) {
    return { ok: false, skipped: true, error: 'SMTP is not configured' };
  }
  if (!to) {
    return { ok: false, skipped: true, error: 'No recipient' };
  }
  try {
    const info = await getTransport().sendMail({
      from: cfg().from,
      to,
      subject,
      text,
      html,
      /* So a reply from support goes to the customer, not into the sending
         mailbox where nobody is watching. */
      ...(replyTo ? { replyTo } : {}),
    });
    return { ok: true, skipped: false, messageId: info.messageId };
  } catch (error) {
    console.error('Email send failed:', error.message);
    return { ok: false, skipped: false, error: error.message };
  }
}

/* Proves the settings actually work, rather than merely being present — the
   difference between "four variables are set" and "mail leaves this machine".
   Used by the admin health check below. */
export async function verifyMail() {
  if (!isMailConfigured()) return { ok: false, skipped: true, error: 'SMTP is not configured' };
  try {
    await getTransport().verify();
    return { ok: true, skipped: false };
  } catch (error) {
    return { ok: false, skipped: false, error: error.message };
  }
}

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* A plain, readable shell. Deliberately not the marketing template — this is
   correspondence, and it has to survive every mail client unstyled. */
export const wrapEmail = (heading, bodyHtml) => `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#16302B;line-height:1.6;max-width:560px">
  <h2 style="color:#005C2E;font-size:18px;margin:0 0 14px">${esc(heading)}</h2>
  ${bodyHtml}
  <p style="margin-top:22px;padding-top:14px;border-top:1px solid #E3EAE7;color:#5B6B66;font-size:12px">
    MoneyPay — Mobile money for South Sudan
  </p>
</div>`;

export const emailEscape = esc;
