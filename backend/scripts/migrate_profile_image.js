import sequelize from '../config/database.js';

async function migrateProfileImage() {
  try {
    console.log('Starting profile image column migration...');
    
    // Alter the Users table to change profileImage column to LONGTEXT
    const query = `ALTER TABLE Users MODIFY COLUMN profileImage LONGTEXT;`;
    
    await sequelize.query(query);
    
    console.log('✓ Successfully migrated profileImage column to LONGTEXT');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrateProfileImage();
