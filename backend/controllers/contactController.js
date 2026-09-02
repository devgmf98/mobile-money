import { Op } from 'sequelize';
import ContactMessage from '../models/ContactMessage.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
/* `esc`, not `e` — there is a `catch (e)` in this file and a one-letter
   escape helper shadowed by an error object is a bug waiting to be written. */
import { sendMail, isMailConfigured, supportAddress, wrapEmail, verifyMail, emailEscape as esc } from '../utils/mailer.js';

/* ==========================================================================
   Contact Us.

   One public endpoint to send a message, and three behind admin auth to read
   and work through them.

   Nothing here trusts the form for identity. A signed-in sender is recorded
   from their token; the name and email they typed are kept as what they said,
   not as who they are.
   ========================================================================== */

const SUBJECTS = ['general', 'transaction', 'account', 'agent', 'complaint', 'other'];

const SUBJECT_LABELS = {
  general: 'General enquiry',
  transaction: 'A transaction',
  account: 'My account',
  agent: 'Becoming an agent',
  complaint: 'A complaint',
  other: 'Something else',
};

/* Deliberately permissive. The point is to catch a typo, not to adjudicate
   what a valid address looks like — RFC 5322 allows more than any short
   pattern admits, and turning away a real customer costs more than storing
   one bad address. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

export const submitContactMessage = async (req, res) => {
  try {
    const name = clean(req.body.name, 120);
    const email = clean(req.body.email, 160).toLowerCase();
    const phone = clean(req.body.phone, 40);
    const message = clean(req.body.message, 4000);
    const subject = SUBJECTS.includes(req.body.subject) ? req.body.subject : 'general';

    const missing = [];
    if (!name) missing.push('name');
    if (!email) missing.push('email');
    if (!message) missing.push('message');
    if (missing.length) {
      return res.status(400).json({ message: 'Please fill in your ' + missing.join(', ') + '.' });
    }
    if (!LOOKS_LIKE_EMAIL.test(email)) {
      return res.status(400).json({ message: 'That email address does not look right.' });
    }
    if (message.length < 10) {
      return res.status(400).json({ message: 'Please say a little more so we can help.' });
    }

    /* One person hammering the form should not be able to bury the inbox.
       Three in five minutes from the same address is generous for a human and
       tedious for anything else. */
    const recent = await ContactMessage.count({
      where: {
        email,
        createdAt: { [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (recent >= 3) {
      return res.status(429).json({
        message: 'We already have your last message. Give us a moment to read it before sending another.',
      });
    }

    const record = await ContactMessage.create({
      name,
      email,
      phone: phone || null,
      subject,
      message,
      /* From the token when there is one — never from the body, which anyone
         could set to any id they liked. */
      userId: req.userId || null,
      status: 'new',
    });

    /* Raise it where admins already look. With no mail transport configured,
       an in-app notification is the difference between a message arriving and
       a message sitting in a table nobody opens. Failing to notify must not
       fail the send: the customer's message is already safely stored. */
    try {
      /* Sub-admins answer these too, so they are told about them. Notifying
         only admins would have left the people actually working the queue to
         discover new messages by refreshing the page. */
      const admins = await User.findAll({
        where: { role: { [Op.in]: ['admin', 'sub-admin'] } },
        attributes: ['id'],
        raw: true,
      });
      if (admins.length) {
        /* Carries the reference and a first line of what was actually said, so
           whoever picks it up can tell one message from another without opening
           each in turn. */
        const opening = message.trim().replace(/\s+/g, ' ');
        await Notification.bulkCreate(admins.map((a) => ({
          recipientId: a.id,
          title: 'MSG-' + String(record.id).padStart(5, '0') + ' · ' + (SUBJECT_LABELS[subject] || subject),
          message: name + ' (' + email + '): "'
            + (opening.length > 110 ? opening.slice(0, 110).trimEnd() + '…' : opening) + '"',
          type: 'system',
        })));
      }
    } catch (e) {
      console.error('Contact message stored but admins were not notified:', e.message);
    }

    const reference = 'MSG-' + String(record.id).padStart(5, '0');

    /* Two emails: one to support so a human sees it, one back to the sender so
       they know it arrived. Both are attempted after the message is safely
       stored, and neither can fail the request — a mail server being down is
       not a reason to lose someone's message.

       What is reported back is what actually happened. Saying "sent" when no
       transport is configured is the one outcome worth avoiding: the customer
       waits for a reply by email that was never going to come. */
    let delivered = false;
    let acknowledged = false;

    if (isMailConfigured()) {
      const body =
        '<p><strong>' + esc(name) + '</strong> &lt;' + esc(email) + '&gt;' +
        (phone ? ' &middot; ' + esc(phone) : '') + '</p>' +
        '<p style="color:#5B6B66">' + esc(SUBJECT_LABELS[subject] || subject) +
        ' &middot; ' + esc(reference) + '</p>' +
        '<div style="padding:12px 14px;background:#F7FAF9;border:1px solid #E3EAE7;border-radius:8px;white-space:pre-wrap">' +
        esc(message) + '</div>';

      const toSupport = await sendMail({
        to: supportAddress(),
        subject: '[' + reference + '] ' + (SUBJECT_LABELS[subject] || subject) + ' — ' + name,
        text: name + ' <' + email + '>\n\n' + message,
        html: wrapEmail('New message through Contact Us', body),
        /* Reply goes to the customer, not to the sending mailbox. */
        replyTo: email,
      });
      delivered = toSupport.ok;
      if (!toSupport.ok && !toSupport.skipped) {
        console.error('Contact message ' + reference + ' stored but not emailed:', toSupport.error);
      }

      const ack = await sendMail({
        to: email,
        subject: 'We received your message (' + reference + ')',
        text: 'Thanks ' + name + ', we have your message and will come back to you. Reference: ' + reference,
        html: wrapEmail('Thanks, we have your message', 
          '<p>Hello ' + esc(name) + ',</p>' +
          '<p>We have your message and will come back to you. Quote <strong>' + esc(reference) +
          '</strong> if you write again.</p>' +
          '<div style="padding:12px 14px;background:#F7FAF9;border:1px solid #E3EAE7;border-radius:8px;white-space:pre-wrap;color:#5B6B66">' +
          esc(message) + '</div>'),
      });
      acknowledged = ack.ok;
    }

    res.status(201).json({
      message: delivered
        ? 'Thanks — your message is with our team and a copy is on its way to your inbox.'
        : 'Thanks — we have your message and will come back to you.',
      reference,
      /* The page uses this to describe what actually happened rather than
         promising an email that no transport exists to send. */
      delivery: {
        emailed: delivered,
        acknowledged,
        configured: isMailConfigured(),
      },
    });
  } catch (error) {
    console.error('Contact message failed:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getContactMessages = async (req, res) => {
  try {
    const { status, subject, search } = req.query;

    const where = {};
    if (status && status !== 'all') where.status = status;
    if (subject && subject !== 'all') where.subject = subject;
    if (search && search.trim()) {
      const q = '%' + search.trim() + '%';
      where[Op.or] = [
        { name: { [Op.like]: q } },
        { email: { [Op.like]: q } },
        { phone: { [Op.like]: q } },
        { message: { [Op.like]: q } },
      ];
    }

    const messages = await ContactMessage.findAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'email', 'role'], required: false },
        { model: User, as: 'handledBy', attributes: ['id', 'name', 'email'], required: false },
      ],
      /* Unanswered first whatever the sort, because that is the only order that
         matches what the page is for. */
      order: [['createdAt', 'DESC']],
    });

    const counts = { all: 0, new: 0, read: 0, resolved: 0 };
    const everything = await ContactMessage.findAll({ attributes: ['status'], raw: true });
    for (const m of everything) {
      counts.all += 1;
      counts[m.status] = (counts[m.status] || 0) + 1;
    }

    res.json({
      counts,
      messages: messages.map((m) => ({
        id: m.id,
        reference: 'MSG-' + String(m.id).padStart(5, '0'),
        name: m.name,
        email: m.email,
        phone: m.phone,
        subject: m.subject,
        subjectLabel: SUBJECT_LABELS[m.subject] || m.subject,
        message: m.message,
        status: m.status,
        reply: m.reply,
        /* Whether the sender was signed in when they wrote, and as whom. A
           message from a known account is a different thing from one typed by
           a stranger, and the page should be able to say which. */
        account: m.sender ? { id: m.sender.id, name: m.sender.name, email: m.sender.email, role: m.sender.role } : null,
        handledBy: m.handledBy ? (m.handledBy.name || m.handledBy.email) : m.handledByEmail,
        handledAt: m.handledAt,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error('Contact messages failed:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateContactMessage = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'A message id is required' });

    const record = await ContactMessage.findByPk(id);
    if (!record) return res.status(404).json({ message: 'That message no longer exists' });

    const { status, reply } = req.body;
    if (status && !['new', 'read', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Unknown status' });
    }

    const actor = await User.findByPk(req.userId, { attributes: ['id', 'email'] });

    /* Captured before the write. Whether the customer hears about this depends
       on the reply having actually CHANGED — see below. */
    const previousReply = (record.reply || '').trim();

    if (status) record.status = status;
    if (typeof reply === 'string') record.reply = clean(reply, 4000) || null;

    /* Stamped whenever someone acts on it, so "who dealt with this" has an
       answer later. Moving a message back to new clears the stamp — it is
       waiting again, and leaving a handler on it would say otherwise. */
    if (status === 'new') {
      record.handledById = null;
      record.handledByEmail = null;
      record.handledAt = null;
    } else if (actor) {
      record.handledById = actor.id;
      record.handledByEmail = actor.email;
      record.handledAt = new Date();
    }

    await record.save();

    /* Tell the customer — but only when the reply is genuinely new.

       This used to fire on every save, so "Save reply" followed by "Mark
       resolved" sent the same text twice, and each further click sent it
       again. One message had been delivered four times over. Comparing against
       what was stored means status changes, re-reads and second thoughts cost
       the customer nothing. */
    const nextReply = (record.reply || '').trim();
    const replyIsNew = nextReply && nextReply !== previousReply;

    const reference = 'MSG-' + String(record.id).padStart(5, '0');
    let emailedReply = false;

    if (replyIsNew) {
      /* In-app, for a customer who has an account to receive it.

         The notification names the message it answers. "Reply to your message"
         with nothing but the reply underneath left anyone who had written in
         more than once guessing which one it was about — and the reply often
         makes no sense without the question. The reference and the subject go
         in the title, and their own words are quoted in the body.

         Composed as one line on purpose: the notification list renders the
         body in a plain <p>, so newlines would collapse to spaces and a
         carefully laid out block would arrive as a run-on. */
      if (record.userId) {
        try {
          const asked = record.message.trim().replace(/\s+/g, ' ');
          const quoted = asked.length > 110 ? asked.slice(0, 110).trimEnd() + '…' : asked;
          await Notification.create({
            recipientId: record.userId,
            title: 'Reply to ' + reference + ' · ' + (SUBJECT_LABELS[record.subject] || record.subject),
            message: 'You asked: "' + quoted + '" — Our reply: ' + nextReply.slice(0, 500),
            type: 'system',
          });
        } catch (e) {
          console.error('Reply saved but the customer was not notified:', e.message);
        }
      }

      /* And by email, which is the only route to someone who wrote in as a
         visitor. Attempted after the reply is stored, and a failure here never
         fails the save — the reply is on the record either way. */
      if (isMailConfigured()) {
        const sent = await sendMail({
          to: record.email,
          subject: 'Re: your message (' + reference + ')',
          text: [nextReply, '', '---', 'Your original message:', record.message].join('\n'),
          html: wrapEmail('Reply from MoneyPay',
            '<p>Hello ' + esc(record.name) + ',</p>' +
            '<div style="padding:12px 14px;background:#E8F7F0;border-radius:8px;white-space:pre-wrap">' +
            esc(nextReply) + '</div>' +
            '<p style="color:#5B6B66;margin-top:16px">Your original message (' + esc(reference) + '):</p>' +
            '<div style="padding:12px 14px;background:#F7FAF9;border:1px solid #E3EAE7;border-radius:8px;' +
            'white-space:pre-wrap;color:#5B6B66">' + esc(record.message) + '</div>'),
        });
        emailedReply = sent.ok;
        if (!sent.ok && !sent.skipped) {
          console.error('Reply to ' + reference + ' stored but not emailed:', sent.error);
        }
      }
    }

    res.json({
      message: 'Message updated',
      contactMessage: {
        id: record.id,
        status: record.status,
        reply: record.reply,
        handledByEmail: record.handledByEmail,
        handledAt: record.handledAt,
      },
      /* So the page can say where the reply actually went, rather than leaving
         whoever typed it to guess. */
      delivery: {
        replySent: replyIsNew,
        notified: replyIsNew && Boolean(record.userId),
        emailed: emailedReply,
        mailConfigured: isMailConfigured(),
      },
    });
  } catch (error) {
    console.error('Contact message update failed:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getContactMessageCount = async (req, res) => {
  try {
    const count = await ContactMessage.count({ where: { status: 'new' } });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* Whether mail actually leaves this machine — not merely whether four
   variables are set. `verify` opens the connection and authenticates, which is
   the difference between a configuration that looks right and one that works.
   Without this, a wrong password looks identical to no password at all until a
   customer never gets their reply. */
export const getMailStatus = async (req, res) => {
  try {
    const configured = isMailConfigured();
    const check = await verifyMail();
    res.json({
      configured,
      working: check.ok,
      supportAddress: supportAddress(),
      host: process.env.SMTP_HOST || null,
      port: Number(process.env.SMTP_PORT) || null,
      error: check.ok ? null : check.error,
      hint: configured
        ? (check.ok ? null : 'The settings are present but the server refused them.')
        : 'Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS to send email. '
          + 'Until then messages are stored and shown in Admin > Messages only.',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
