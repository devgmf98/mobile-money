/* ==========================================================================
   Privacy Policy, Terms of Service and Security — the three documents the
   footer has been pointing at as plain text since the footer was written.

   Everything here describes what this codebase actually does: the fields on
   the User and Transaction models, the verification codes sent over SMS, the
   bcrypt password hashing in utils/helpers.js, the JWT sessions, the location
   field that only fills in with consent. Nothing claims a certification, an
   audit or a control that is not in the code.

   What this file cannot know is the business behind it — who the operating
   company is, where it is registered, which regulator it answers to, which
   country's law governs a dispute. Those sit in COMPANY below as marked
   placeholders, and DRAFT renders a notice listing them until they are filled
   in. Set DRAFT to false once they are, and once a lawyer has read the result:
   these pages are commitments, not copy.
   ========================================================================== */

export const DRAFT = false;

export const COMPANY = {
  name: 'Money Pay',
  address: 'Custom market, juba, south sudan',
  regulator: 'MoneyPay regulator',
  law: 'B.Court, Juba, South Sudan',
  email: 'support@moneypay.com',
};

/* One date for all three. They were written together and they change
   together; three drifting dates would only invite the question of which one
   is current. */
export const UPDATED = '2 September 2026';

const contactSection = {
  id: 'contact',
  heading: 'How to reach us',
  blocks: [
    { type: 'p', text: 'Questions about this document, or about your own information, go to the same place as everything else: use the Contact page and a person will answer. Include your registered phone number so we can find your account.' },
    { type: 'p', text: `You can also write to ${COMPANY.email}, or to ${COMPANY.name} at ${COMPANY.address}.` },
  ],
};

/* ------------------------------------------------------------------ privacy */

export const PRIVACY = {
  key: 'privacy',
  title: 'Privacy Policy',
  tagline: 'What MoneyPay collects, why it is collected, and what you can do about it.',
  summary: [
    'We collect what a money transfer needs — who you are, how to reach you, and what you sent.',
    'Your location is only recorded if you turn that on.',
    'We never sell your information.',
  ],
  sections: [
    {
      id: 'scope',
      heading: 'What this covers',
      blocks: [
        { type: 'p', text: 'This policy applies to the MoneyPay app and the accounts inside it — customers, agents and staff alike. It explains what we hold about you, why we hold it, who else can see it, and how long it stays.' },
        { type: 'p', text: 'It does not cover anything you do outside MoneyPay: the bank or mobile wallet you move money into afterwards has its own policy, and so does the network that carries our text messages.' },
      ],
    },
    {
      id: 'collect',
      heading: 'What we collect',
      blocks: [
        { type: 'p', text: 'Only the things the service needs to work. In practice that is four groups:' },
        {
          type: 'dl',
          items: [
            ['Account details', 'Your name, email address, phone number and password. The password is stored only as a hash — it is never held, logged or displayed in a form anyone can read back, including us.'],
            ['Identity details', 'An ID number and a profile photo, where verification is required. Agents and staff also carry an agent or admin reference.'],
            ['Transaction records', 'Every transfer, withdrawal, cash-out and currency exchange: who sent it, who received it, the amount and currency, the fee and commission applied, the destination, its status, and the staff member who settled or cancelled it. These are financial records and we keep them.'],
            ['Support messages', 'What you write on the Contact page, the reply we send back, and which staff member handled it.'],
          ],
        },
      ],
    },
    {
      id: 'location',
      heading: 'Location',
      blocks: [
        { type: 'p', text: 'MoneyPay can record the location of your device, and it does so only if you have turned that on for your account. It is off unless you switch it on, switching it back off stops any further recording, and nothing about the transfer service depends on it.' },
      ],
    },
    {
      id: 'why',
      heading: 'Why we use it',
      blocks: [
        {
          type: 'ul',
          items: [
            'To move money — matching a sender to a recipient, applying the right rate and fee, and settling the transfer.',
            'To confirm you are who you say you are, before an account can send or withdraw.',
            'To tell you what happened, by notification in the app and by text message or email.',
            'To answer you when you contact support.',
            'To spot fraud and abuse, and to meet the record-keeping obligations that come with handling other people’s money.',
          ],
        },
        { type: 'note', text: 'We do not sell your information, and we do not use it to target advertising.' },
      ],
    },
    {
      id: 'sharing',
      heading: 'Who can see it',
      blocks: [
        {
          type: 'dl',
          items: [
            ['The other side of a transfer', 'Whoever you send to sees enough to know the money came from you — your name and the amount. They do not see your balance, your other transactions, or your contact details beyond what the transfer itself carries.'],
            ['Agents', 'An agent handling your cash-out sees that transaction and the details needed to complete it. They cannot see your account history.'],
            ['MoneyPay staff', 'Admins and sub-admins can see accounts and transactions in order to settle transfers, resolve disputes and answer support messages. Every settlement and cancellation records which staff member did it.'],
            ['Service providers', 'The companies that deliver our text messages and email on our behalf receive only what is needed to deliver them — a phone number or address and the message itself.'],
            ['Authorities', 'Where the law requires it, or where we need to establish or defend a legal claim.'],
          ],
        },
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep it',
      blocks: [
        { type: 'p', text: 'Transaction records are kept for as long as financial record-keeping rules require, which is normally several years after the transaction — closing your account does not erase them, and it is not meant to.' },
        { type: 'p', text: 'Verification codes are short-lived and expire on their own. Support messages are kept while they are open and for a reasonable period afterwards, so that a later question about the same problem has context.' },
      ],
    },
    {
      id: 'rights',
      heading: 'Your choices',
      blocks: [
        {
          type: 'ul',
          items: [
            'See and correct your details from your profile page.',
            'Turn location recording on or off at any time.',
            'Ask for a copy of what we hold about you.',
            'Ask us to close your account. We will, but the transaction records stay, for the reason above.',
          ],
        },
        { type: 'p', text: 'Ask through the Contact page and we will confirm your identity before acting — a request to hand over an account’s data is exactly what someone impersonating you would send.' },
      ],
    },
    {
      id: 'device',
      heading: 'What is stored on your device',
      blocks: [
        { type: 'p', text: 'Signing in stores a session token in your browser so you are not asked for your password on every page. Alongside it we keep small preferences — your light or dark theme, and whether you left the sidebar expanded or collapsed.' },
        { type: 'p', text: 'They stay on your device. Signing out clears the session token; clearing your browser data clears the rest.' },
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      blocks: [
        { type: 'p', text: 'MoneyPay is not for people under 18. We do not knowingly open accounts for them, and we close any we find.' },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      blocks: [
        { type: 'p', text: 'When this changes we update the date at the top of the page. If a change materially affects what we do with your information, we will say so in the app rather than leave you to notice.' },
      ],
    },
    contactSection,
  ],
};

/* -------------------------------------------------------------------- terms */

export const TERMS = {
  key: 'terms',
  title: 'Terms of Service',
  tagline: 'The agreement between you and MoneyPay when you use the app.',
  summary: [
    'Keep your account and your codes to yourself.',
    'Fees are shown before you confirm, never after.',
    'A completed transfer cannot be undone from your side.',
  ],
  sections: [
    {
      id: 'agreement',
      heading: 'The agreement',
      blocks: [
        { type: 'p', text: `These terms are between you and ${COMPANY.name}, the operator of MoneyPay. Opening an account or using the app means you accept them. If you do not, do not use the service.` },
        { type: 'p', text: 'Read them together with the Privacy Policy, which explains what we do with your information.' },
      ],
    },
    {
      id: 'eligibility',
      heading: 'Who can open an account',
      blocks: [
        { type: 'p', text: 'You must be at least 18 and using the account for yourself. One person, one account, in your own real name.' },
        { type: 'p', text: 'The details you give us must be accurate and kept up to date. An account opened with someone else’s details, or held on someone else’s behalf without our agreement, will be closed.' },
      ],
    },
    {
      id: 'verification',
      heading: 'Verification',
      blocks: [
        { type: 'p', text: 'Before an account can move money we confirm your phone number with a code sent by text, and we may ask for identity details. We can ask again later — when something about an account’s activity warrants it, or when the law requires it.' },
        { type: 'p', text: 'Until verification is complete, an account’s ability to send or withdraw may be limited.' },
      ],
    },
    {
      id: 'using',
      heading: 'Using the service',
      blocks: [
        { type: 'p', text: 'MoneyPay lets you send money to another account, withdraw cash through an agent, receive money, and exchange between the currencies we support.' },
        { type: 'p', text: 'Check the recipient before you confirm. A transfer sent to the wrong person is not a fault in the service, and we cannot compel its return — we will help you try, but that is the honest limit of it.' },
        { type: 'p', text: 'A transfer may sit as pending until the receiving side or a staff member settles it. Pending transfers can be cancelled; once a transfer is completed it is final.' },
      ],
    },
    {
      id: 'fees',
      heading: 'Fees, commission and rates',
      blocks: [
        { type: 'p', text: 'Fees depend on the amount, the type of transfer and the destination, and the exact fee is shown to you before you confirm. If it is not shown, do not confirm.' },
        { type: 'p', text: 'Currency exchanges use the rate displayed at the moment you confirm. Rates move; the one you were shown yesterday is not the one you get today.' },
        { type: 'p', text: 'Agents earn a commission on the transactions they handle. That commission is part of the fee you were shown — an agent asking for anything extra, in cash or otherwise, is not acting for MoneyPay, and you should report it.' },
      ],
    },
    {
      id: 'balance',
      heading: 'Your balance',
      blocks: [
        { type: 'p', text: 'Your balance is what you can currently send or withdraw. It is not a bank deposit and it does not earn interest.' },
        { type: 'p', text: 'We may hold a transfer, or hold a balance, while we look into activity that appears fraudulent or unlawful. We will tell you when we do, unless telling you would itself be unlawful.' },
      ],
    },
    {
      id: 'agents',
      heading: 'If you are an agent',
      blocks: [
        {
          type: 'ul',
          items: [
            'Handle every cash-out through the app, so it is recorded. Cash exchanged outside a recorded transaction is not covered by anything here.',
            'Take the fee shown in the app and nothing more.',
            'Confirm the customer’s identity for a cash-out, to the standard we set.',
            'Never ask a customer for their password or a verification code. There is no situation in which you need either.',
          ],
        },
        { type: 'p', text: 'Agent status can be withdrawn if these are not met.' },
      ],
    },
    {
      id: 'prohibited',
      heading: 'What you must not do',
      blocks: [
        {
          type: 'ul',
          items: [
            'Use MoneyPay for anything unlawful, including money laundering or financing terrorism.',
            'Send money you have no right to send, or knowingly receive money someone else has no right to send.',
            'Impersonate anyone, or open an account under a false name.',
            'Share your password or verification codes, or let anyone else use your account.',
            'Interfere with the app or try to reach parts of it that are not yours — other people’s accounts, or staff functions.',
            'Automate access to the service without our written agreement.',
          ],
        },
      ],
    },
    {
      id: 'suspension',
      heading: 'Suspension and closure',
      blocks: [
        { type: 'p', text: 'We can suspend or close an account that breaks these terms, that we reasonably believe is being used for fraud or crime, or where the law requires it. A suspended account cannot transact.' },
        { type: 'p', text: 'You can close your account at any time by asking us. Settle anything outstanding first — closing an account does not clear what it owes, and the transaction records remain.' },
      ],
    },
    {
      id: 'availability',
      heading: 'Availability and liability',
      blocks: [
        { type: 'p', text: 'We work to keep MoneyPay running and accurate, but no service is available every minute. Maintenance, network faults and the systems we depend on can all interrupt it, and we do not promise otherwise.' },
        { type: 'p', text: 'We are responsible for a loss we cause. We are not responsible for a loss caused by someone getting your password or verification code from you, by details you entered incorrectly, or by a failure in a network or provider outside our control. Nothing here removes a liability that the law does not allow us to remove.' },
      ],
    },
    {
      id: 'disputes',
      heading: 'If something goes wrong',
      blocks: [
        { type: 'p', text: 'Tell us first — most problems are a mistyped number or a transfer that has not settled yet, and both are quicker to fix than to argue about. Use the Contact page, with the transaction reference.' },
        { type: 'p', text: `If we cannot resolve it between us, these terms are governed by ${COMPANY.law}.` },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to these terms',
      blocks: [
        { type: 'p', text: 'We may update these terms. The date at the top of the page always shows the current version, and we will give notice in the app before a material change takes effect. Continuing to use MoneyPay after that means you accept the new version.' },
      ],
    },
    contactSection,
  ],
};

/* ----------------------------------------------------------------- security */

export const SECURITY = {
  key: 'security',
  title: 'Security',
  tagline: 'How your account is protected, and the part of it that is yours.',
  summary: [
    'We will never ask for your password or a verification code.',
    'Passwords are stored hashed — nobody at MoneyPay can read yours.',
    'Every settlement records which staff member made it.',
  ],
  sections: [
    {
      id: 'protect',
      heading: 'What we do',
      blocks: [
        {
          type: 'dl',
          items: [
            ['Passwords are hashed', 'Your password is put through a one-way hash before it is stored. We hold the hash, not the password. Nobody at MoneyPay can look yours up, and a copy of our database would not reveal it.'],
            ['The app is served over HTTPS', 'Traffic between your device and MoneyPay is encrypted in transit.'],
            ['Sessions are signed and expire', 'Signing in issues a signed session token with a limited life. Signing out ends it.'],
            ['Access follows the role', 'Customer, agent, sub-admin and admin each see only their own part of the app. The checks are enforced on the server, not merely hidden in the interface.'],
            ['Staff actions are attributed', 'Settling, cancelling or editing a transaction records which staff account did it and when. Support replies record who sent them.'],
            ['Phone numbers are verified', 'A code sent by text confirms the number on an account before it can be used, and codes expire.'],
          ],
        },
      ],
    },
    {
      id: 'never',
      heading: 'What we will never ask you for',
      blocks: [
        { type: 'p', text: 'This is the short list that matters most, because almost every account taken over is taken over this way:' },
        {
          type: 'ul',
          items: [
            'Your password. Not by phone, not by text, not by email, not in a support reply.',
            'A verification code. A code is proof that you are you — anyone asking for it is trying to be you.',
            'Payment to release money that is already yours.',
          ],
        },
        { type: 'note', text: 'If someone asks for any of these, they are not MoneyPay, whatever the caller ID or the email address says. Stop, and report it.' },
      ],
    },
    {
      id: 'yours',
      heading: 'Your part',
      blocks: [
        {
          type: 'ul',
          items: [
            'Use a password you use nowhere else. Reused passwords are how a breach somewhere else becomes a problem here.',
            'Keep verification codes to yourself, including from family and from anyone claiming to be staff or an agent.',
            'Lock the device the app is on.',
            'Check the recipient’s name and number before confirming a transfer — a completed transfer is final.',
            'Read your transaction list now and then. It is the fastest way to notice something you did not do.',
            'Sign out on a device you share.',
          ],
        },
      ],
    },
    {
      id: 'scams',
      heading: 'Recognising a scam',
      blocks: [
        { type: 'p', text: 'The common ones look like this:' },
        {
          type: 'ul',
          items: [
            'A message saying money was sent to you by mistake, asking you to send it back. The original will often be reversed, leaving you short twice.',
            'Urgency — an account closing in minutes, a prize expiring today. Urgency exists to stop you checking.',
            'A caller who already knows your name and a recent transaction, and uses that to ask for a code. Knowing something about you is not proof of who they are.',
            'A request to pay a fee before receiving a payment.',
          ],
        },
        { type: 'p', text: 'When in doubt, stop and contact us yourself through the app, rather than replying to whoever contacted you.' },
      ],
    },
    {
      id: 'compromised',
      heading: 'If you think your account is compromised',
      blocks: [
        {
          type: 'ol',
          items: [
            'Change your password immediately, from your profile page.',
            'Check your recent transactions for anything you did not do.',
            'Contact us with the details, including anything you were asked for and by whom.',
          ],
        },
        { type: 'p', text: 'Tell us early. A transfer that has not settled yet can often be stopped; one that has completed cannot.' },
      ],
    },
    {
      id: 'disclosure',
      heading: 'Reporting a vulnerability',
      blocks: [
        { type: 'p', text: 'If you have found a weakness in MoneyPay, we would rather hear it from you than from an attacker. Send us the details through the Contact page and we will look into it.' },
        { type: 'p', text: 'Please give us a reasonable chance to fix it before publishing, and do not use real customer accounts, real money, or anyone else’s data to demonstrate it — a description of the flaw is enough.' },
      ],
    },
    contactSection,
  ],
};

export const DOCS = { privacy: PRIVACY, terms: TERMS, security: SECURITY };
