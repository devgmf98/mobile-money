import admin from 'firebase-admin';
import DeviceToken from '../models/DeviceToken.js';

/* Push notifications, for the case the socket cannot cover: the app closed, no
   connection open, nothing running to receive on.

   Credentials come from the environment, never the repo. FIREBASE_SERVICE_ACCOUNT
   holds the service-account JSON as a string (Railway's variable editor takes it
   whole); GOOGLE_APPLICATION_CREDENTIALS pointing at a file works too, which is
   what a local run usually has.

   With neither set, everything here is a no-op that logs once. That is
   deliberate: push is an extra on top of a wallet that already tells people
   what happened through its own socket, and an unconfigured environment should
   not turn every notification into a 500. */

let app = null;
let warned = false;

const init = () => {
  if (app) return app;

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
      const credentials = JSON.parse(raw);
      /* Railway and most dashboards store a multi-line value with the newlines
         escaped, and the private key is the one field that cares. */
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      app = admin.initializeApp({ credential: admin.credential.cert(credentials) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (!warned) {
      warned = true;
      console.warn('[push] No Firebase credentials set - push notifications are off.');
    }
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn('[push] Firebase init failed, push notifications are off:', error.message);
    }
  }

  return app;
};

/* Sends one notification to every device signed in to an account.

   Never throws and never returns a rejected promise: callers are the paths
   that move money, and a notification that could not be delivered must not
   roll back a transfer that already happened. */
export const sendPushToUser = async (userId, { title, body, data = {} }) => {
  if (!init() || !userId || !title) return { sent: 0 };

  try {
    const rows = await DeviceToken.findAll({ where: { userId }, attributes: ['token'] });
    const tokens = rows.map((row) => row.token).filter(Boolean);
    if (!tokens.length) return { sent: 0 };

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body: body || '' },
      /* Every value has to be a string or FCM rejects the whole message. */
      data: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value ?? '')])
      ),
      android: { priority: 'high', notification: { channelId: 'moneypay_activity' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });

    /* A token is dead once the app is uninstalled, and FCM says so by name.
       Left in place they accumulate for good and every send does more work for
       nothing, so the dead ones are dropped as they are found. */
    const dead = [];
    response.responses.forEach((result, index) => {
      const code = result.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        dead.push(tokens[index]);
      }
    });
    if (dead.length) await DeviceToken.destroy({ where: { token: dead } });

    return { sent: response.successCount };
  } catch (error) {
    console.warn('[push] Send failed:', error.message);
    return { sent: 0 };
  }
};

export default { sendPushToUser };
