import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: (() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        // Ensure balance is a number
        if (user && typeof user.balance === 'string') {
          user.balance = parseFloat(user.balance) || 0;
        }
        return user;
      } catch (e) {
        return null;
      }
    }
    return null;
  })(),
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  // The user record mirrors the DB, so it wins over the standalone 'theme'
  // key. Using only the latter let the two drift: the page rendered dark
  // while the settings toggle (reading user.theme) still showed light.
  theme: (() => {
    // Signed out always means light - the default.
    if (!localStorage.getItem('token')) return 'light';
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u && u.theme) return u.theme;
      }
    } catch (e) { /* fall through */ }
    return localStorage.getItem('theme') || 'light';
  })(),

  login: (user, token) => {
    // Ensure balance is a number
    const processedUser = { ...user };
    if (typeof processedUser.balance === 'string') {
      processedUser.balance = parseFloat(processedUser.balance) || 0;
    }
    localStorage.setItem('user', JSON.stringify(processedUser));
    localStorage.setItem('token', token);
    localStorage.setItem('theme', processedUser.theme || 'light');
    document.documentElement.setAttribute('data-theme', processedUser.theme || 'light');
    set({ user: processedUser, token, isAuthenticated: true, theme: processedUser.theme || 'light' });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('theme');
    document.documentElement.setAttribute('data-theme', 'light');
    set({ user: null, token: null, isAuthenticated: false, theme: 'light' });
  },

  updateUser: (user) => {
    // Ensure balance is a number
    const processedUser = { ...user };
    if (typeof processedUser.balance === 'string') {
      processedUser.balance = parseFloat(processedUser.balance) || 0;
    }
    localStorage.setItem('user', JSON.stringify(processedUser));
    if (processedUser.theme) {
      localStorage.setItem('theme', processedUser.theme);
      document.documentElement.setAttribute('data-theme', processedUser.theme);
      set({ user: processedUser, theme: processedUser.theme });
    } else {
      set({ user: processedUser });
    }
  },

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  }
}));

// Listen for external window events to update the user (used by socket handlers)
window.addEventListener('mpay:user-updated', (e) => {
  try {
    const updated = e.detail;
    // Ensure balance is a number
    if (updated && typeof updated.balance === 'string') {
      updated.balance = parseFloat(updated.balance) || 0;
    }
    // Access store setter by calling the zustand hook setter
    // We directly call localStorage and set to keep this simple
    const store = useAuthStore.getState();
    if (store && updated) {
      localStorage.setItem('user', JSON.stringify(updated));
      store.updateUser(updated);
    }
  } catch (err) {
    console.error('Failed to handle mpay:user-updated', err);
  }
});

export const useNotificationStore = create((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    set({ notifications, unreadCount });
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.isRead ? state.unreadCount : state.unreadCount + 1
    }));
  },

  markAsRead: (id) => {
    set((state) => {
      // Sequelize exposes the primary key as `id`; the old `_id` check was a
      // MongoDB leftover that never matched, so nothing was ever marked read.
      const wasUnread = state.notifications.some(n => n.id === id && !n.isRead);
      return {
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        // Only decrement for a genuinely unread item, otherwise repeat calls
        // drift the badge below the real count.
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
    });
  }
}));
