/* Converts Users.state from the StateSettings id to the destination's name.
 *
 *   node scripts/migrateStateToName.js
 *
 * Storing the name is what people actually write, and `SET state = 'JUBA'`
 * now means what it looks like. Referential integrity is kept rather than
 * traded away: StateSettings.name is unique, so the foreign key simply points
 * at the name instead of the id, and ON UPDATE CASCADE means renaming a
 * destination rewrites every admin assigned to it in the same statement.
 *
 * Safe to run more than once — it checks the current shape and skips whatever
 * is already done.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '..', '..', '.env') });

const { default: sequelize } = await import('../config/database.js');

const DB = sequelize.getDatabaseName();
const FK = 'users_state_destination_fk';
const say = (m) => console.log('  ' + m);

async function columnType() {
  const [[row]] = await sequelize.query(
    `SELECT COLUMN_TYPE t FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'state'`,
    { replacements: [DB] }
  );
  return row ? row.t : null;
}

async function stateForeignKeys() {
  const [rows] = await sequelize.query(
    `SELECT DISTINCT CONSTRAINT_NAME n FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'state' AND REFERENCED_TABLE_NAME IS NOT NULL`,
    { replacements: [DB] }
  );
  return rows.map(r => r.n);
}

try {
  /* Every foreign key on the column has to go before the type can change.
     There are usually many: sync({ alter: true }) adds another on each boot. */
  const existing = await stateForeignKeys();
  if (existing.length) {
    for (const name of existing) {
      await sequelize.query('ALTER TABLE `users` DROP FOREIGN KEY `' + name + '`');
    }
    say(`dropped ${existing.length} foreign key(s) on users.state`);
  }

  const before = await columnType();
  if (before && before.startsWith('int')) {
    /* int -> varchar first, so the ids survive as text and can be matched. */
    await sequelize.query(
      'ALTER TABLE `users` MODIFY `state` VARCHAR(255) ' +
      'CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL'
    );
    const [res] = await sequelize.query(
      'UPDATE `users` u JOIN `statesettings` s ON s.id = u.`state` SET u.`state` = s.name'
    );
    say('converted the column to text and rewrote ids as names');

    /* An id that no longer matches a destination cannot be represented as a
       name, and would fail the new key. Better an empty field than a lie. */
    const [orphans] = await sequelize.query(
      'UPDATE `users` u LEFT JOIN `statesettings` s ON s.name = u.`state` ' +
      'SET u.`state` = NULL WHERE u.`state` IS NOT NULL AND s.name IS NULL'
    );
    if (orphans.affectedRows) say(`cleared ${orphans.affectedRows} row(s) pointing at a destination that no longer exists`);
  } else {
    say('column is already text — leaving the data alone');
    await sequelize.query(
      'ALTER TABLE `users` MODIFY `state` VARCHAR(255) ' +
      'CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL'
    );
  }

  /* Re-created from scratch each run: earlier boots left a pile of unnamed
     duplicates behind, and they were all dropped above. */
  await sequelize.query(
    'ALTER TABLE `users` ADD CONSTRAINT `' + FK + '` ' +
    'FOREIGN KEY (`state`) REFERENCES `statesettings` (`name`) ' +
    'ON DELETE SET NULL ON UPDATE CASCADE'
  );
  say('added ' + FK + ' -> statesettings.name (ON UPDATE CASCADE)');

  const [rows] = await sequelize.query(
    "SELECT email, `state` FROM `users` WHERE role = 'admin' ORDER BY id"
  );
  console.log();
  say('admins after migration:');
  rows.forEach(r => console.log(`    ${r.email.padEnd(26)}${r.state || '— none —'}`));
  console.log();
} finally {
  await sequelize.close();
}
