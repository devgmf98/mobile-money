/* Columns whose *type* has to be widened, checked on every boot.

   `ensureColumns` in stateToName.js adds columns that are missing. This is the
   other half: a column that exists but is too narrow for what the app now puts
   in it. sync({ alter: true }) is supposed to handle that from the model, but
   it is exactly the operation it is least reliable at — it declines to change a
   type it thinks is in use, and when it does fail it fails quietly.

   The case that matters today is Users.profileImage. Pictures are stored as
   base64 inside the row, so the column must be LONGTEXT. On a database created
   before that change it is VARCHAR(255), and MySQL running outside strict mode
   does the worst possible thing with an oversized value: it truncates it to 255
   characters, stores that, and reports success. The upload returns 200, the
   name saves, and the photo comes back as an unreadable fragment. Nothing in
   the logs says anything is wrong.

   Running this before sync() means a deploy repairs itself, rather than
   waiting for someone to notice and run scripts/migrate_profile_image.js by
   hand. */

const WIDENINGS = [
  {
    table: 'Users',
    column: 'profileImage',
    // What information_schema reports once the column is right.
    dataType: 'longtext',
    ddl: 'LONGTEXT NULL',
    why: 'profile pictures are stored as base64 in the row',
  },
];

export async function widenColumns(sequelize) {
  const db = sequelize.getDatabaseName();
  const widened = [];

  for (const target of WIDENINGS) {
    /* TABLE_NAME is matched case-insensitively and the real spelling is read
       back from the answer. MySQL on Linux is case-sensitive about table names
       and this schema uses `Users`, so hardcoding either case would work on one
       platform and silently skip on the other. */
    const [rows] = await sequelize.query(
      `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND LOWER(TABLE_NAME) = LOWER(?)
          AND LOWER(COLUMN_NAME) = LOWER(?)`,
      { replacements: [db, target.table, target.column] }
    );

    const found = rows && rows[0];

    // Not there at all: sync() is about to create it from the model, which
    // already declares the right type. Nothing to widen.
    if (!found) continue;

    if (String(found.DATA_TYPE).toLowerCase() === target.dataType) continue;

    await sequelize.query(
      'ALTER TABLE `' + found.TABLE_NAME + '` ' +
      'MODIFY COLUMN `' + found.COLUMN_NAME + '` ' + target.ddl
    );

    widened.push(
      `${found.TABLE_NAME}.${found.COLUMN_NAME} ` +
      `${found.DATA_TYPE} -> ${target.dataType} (${target.why})`
    );
  }

  return widened;
}
