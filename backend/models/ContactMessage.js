import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/* ==========================================================================
   A message sent through Contact Us.

   The footer link was a `mailto:` — which needs a mail client configured on
   the sender's machine, silently does nothing on most phones, and leaves the
   business with no record that anyone ever tried to get in touch. This keeps
   the message.

   There is no outbound mail in this project (Twilio SMS is the only transport
   configured), so a message is stored and raised to admins in the app rather
   than forwarded to an inbox. Adding SMTP later means sending from here as
   well, not instead.
   ========================================================================== */
const ContactMessage = sequelize.define('ContactMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  subject: {
    type: DataTypes.ENUM('general', 'transaction', 'account', 'agent', 'complaint', 'other'),
    defaultValue: 'general',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  /* Set when the sender was signed in. The form is open to visitors who are
     not, so it stays nullable — and it is taken from the token rather than the
     form, since a field anyone can type is not evidence of who wrote it. */
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('new', 'read', 'resolved'),
    defaultValue: 'new',
  },
  /* Who dealt with it, kept by id AND email. The email is copied rather than
     joined so the record still reads correctly if that account is later
     renamed or removed — the same reason destinations are stored by name on a
     transaction. */
  handledById: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  handledByEmail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  handledAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  /* What an admin wrote back, or noted internally. Kept on the row so the
     history of a conversation is not scattered across two places. */
  reply: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'ContactMessages',
  /* Named explicitly. sync({ alter: true }) re-adds unnamed indexes on every
     boot, and this database has already hit MySQL's 64-key ceiling once. */
  indexes: [
    { name: 'contact_messages_status', fields: ['status'] },
    { name: 'contact_messages_created', fields: ['createdAt'] },
  ],
});

ContactMessage.associate = (models) => {
  /* `constraints: false` for the same reason as everywhere else here: a real
     foreign key would be re-created on each sync and pile up. Neither column
     is written by a relation — both are set by the handlers. */
  ContactMessage.belongsTo(models.User, {
    foreignKey: 'userId', as: 'sender', constraints: false,
  });
  ContactMessage.belongsTo(models.User, {
    foreignKey: 'handledById', as: 'handledBy', constraints: false,
  });
};

export default ContactMessage;
