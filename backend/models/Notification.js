import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  recipientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('transaction', 'system', 'alert', 'offer', 'withdrawal_request'),
    defaultValue: 'system'
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  relatedTransactionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Transactions',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['recipientId'] },
    { fields: ['isRead'] },
    { fields: ['type'] },
    { fields: ['relatedTransactionId'] }
  ]
});

// Define associations
Notification.associate = (models) => {
  Notification.belongsTo(models.User, { foreignKey: 'recipientId', as: 'recipient' });
  Notification.belongsTo(models.Transaction, { foreignKey: 'relatedTransactionId', as: 'relatedTransaction' });
};

/* Every notification this system creates also goes out as a push.

   Hooked on the model rather than called from each controller: notifications
   are created in two dozen places across four controllers, and a helper that
   has to be remembered at each one is a helper that will be forgotten at the
   next. Anything that creates a Notification row now reaches a phone with the
   app closed, including code not yet written.

   Deliberately not awaited. These fire inside the paths that move money, and a
   push that times out must not hold a transfer open or fail one that has
   already been committed. The sender swallows its own errors; the catch here
   is for the case it cannot even be imported. */
Notification.addHook('afterCreate', (notification) => {
  import('../utils/push.js')
    .then(({ sendPushToUser }) =>
      sendPushToUser(notification.recipientId, {
        title: notification.title,
        body: notification.message,
        data: {
          id: notification.id,
          type: notification.type || '',
        },
      })
    )
    .catch((error) => console.warn('[push] hook failed:', error.message));
});

export default Notification;
