/* The modular API, which is the only one firebase-admin v13+ has. The
   namespaced form -- admin.credential.cert, admin.messaging() -- reads like
   every example written before v12 and is simply absent now: `admin.credential`
   is undefined, so init threw, the catch below reported "push is off", and
   nothing was ever sent. */
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
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

  /* A default app may already exist -- another import, a reload -- and
     initializeApp throws rather than returning it. */
  const existing = getApps();
  if (existing.length) {
    app = existing[0];
    return app;
  }

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
      const credentials = JSON.parse(raw);
      /* Railway and most dashboards store a multi-line value with the newlines
         escaped, and the private key is the one field that cares. */
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      app = initializeApp({ credential: cert(credentials) });
      console.log(`[push] Firebase ready for project ${credentials.project_id}`);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = initializeApp({ credential: applicationDefault() });
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

    /* Said out loud, because the two ways this goes wrong look identical from
       the outside -- a phone that never registered and a push that was sent
       and not shown both end in silence. This line separates them: no tokens
       means the app never handed one over, which is a device problem; a send
       count means the failure is after us. */
    if (!tokens.length) {
      console.warn(`[push] No device registered for user ${userId} - nothing sent`);
      return { sent: 0 };
    }

    const response = await getMessaging(app).sendEachForMulticast({
      tokens,
      notification: { title, body: body || '' },
      /* Every value has to be a string or FCM rejects the whole message. */
      data: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value ?? '')])
      ),
      /* Must match LocalNotifications.channelId in the app exactly. A push
         naming a channel the device does not have makes Android create one at
         default importance, and a channel's importance is fixed at creation --
         so a mismatch here does not fail loudly, it quietly downgrades every
         notification on that phone for the life of the install. */
      android: { priority: 'high', notification: { channelId: 'moneypay_activity_v2' } },
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

    console.log(
      `[push] user ${userId}: ${response.successCount}/${tokens.length} delivered` +
        (dead.length ? `, ${dead.length} stale token(s) dropped` : '')
    );
    if (response.failureCount) {
      /* The per-token reason, which is the only thing that distinguishes a
         misconfigured project from an uninstalled app. */
      response.responses.forEach((result, index) => {
        if (result.error) {
          console.warn(`[push]   token ${index}: ${result.error.code} - ${result.error.message}`);
        }
      });
    }

    return { sent: response.successCount };
  } catch (error) {
    console.warn('[push] Send failed:', error.message);
    return { sent: 0 };
  }
};

export default { sendPushToUser };
