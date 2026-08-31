/* Converts Users.state from the StateSettings id to the destination's name.
 *
 *   node scripts/migrateStateToName.js
 *
 * The server runs this for itself on every startup, so a deployment repairs
 * its own database and this script is rarely needed. It stays for running the
 * conversion deliberately — against a database the app is not pointed at, or
 * to see what it would report — and shares the same code so the two cannot
 * drift apart.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '..', '..', '.env') });

const { default: sequelize } = await import('../config/database.js');
const { migrateStateToName } = await import('../migrations/stateToName.js');

try {
  const result = await migrateStateToName(sequelize);
  console.log();
  if (result.skipped) console.log('  nothing to do — ' + result.skipped);
  else result.changed.forEach(line => console.log('  ' + line));

  const [rows] = await sequelize.query(
    "SELECT email, `state` FROM `users` WHERE role = 'admin' ORDER BY id"
  );
  console.log();
  console.log('  admins:');
  rows.forEach(r => console.log(`    ${r.email.padEnd(26)}${r.state || '— none —'}`));
  console.log();
} finally {
  await sequelize.close();
}
