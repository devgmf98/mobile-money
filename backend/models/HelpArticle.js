import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/* ==========================================================================
   A Help Center article.

   The footer link was rendered as plain text with a "Coming soon" tooltip —
   which is honest but useless. This backs it with content the business can
   actually edit, rather than answers hardcoded into a page that only a
   developer can change.

   Articles are stored rather than shipped in the bundle so support can add the
   answer to whatever people are asking this week. Every question that reaches
   Contact Us twice is one that belongs here instead.
   ========================================================================== */
const HelpArticle = sequelize.define('HelpArticle', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  /* Stable, readable and linkable. Generated from the question, so a URL can
     be shared in a reply without carrying a bare numeric id. */
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM('getting-started', 'sending', 'withdrawing', 'agents', 'security', 'account', 'fees'),
    defaultValue: 'getting-started',
  },
  question: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  answer: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  /* Unpublished articles exist but are invisible to customers, so a draft can
     be written without going live half-finished. */
  isPublished: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  /* Manual ordering within a category — the most-asked question should sit at
     the top, and that is a judgement no sort can make. */
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  /* How often it is opened. The point is not vanity: an article nobody opens
     is answering a question nobody has, and one opened constantly is a sign the
     product itself is confusing somewhere. */
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  updatedByEmail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'HelpArticles',
  /* Named explicitly. sync({ alter: true }) re-adds unnamed indexes on every
     boot, and this database has already hit MySQL's 64-key ceiling once. */
  indexes: [
    { name: 'help_articles_slug', unique: true, fields: ['slug'] },
    { name: 'help_articles_category', fields: ['category'] },
    { name: 'help_articles_published', fields: ['isPublished'] },
  ],
});

export default HelpArticle;
