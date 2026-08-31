/* Assign a destination to an admin, by name.
 *
 *   node scripts/setAdminDestination.js --list
 *   node scripts/setAdminDestination.js admin@gcash.com JUBA
 *
 * Doing this in SQL is deceptively easy to get wrong. `SET state = 'JUBA'`
 * looks right, but the column holds the StateSettings id, and MySQL — not in
 * strict mode here — quietly evaluates the string as the number 0 rather than
 * complaining. No destination has id 0, so the write dies on the foreign key
 * with an error that says nothing about the actual mistake:
 *
 *   #1452 Cannot add or update a child row: a foreign key constraint fails
 *
 * This resolves the name properly and refuses anything it cannot match.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '..', '..', '.env') });

const { default: sequelize } = await import('../config/database.js');
const { default: User } = await import('../models/User.js');
const { default: StateSetting } = await import('../models/StateSetting.js');
const { resolveDestination } = await import('../utils/destinations.js');

const fail = (msg) => { console.error('\n  ' + msg + '\n'); process.exit(1); };

async function listing() {
  const states = await StateSetting.findAll({ order: [['name', 'ASC']] });
  const admins = await User.findAll({ where: { role: 'admin' }, order: [['id', 'ASC']] });
  const nameFor = (id) => (states.find(s => s.id === id) || {}).name || '— none —';

  console.log('\n  Destinations');
  states.forEach(s => console.log(`    ${String(s.id).padEnd(4)}${s.name.padEnd(12)}${s.commissionPercent}%`));

  console.log('\n  Admins');
  admins.forEach(a => console.log(`    ${a.email.padEnd(26)}${nameFor(a.state)}`));

  const unassigned = admins.filter(a => !a.state);
  if (unassigned.length) {
    console.log(`\n  ${unassigned.length} admin(s) have no destination and cannot send state transfers.`);
  }
  console.log();
}

async function assign(email, destination) {
  const admin = await User.findOne({ where: { email } });
  if (!admin) fail(`No account with the email ${email}.`);
  if (admin.role !== 'admin') fail(`${email} is a ${admin.role}, not an admin. Destinations apply to admins only.`);

  const target = await resolveDestination(destination);
  if (target.error) fail(target.error);
  if (target.id === null) fail('Give a destination name, for example JUBA.');

  const before = admin.state
    ? (await StateSetting.findByPk(admin.state))?.name || String(admin.state)
    : '— none —';

  await admin.update({ state: target.id });
  console.log(`\n  ${email}\n    ${before}  ->  ${target.name}\n`);
}

const [, , first, second] = process.argv;
try {
  if (!first || first === '--list') await listing();
  else if (!second) fail('Usage: node scripts/setAdminDestination.js <admin-email> <destination>');
  else await assign(first, second);
} finally {
  await sequelize.close();
}
