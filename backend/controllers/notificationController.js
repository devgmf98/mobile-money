import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendSMS } from '../utils/sms.js';

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { recipientId: req.userId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json(notifications);
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.body;

    const [updatedRowsCount, updatedRows] = await Notification.update(
      { isRead: true },
      { where: { id: notificationId, recipientId: req.userId }, returning: true }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(updatedRows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { recipientId: req.userId, isRead: false } }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const sendNotificationToAll = async (req, res) => {
  try {
    const { title, message, type } = req.body;

    const users = await User.findAll();

    const notifications = users.map(user => ({
      recipientId: user.id,
      title,
      message,
      type: type || 'system'
    }));

    /* individualHooks, or nobody hears about it.

       The afterCreate hook on Notification is what emits the row over the
       socket and sends it as a push. bulkCreate skips per-row hooks by
       default, so a broadcast wrote a row for every user and delivered it to
       none of them -- it appeared only when someone happened to reload a page
       that refetched the list. */
    await Notification.bulkCreate(notifications, { individualHooks: true });

    // Send SMS to all users
    try {
      for (const user of users) {
        await sendSMS(user.phone, `MoneyPay: ${message}`);
      }
    } catch (error) {
      console.error('SMS failed:', error);
    }

    res.json({ message: `Notification sent to ${users.length} users` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const sendNotificationToUser = async (req, res) => {
  try {
    const { userId, title, message, type } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const notification = await Notification.create({
      recipientId: userId,
      title,
      message,
      type: type || 'system'
    });

    try {
      await sendSMS(user.phone, `MoneyPay: ${message}`);
    } catch (error) {
      console.error('SMS failed:', error);
    }

    res.json({ message: 'Notification sent', notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const deletedRowsCount = await Notification.destroy({
      where: { id: notificationId, recipientId: req.userId }
    });

    if (deletedRowsCount === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
