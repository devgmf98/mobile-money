import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { getIO } from '../utils/socket.js';

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
  /* Live delivery, for whoever has the app open.

     This used to be a manual emit in each controller, and only 12 of the 31
     places that create a notification remembered it -- a top-up wrote the row,
     emitted the new balance, and never told anyone a notification existed, so
     the bell only moved when the screen was next refetched and no tray entry
     ever appeared. Emitting here means every row reaches the socket, including
     from code not yet written.

     The row's real id goes out with it, so a client can tell one notification
     from another rather than inventing a key from the text. */
  try {
    const io = getIO();
    if (io) {
      io.to(`user-${notification.recipientId}`).emit('new-notification', {
        id: notification.id,
        recipientId: notification.recipientId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        relatedTransactionId: notification.relatedTransactionId ?? null,
        isRead: false,
        createdAt: notification.createdAt,
      });
    }
  } catch (error) {
    console.warn('[socket] notification emit failed:', error.message);
  }

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
