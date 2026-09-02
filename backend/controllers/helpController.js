import { Op } from 'sequelize';
import HelpArticle from '../models/HelpArticle.js';
import User from '../models/User.js';

/* ==========================================================================
   Help Center.

   Public reading, staff writing. Customers see published articles only; staff
   see drafts too, because you cannot finish writing something you cannot look
   at.
   ========================================================================== */

export const CATEGORIES = [
  { key: 'getting-started', label: 'Getting started' },
  { key: 'sending', label: 'Sending money' },
  { key: 'withdrawing', label: 'Withdrawing cash' },
  { key: 'agents', label: 'Agents' },
  { key: 'fees', label: 'Fees and limits' },
  { key: 'security', label: 'Security' },
  { key: 'account', label: 'Your account' },
];

const LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const KEYS = CATEGORIES.map((c) => c.key);

const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

/* A slug from the question, kept unique by suffixing rather than by refusing
   to save. Two articles may legitimately ask nearly the same thing. */
const slugify = (text) =>
  String(text || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article';

async function uniqueSlug(base, ignoreId = null) {
  let slug = base;
  let n = 2;
  /* eslint-disable no-await-in-loop */
  while (true) {
    const where = { slug };
    if (ignoreId) where.id = { [Op.ne]: ignoreId };
    const clash = await HelpArticle.findOne({ where, attributes: ['id'] });
    if (!clash) return slug;
    slug = base + '-' + n;
    n += 1;
  }
}

const shape = (a) => ({
  id: a.id,
  slug: a.slug,
  category: a.category,
  categoryLabel: LABELS[a.category] || a.category,
  question: a.question,
  answer: a.answer,
  isPublished: a.isPublished,
  position: a.position,
  views: a.views,
  updatedByEmail: a.updatedByEmail,
  updatedAt: a.updatedAt,
});

/* Public. Everything at once, grouped by category — a help centre is read by
   browsing, and paginating a few dozen answers would only hide them. */
export const getHelpArticles = async (req, res) => {
  try {
    const { search, category } = req.query;
    /* Staff get drafts as well. `req.userRole` is only set when a token was
       supplied, so a signed-out visitor simply never matches. */
    const isStaff = req.userRole === 'admin' || req.userRole === 'sub-admin';

    const where = {};
    if (!isStaff) where.isPublished = true;
    if (category && category !== 'all' && KEYS.includes(category)) where.category = category;
    if (search && search.trim()) {
      const q = '%' + search.trim() + '%';
      where[Op.or] = [{ question: { [Op.like]: q } }, { answer: { [Op.like]: q } }];
    }

    const articles = await HelpArticle.findAll({
      where,
      order: [['category', 'ASC'], ['position', 'ASC'], ['id', 'ASC']],
    });

    /* Only categories that actually have something in them. An empty heading
       is a promise the page cannot keep. */
    const grouped = CATEGORIES
      .map((c) => ({
        ...c,
        articles: articles.filter((a) => a.category === c.key).map(shape),
      }))
      .filter((c) => c.articles.length);

    res.json({
      categories: grouped,
      total: articles.length,
      canEdit: isStaff,
    });
  } catch (error) {
    console.error('Help articles failed:', error);
    res.status(500).json({ message: error.message });
  }
};

/* Counts a read. Separate from the listing so that browsing the index does not
   inflate every article's count — only opening one does. */
export const markHelpArticleRead = async (req, res) => {
  try {
    const article = await HelpArticle.findOne({ where: { slug: req.params.slug } });
    if (!article) return res.status(404).json({ message: 'No such article' });
    await article.increment('views');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createHelpArticle = async (req, res) => {
  try {
    const question = clean(req.body.question, 240);
    const answer = clean(req.body.answer, 8000);
    const category = KEYS.includes(req.body.category) ? req.body.category : 'getting-started';

    if (!question || !answer) {
      return res.status(400).json({ message: 'A question and an answer are both required.' });
    }

    const actor = await User.findByPk(req.userId, { attributes: ['email'] });
    const article = await HelpArticle.create({
      slug: await uniqueSlug(slugify(question)),
      category,
      question,
      answer,
      isPublished: req.body.isPublished !== false,
      position: Number(req.body.position) || 0,
      updatedByEmail: actor ? actor.email : null,
    });

    res.status(201).json({ message: 'Article created', article: shape(article) });
  } catch (error) {
    console.error('Help article create failed:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateHelpArticle = async (req, res) => {
  try {
    const article = await HelpArticle.findByPk(Number(req.params.id));
    if (!article) return res.status(404).json({ message: 'No such article' });

    const actor = await User.findByPk(req.userId, { attributes: ['email'] });

    if (typeof req.body.question === 'string') {
      const question = clean(req.body.question, 240);
      if (!question) return res.status(400).json({ message: 'The question cannot be empty.' });
      /* The slug follows the question, but only when the question actually
         changed — otherwise every save would churn a URL someone may have
         already been given in a reply. */
      if (question !== article.question) {
        article.question = question;
        article.slug = await uniqueSlug(slugify(question), article.id);
      }
    }
    if (typeof req.body.answer === 'string') {
      const answer = clean(req.body.answer, 8000);
      if (!answer) return res.status(400).json({ message: 'The answer cannot be empty.' });
      article.answer = answer;
    }
    if (KEYS.includes(req.body.category)) article.category = req.body.category;
    if (typeof req.body.isPublished === 'boolean') article.isPublished = req.body.isPublished;
    if (req.body.position !== undefined) article.position = Number(req.body.position) || 0;

    article.updatedByEmail = actor ? actor.email : article.updatedByEmail;
    await article.save();

    res.json({ message: 'Article updated', article: shape(article) });
  } catch (error) {
    console.error('Help article update failed:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteHelpArticle = async (req, res) => {
  try {
    const article = await HelpArticle.findByPk(Number(req.params.id));
    if (!article) return res.status(404).json({ message: 'No such article' });
    await article.destroy();
    res.json({ message: 'Article deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==========================================================================
   Starter content.

   Run once at boot, and only when the table is empty. A help centre that opens
   on "no articles yet" is worse than the placeholder it replaced — the first
   customer to click the link should find answers, not an apology.

   These are the questions this app's own flows raise, written from what the
   code actually does rather than invented.
   ========================================================================== */
const SEED = [
  ['getting-started', 'How do I open a MoneyPay account?',
    'Choose Register on the sign-in screen and enter your name, phone number and email. You will be sent a verification code to confirm the number is yours. Once verified you can send money, withdraw cash at an agent and check your balance.'],
  ['getting-started', 'What do I need to verify my account?',
    'A phone number you can receive SMS on, and an email address. Some services also ask for a national ID at an agent or branch — bring the original, not a copy.'],
  ['sending', 'How do I send money to someone?',
    'Open Send Money, enter the recipient’s phone number and the amount, then confirm. You will see the fee and the total before anything leaves your balance. Both of you get a notification once it lands.'],
  ['sending', 'The person I sent to has not received the money. What now?',
    'Check the transaction in your Transactions list. If it still shows as pending it has not been settled at the destination yet. If it shows completed and they still cannot see it, contact us with the reference number — it begins with TXN.'],
  ['sending', 'Can I cancel a transfer after sending it?',
    'A transfer that is still pending can be cancelled by the office that raised it. Once it has been marked as received the money has been paid out and it cannot be reversed — contact us straight away if you sent it in error.'],
  ['withdrawing', 'How do I withdraw cash?',
    'Visit any MoneyPay agent, tell them the amount, and approve the request on your phone. The agent hands you the cash and the fee is shown before you approve.'],
  ['withdrawing', 'Why was my withdrawal declined?',
    'The usual reasons are not enough balance to cover the amount plus the fee, an unverified account, or the agent not holding enough cash at that moment. The message on screen says which.'],
  ['agents', 'How do I become an agent?',
    'Choose Agent when creating your account, or visit any MoneyPay office with your national ID. Agents earn a commission on every withdrawal they handle.'],
  ['agents', 'How is agent commission paid?',
    'Commission is added to your agent balance as each withdrawal completes, so it is available immediately rather than at the end of the month.'],
  ['fees', 'What does it cost to send money?',
    'The fee depends on the amount and the destination. It is always shown on screen before you confirm, and it appears on the receipt afterwards — you are never charged something you were not shown.'],
  ['fees', 'Is there a limit on how much I can send?',
    'Limits depend on whether your account is verified and on the destination. If a transfer is over your limit the app says so at the point you enter the amount.'],
  ['security', 'What should I do if I lose my phone?',
    'Contact us immediately so the account can be suspended. Your money stays in the account — suspending only stops anyone using the app.'],
  ['security', 'Will MoneyPay ever ask for my PIN or password?',
    'Never. No member of staff, agent or support will ask for your PIN, password or a verification code. Anyone who does is trying to defraud you — end the conversation and report it to us.'],
  ['account', 'How do I change my phone number or email?',
    'Open Profile and update the details there. Changing a phone number sends a verification code to the new one, so keep it to hand.'],
  ['account', 'Why is my account suspended?',
    'Accounts are suspended when something needs checking, or at your own request after a lost phone. Contact us and we will tell you what is needed to lift it.'],
];

export async function seedHelpArticles() {
  const existing = await HelpArticle.count();
  if (existing > 0) return { seeded: 0, existing };

  const rows = [];
  for (let i = 0; i < SEED.length; i += 1) {
    const [category, question, answer] = SEED[i];
    rows.push({
      slug: await uniqueSlug(slugify(question)),
      category,
      question,
      answer,
      isPublished: true,
      position: i,
    });
  }
  await HelpArticle.bulkCreate(rows);
  return { seeded: rows.length, existing: 0 };
}
