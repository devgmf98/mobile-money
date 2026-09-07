# MoneyPay Mobile

A Flutter client for the MoneyPay South Sudan API, for **customers** and
**agents**. It talks to the same Express backend as the React web app in
[`../frontend`](../frontend) — same endpoints, same tokens, same QR payload — so
the two are interchangeable for a given account.

## Running it

```bash
cd mobile
flutter pub get
flutter run
```

By default it points at the deployed Railway API, exactly as the production web
build does. To run against a backend on your own machine:

```bash
# Android emulator - 10.0.2.2 is the host machine from inside the emulator
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:8080/api \
  --dart-define=SOCKET_URL=http://10.0.2.2:8080

# iOS simulator or a physical device on the same network
flutter run \
  --dart-define=API_BASE_URL=http://192.168.1.10:8080/api \
  --dart-define=SOCKET_URL=http://192.168.1.10:8080
```

Both values are read in [`lib/core/config/env.dart`](lib/core/config/env.dart).

```bash
flutter test       # 45 unit tests, no network needed
flutter analyze    # clean
```

## How it is laid out

```
lib/
  core/       config, colour and type tokens, phone and money formatting
  data/       API clients, models, session storage
  state/      ChangeNotifier controllers + the Socket.IO connection
  ui/         widgets/ (shared kit) and screens/ (one folder per area)
  routing/    named routes
```

State is `provider` over three controllers:

| Controller               | Owns                                                   |
| ------------------------ | ------------------------------------------------------ |
| `AuthController`         | the session, the signed-in account, the balance, the app lock |
| `WalletController`       | transactions, stats, pending cash-out approvals        |
| `NotificationController` | the bell and its list                                  |

The balance lives on `AuthController` alone rather than in both places, so there
is one figure that cannot disagree with itself. `RealtimeService` holds a single
Socket.IO connection and joins the `user-<id>` room — the server emits into that
room, so joining is what makes `balance-updated` and `new-notification` arrive
at all.

## What it does

**Both roles** — sign up (with SMS phone verification), sign in, forgot/reset
password, send money, receive by QR, scan to pay, transaction history with
filters and search, transaction detail and shareable receipts, live balance and
notifications, profile and photo, help centre, contact support, and an optional
four-digit app lock.

**Customers** — withdraw cash through an agent by their six-digit ID, and
approve or decline cash-outs an agent has requested.

**Agents** — request a cash-out from a customer by phone number, and see float
and commission (earned, and pending a customer's approval).

Admin and sub-admin accounts are turned away at sign-in with a message pointing
at the web console; the mobile app deliberately has no admin surface.

## Where it departs from the mockup, and why

Three things in the design have nothing behind them on the API. Rather than fake
them, they are built and honestly gated:

| Design screen      | What it does here                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buy Airtime**    | Full screen; the request goes through `ServicesApi` and reports that the service is not connected. No `/api/services/airtime` route exists.       |
| **Pay Bills**      | Same — biller list and payment form, no `/api/services/bills` route to send it to.                                                              |
| **Agents locator** | The map is replaced by lookup-by-agent-ID. There is no agent directory endpoint and no trading location on an account, so a map would draw pins for data that does not exist. |

All three are stubbed in one file,
[`lib/data/api/services_api.dart`](lib/data/api/services_api.dart), each with the
route it is waiting on. Wiring them up later is a change to that file alone —
the screens work unchanged.

Two smaller deviations:

- **Sign-in is email + password, not phone + PIN.** `POST /api/auth/login` looks
  an account up by email and there is no phone-based endpoint, so the form asks
  for the credential the account actually has. The mockup's four-digit PIN is
  honoured as the **app lock** (Profile → Security), which is what a four-digit
  code is fit to protect: it never leaves the device, and forgetting it costs a
  sign-in rather than access to the account.
- **The history filter row reads All / Sent / Received / Withdrawals**, not
  "Bills" — bills do not exist yet, and withdrawals are the fourth thing this
  system actually records.

## Notes for whoever picks this up next

- **Decimals arrive as strings.** mysql2 returns every `DECIMAL` column as text,
  so a balance is `"125750.00"`, not `125750`. Everything goes through
  [`P`](lib/data/models/parse.dart); do not call `as double` on an API field.
- **Fees are never computed on the client.** Tiers are configurable by an admin
  and change with the amount, so every figure comes from `/send-quote` or
  `/withdrawal-quote` — the same server helper that later charges it.
- **Paying an agent is a cash-out.** The server prices a transfer to an agent on
  the withdrawal tier even though the customer used the send form; the quote says
  which tier applied and the fee breakdown labels it.
- **Phone numbers are stored inconsistently** (`+211…`, `211…`, `0…`, bare).
  [`Phone`](lib/core/utils/phone.dart) mirrors the server's `phoneVariants`
  helper. If that helper changes, change this one too — `test/phone_test.dart`
  pins the cases.
- **The QR payload shape is shared with the web app** (three phone keys plus
  `type: 'payment'`). Changing it splits the two apps.
- **`/withdrawals/pending` is customer-side only.** It returns requests awaiting
  *your* approval. There is no endpoint for an agent to list their own
  outstanding requests, which is why the agent screen confirms a request was
  sent rather than showing a queue.

## Release build

`android/app/build.gradle.kts` still signs release builds with the debug key, as
generated. Add a real signing config before shipping.
