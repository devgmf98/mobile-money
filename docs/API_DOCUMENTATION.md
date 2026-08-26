# MoneyPay API Reference

Complete reference for the MoneyPay backend — 71 endpoints across five routers, plus the Socket.IO channel. Every JSON example below is a real request or response captured against a running server, not an illustration.

- **Base URL:** `http://localhost:8080/api` (the port comes from `PORT` in `.env`; the code falls back to `5000` if it is unset)
- **Health check:** `GET /api/health` — the only unauthenticated endpoint outside `/api/auth`
- **Content type:** `application/json` for every request with a body

---

## Authentication

All protected endpoints expect a bearer token:

```
Authorization: Bearer <jwt>
```

The token is issued by `POST /api/auth/login` and carries `{ userId, role }`. Three guards run in front of the routes:

| Guard | Rejects with | When |
|---|---|---|
| `authMiddleware` | `401 No token provided` / `401 Invalid token` | Token missing, malformed, or expired |
| `adminMiddleware` | `403 Admin access required` | Caller's role is not `admin` |
| `notSuspended` | `403` | The account is flagged `isSuspended` |

Roles are `user`, `agent`, and `admin`.

**Unverified accounts cannot sign in.** Login returns `403` with `needsVerification: true` and the account's phone, so the client can route the person to phone verification rather than showing a dead end. **Admins are exempt** — an account created with `role: "admin"` is created already verified and never receives an SMS code, because it is provisioned through the API rather than self-signup.

---

## Conventions

**Errors** are always `{ "message": "..." }` with an HTTP status:

```json
{ "message": "You can't send money to this person" }
```

| Code | Meaning |
|---|---|
| `400` | Validation failure — missing field, bad amount, disallowed transfer pairing |
| `401` | Missing or invalid token |
| `403` | Authenticated but not permitted (wrong role, suspended, unverified) |
| `404` | User, agent, request, or record not found |
| `409` | State conflict — request already handled, or balance changed since it was raised |
| `500` | Unhandled server error; the message carries the underlying error text |

**Phone numbers** are accepted in any of these forms and resolved to the stored value by a shared helper (`utils/helpers.js → phoneVariants`):

```
+211912345678    211912345678    912345678    0912345678    0912 345 678
```

The national trunk zero is stripped before the country code is applied, so `0912345678` and `+211912345678` resolve to the same account.

**Money** is stored as SQL `DECIMAL` and therefore arrives from Sequelize as a **string** — note `"amount": "100.00"` rather than `100.00` in the transaction examples below. Coerce before arithmetic or formatting. Computed figures (quotes, stats) come back as numbers.

---

## Commission model

Two independent tier tables price transfers. Both are admin-editable; when a table has no row covering the amount, the hardcoded fallbacks in `utils/commission.js` apply.

**Withdrawal tiers** (`WithdrawalCommissionTier`) — used for cash-outs *and* for user→agent sends. Two commissions: the agent's cut and the company's fee. Fallback when no row matches:

| Amount | Agent | Company |
|---|---|---|
| 0 – 99 | 0% | 0% |
| 100 – 499 | 1% | 0.5% |
| 500 – 999 | 1.5% | 0.5% |
| 1000+ | 2% | 1% |

**Send-money tiers** (`SendMoneyCommissionTier`) — used for user→user and agent→user. Company fee only. Fallback when no row matches:

| Amount | Company |
|---|---|
| 0 – 99 | 0% |
| 100 – 499 | 1% |
| 500 – 999 | 2% |
| 1000+ | 3% |

**Fees are charged on top of the amount.** The sender is debited `amount + fees`; the recipient always receives the full `amount`. On a withdrawal the agent receives `amount + agentCommission`; the company keeps `companyCommission`.

This matters for any "send everything" control: `balance ÷ (1 + rate)` is **wrong**, because the rate changes by tier and the result lands in a higher bracket whose larger fee no longer fits. Use the `maxAmount` returned by the quote endpoints, which the server solves across all tiers.

---

## Who may pay whom

`sendMoney` enforces this matrix (`transferAllowed` in `transactionController.js`):

| Sender → Recipient | Allowed | Tier used |
|---|---|---|
| user → user | yes | send-money |
| user → agent | yes | **withdrawal** (it is a cash-out in all but name) |
| agent → user | yes | send-money |
| agent → agent | **no** | — agents settle through an admin |
| anyone → admin | **no** | — |

Rejections return `400` with a message naming the reason.

---

# Auth — `/api/auth`

### `POST /register`
Creates an account. Sends a 6-digit SMS code valid 10 minutes — **except for admins**, who are created verified and receive no code.

**`role` is optional and defaults to `"user"`** — that is why the first example
below omits it. Pass `"agent"` or `"admin"` to create those instead. The four
fields shown are the only required ones for every role.

```json
// request — a normal user. No role field: it defaults to "user".
{
  "name": "Gabriel Francis",
  "email": "gabriel@example.com",
  "phone": "+211912399537",
  "password": "secret123"
}
```

```json
// 201
{
  "message": "User registered. Please verify your phone number.",
  "userId": 24,
  "phone": "+211912302002",
  "isVerified": false,
  "agentId": null,
  "adminId": null
}
```

```json
// request — an agent
{
  "name": "Agent Solo",
  "email": "agent@example.com",
  "phone": "+211912301235",
  "password": "secret123",
  "role": "agent"
}
```

```json
// 201 — isVerified false: an agent still verifies by SMS.
// A 6-digit agentId is generated unless you supply one.
{
  "message": "User registered. Please verify your phone number.",
  "userId": 25,
  "phone": "+211912302003",
  "isVerified": false,
  "agentId": 112914,
  "adminId": null
}
```

```json
// request — an admin, created through the API
{
  "name": "Juba Admin",
  "email": "admin@example.com",
  "phone": "+211912300777",
  "password": "secret123",
  "role": "admin"
}
```

```json
// 201 — isVerified is TRUE: no SMS code, sign in straight away
{
  "message": "Admin registered. You can sign in now.",
  "userId": 23,
  "phone": "+211912302001",
  "isVerified": true,
  "agentId": null,
  "adminId": 214712
}
```

**400** when the email or phone is already registered.

`isVerified` in the response tells you whether the account can sign in yet:

| Role | `isVerified` | SMS code sent | Can sign in immediately |
|---|---|---|---|
| `user` | `false` | yes | no — must verify first |
| `agent` | `false` | yes | no — must verify first |
| `admin` | **`true`** | **no** | **yes** |

The phone is stored exactly as sent — normalise it client-side, or the account will be created under an unexpected form.

### `POST /verify-phone`

```json
// request
{ "phone": "0912399537", "code": "652975" }
```

```json
// 200
{ "message": "Phone verified successfully" }
```

**400** invalid or expired code · **404** no account with that number. The code is cleared on success, so it cannot be replayed.

### `POST /resend-verification`
Issues a fresh code and invalidates the previous one.

```json
// request
{ "phone": "0912399537" }
```

```json
// 200 — the same answer whether or not the number exists,
// so this cannot be used to discover registered numbers
{ "message": "If that number needs verification, a new code has been sent." }
```

### `POST /login`

Credentials go in **either** an `Authorization: Basic` header **or** the JSON
body. The header wins when both are present.

**Basic Auth** — in Postman, pick *Authorization → Basic Auth* and fill in
Username = the email, Password = the password. No body needed at all:

```
POST /api/auth/login
Authorization: Basic YmFzaWNkZW1vQGV4YW1wbGUuY29tOnNlY3JldDEyMw==
```

The header value is `base64(email + ":" + password)`. With curl:

```bash
curl -u "gabriel@example.com:secret123" -X POST http://localhost:8080/api/auth/login
```

Only the first colon separates the two, so a password may contain colons.

**JSON body** — still supported, and what the web app uses:

```json
// request — only email and password are required
{
  "email": "gabriel@example.com",
  "password": "secret123"
}
```

```json
// request — optional: where the sign-in happened
{
  "email": "gabriel@example.com",
  "password": "secret123",
  "latitude": 4.85165,
  "longitude": 31.58247
}
```

**You almost never send `latitude` / `longitude` yourself.** The web app reads them
from the browser's geolocation API and passes them through, so the account's
"last seen" location can be recorded. From Postman, or any client without a
location, just leave them out — login behaves identically.

The server ignores them unless *both* are present. If they are absent and the
account has `adminLocationConsent` set, it falls back to an IP lookup instead.

```json
// 200
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 6,
    "name": "Gabriel Francis",
    "email": "gabriel@example.com",
    "phone": "+211912399537",
    "role": "user",
    "balance": 9388
  }
}
```

```json
// 401
{ "message": "Invalid credentials" }
```

```json
// 400 — no credentials in either place
{ "message": "Provide credentials in an Authorization: Basic header, or as email and password in the body." }
```

```json
// 403 — never verified; send them to the verification step, not an error screen
{
  "message": "Please verify your phone number before signing in.",
  "needsVerification": true,
  "phone": "+211912399537"
}
```

```json
// 403 — suspended
{ "message": "Your account has been suspended. Please contact customer care to restore access." }
```

`latitude` and `longitude` are optional. Admins sign in here too — there is no separate admin login; the client routes on `user.role`.

### `POST /forgot-password`

```json
// request
{ "email": "gabriel@example.com" }
```

### `POST /reset-password`

```json
// request
{ "email": "gabriel@example.com", "code": "418203", "password": "newsecret123" }
```

**400** invalid or expired code.

### `GET /profile` · auth
Returns the caller's own record.

```json
// 200 (profileImage truncated — it is a full base64 data URI)
{
  "id": 6,
  "name": "Gabriel Francis",
  "email": "gabriel@example.com",
  "phone": "+211912399537",
  "balance": 9388,
  "autoAdminCashout": false,
  "role": "user",
  "isVerified": true,
  "isSuspended": false,
  "verificationCode": "652975",
  "verificationExpiry": "2026-08-24T11:10:06.000Z",
  "profileImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
}
```

> **Note:** this response includes a live `verificationCode`. See [known issues](#known-issues).

### `PUT /profile` · auth
Only supplied fields change.

```json
// request
{ "name": "Gabriel F.", "theme": "dark", "autoAdminCashout": true }
```

Accepts `name`, `profileImage`, `idNumber`, `autoAdminCashout`, `theme`.

### `GET /check-balance?phone=0912399537` · auth

```json
// 200
{
  "id": 6,
  "name": "Gabriel Francis",
  "phone": "+211912399537",
  "balance": 9388,
  "isVerified": true,
  "isSuspended": false
}
```

**400** phone missing · **403** account suspended · **404** not found.

---

# Transactions — `/api/transactions`

### `POST /send-money` · auth · notSuspended
The tier used depends on the recipient's role — see [who may pay whom](#who-may-pay-whom).

```json
// request
{
  "recipientPhone": "+211912399506",
  "amount": 700,
  "description": "Rent share"
}
```

```json
// 200
{
  "message": "Money sent successfully",
  "transaction": {
    "transactionId": "TXN554091116",
    "amount": 700,
    "type": "transfer",
    "status": "completed"
  }
}
```

```json
// 400 — the pairing is refused (agent→agent, or anyone→admin)
{ "message": "You can't send money to this person" }
```

```json
// 400 — the balance does not cover amount + fees
{ "message": "Insufficient balance" }
```

**404** recipient not found.

### `POST /withdraw` · auth · notSuspended
Cash-out through an agent. Debits `amount + agentCommission + companyCommission` from the user; credits `amount + agentCommission` to the agent.

```json
// request — agentId is the agent's 6-digit badge ID, not their database id
{ "agentId": "471542", "amount": 500 }
```

**400** invalid amount, insufficient balance, or the ID does not belong to an agent · **404** agent not found.

### `GET /transactions` · auth
The caller's transactions, newest first, with `sender` and `receiver` attached.

```json
// 200 — one element of the array
[
  {
    "id": 19,
    "transactionId": "TXN265771339",
    "senderId": 2,
    "receiverId": 6,
    "amount": "100.00",
    "type": "topup",
    "status": "completed",
    "description": null,
    "commission": "0.00",
    "commissionPercent": "0.00",
    "agentCommission": "0.00",
    "agentCommissionPercent": "0.00",
    "companyCommission": "0.00",
    "companyCommissionPercent": "0.00",
    "receiverCredit": null,
    "currencyCode": null,
    "currencySymbol": null,
    "exchangeRate": "1.0000000000",
    "toCurrencyCode": null,
    "convertedAmount": null,
    "exchangeMode": null,
    "currencyTier": null,
    "senderBalance": "0.00",
    "receiverBalance": "9388.00",
    "senderLocation": "\"{\\\"latitude\\\":4.85165,\\\"longitude\\\":31.58247,\\\"city\\\":\\\"Juba\\\",\\\"country\\\":\\\"South Sudan\\\"}\"",
    "receiverLocation": null,
    "createdAt": "2026-08-26T12:44:25.000Z",
    "updatedAt": "2026-08-26T12:44:25.000Z",
    "sender":   { "name": "Juba Admin", "phone": "+211921371414", "role": "admin" },
    "receiver": { "name": "Gabriel Francis", "phone": "+211912399537", "role": "user" }
  }
]
```

Two traps in that payload, both real:

- **`senderLocation` is a JSON string, sometimes double-encoded** — note the escaped quotes. Reading `.city` off it gives `undefined`. Parse it (twice if needed) before use.
- **`exchangeRate` defaults to `"1.0000000000"` on every row**, including transfers and top-ups. It does not indicate a currency conversion; check `type === "money_exchange"` or `toCurrencyCode` instead.

### `GET /stats` · auth

```json
// 200
{
  "totalTransactions": 4,
  "totalSent": 800,
  "totalReceived": 200,
  "withdrawalsCompletedCount": 0,
  "withdrawalsCompletedAmount": 0,
  "transfersCompletedCount": 0,
  "transfersCompletedAmount": 0,
  "transfersSentCount": 0,
  "transfersSentAmount": 0,
  "commissionEarned": 0,
  "pullsReceivedAmount": 0,
  "transfersReceivedAmount": 0,
  "pendingAgentCommission": 0,
  "pendingCompanyCommission": 0
}
```

### `GET /user-info/:phoneNumber` · auth

```json
// 200
{
  "id": 6,
  "name": "Gabriel Francis",
  "phone": "+211912399537",
  "balance": 9388,
  "email": "gabriel@example.com",
  "role": "user",
  "isVerified": true,
  "isSuspended": false
}
```

**404** not found.

> **Note:** this returns another account's balance and email to any authenticated caller. Its consumers only need name, phone, and role — see [known issues](#known-issues).

### `GET /agent-info/:agentId` · auth
Resolves an agent by their 6-digit badge ID, so a customer can confirm who they are paying before entering an amount.

```json
// 200 — deliberately narrower than /user-info: no balance, no email
{
  "agentId": "471542",
  "name": "Agent Solo",
  "phone": "+211912345002",
  "isSuspended": false
}
```

```json
// 400
{ "message": "Agent ID must be 6 digits" }
```

```json
// 404 — the same answer whether the ID is unknown or simply not an agent,
// so IDs cannot be enumerated
{ "message": "No agent found with that ID" }
```

### `GET /withdrawal-quote?amount=700` · auth
Prices a withdrawal using the same code path that charges it.

```json
// 200
{
  "amount": 700,
  "agentPercent": 1,
  "companyPercent": 1.5,
  "agentCommission": 7,
  "companyCommission": 10.5,
  "totalFee": 17.5,
  "totalDebit": 717.5,
  "maxAmount": 9159.02
}
```

`maxAmount` is the largest amount that still fits once fees are added — solved across every tier, then confirmed against a real quote to absorb per-component rounding.

**`&forPhone=+211912399537`** returns the ceiling for *that* account instead of the caller's, so an agent can size a pull against the customer's balance. **Honoured only for `agent` and `admin` callers**; a plain user always gets their own figure, so it cannot be used to probe balances.

Omit `amount` to get just the ceiling:

```json
// GET /withdrawal-quote  →  200
{
  "amount": 0, "agentPercent": 0, "companyPercent": 0,
  "agentCommission": 0, "companyCommission": 0,
  "totalFee": 0, "totalDebit": 0,
  "maxAmount": 9159.02
}
```

### `GET /send-quote?amount=700&recipientPhone=…` · auth
Prices a transfer. Which tier applies depends on the recipient.

```json
// 200 — recipient is a USER: send-money tier, company fee only
{
  "amount": 700,
  "companyPercent": 2,
  "companyCommission": 14,
  "totalFee": 14,
  "totalDebit": 714,
  "tier": "send",
  "recipientRole": "user",
  "allowed": true,
  "maxAmount": 9108.73
}
```

```json
// 200 — recipient is an AGENT: withdrawal tier, so an agent leg appears
{
  "amount": 700,
  "agentPercent": 1,
  "companyPercent": 1.5,
  "agentCommission": 7,
  "companyCommission": 10.5,
  "totalFee": 17.5,
  "totalDebit": 717.5,
  "tier": "withdrawal",
  "recipientRole": "agent",
  "allowed": true,
  "maxAmount": 9159.02
}
```

`allowed: false` means the pairing is refused, so a form can say so before pricing it. Without `recipientPhone`, the user-to-user rate is quoted.

---

# Withdrawal requests — `/api/withdrawals`

Agent-initiated pulls, which the customer approves on their own device. Every route requires auth and a non-suspended account.

### `POST /request`

```json
// request
{ "userPhone": "0912399537", "amount": 500 }
```

```json
// 400 — the check uses the FULL cost, matching what approval will charge, so a
// request that could never be approved is refused up front
{ "message": "User has insufficient balance", "required": 507.5, "available": 300 }
```

**404** user not found.

### `POST /approve`

```json
// request
{ "requestId": 8 }
```

```json
// 409 — the balance moved after the request was raised
{ "message": "User no longer has sufficient balance", "currentBalance": 200, "required": 507.5 }
```

**403** not your request · **404** not found · **409** already handled.

### `POST /reject`

```json
// request
{ "requestId": 8, "reason": "Customer changed their mind" }
```

### `GET /pending`

```json
// 200
{ "requests": [] }
```

---

# Notifications — `/api/notifications`

### `GET /` · auth

```json
// 200 — one element of the array
[
  {
    "id": 34,
    "recipientId": 6,
    "title": "Account Topped Up",
    "message": "Your account has been topped up with SSP 100",
    "type": "system",
    "isRead": false,
    "relatedTransactionId": 19,
    "createdAt": "2026-08-26T12:44:25.000Z",
    "updatedAt": "2026-08-26T12:44:25.000Z"
  }
]
```

### `POST /mark-as-read` · auth

```json
{ "notificationId": 34 }
```

### `POST /mark-all-as-read` · auth
No body.

### `DELETE /:notificationId` · auth
**404** not found.

### `POST /send-to-all` · auth · admin

```json
{ "title": "Scheduled maintenance", "message": "Service pauses at 22:00.", "type": "system" }
```

### `POST /send-to-user` · auth · admin

```json
{ "userId": 6, "title": "Welcome", "message": "Your account is ready.", "type": "system" }
```

**404** user not found.

---

# Admin — `/api/admin`

Every route below requires auth and a non-suspended account. Except where noted, all require the `admin` role.

## Accounts and directory

### `GET /users`
All users with balances and roles.

### `GET /user-details?id=6` *or* `?phone=0912399537`
**400** neither supplied · **404** not found.

### `GET /find-agent?agentId=471542`
**400** missing · **404** not found.

### `POST /suspend-user` · `POST /unsuspend-user`

```json
{ "userId": 6 }
```

Suspension blocks every route guarded by `notSuspended` — effectively all money movement.

### `POST /grant-location`
No body. Grants location permission to all users in one pass.

## Moving money

### `POST /topup-user`
Credits a wallet from the admin float.

```json
{ "userId": 6, "amount": 250, "description": "Cash deposited at branch" }
```

**400** invalid amount · **404** user not found.

### `POST /push-money`
Moves funds directly between two wallets. Applied immediately, with no approval step.

```json
// request
{
  "fromPhone": "+211912345001",
  "toPhone": "+211912345002",
  "amount": 1000
}
```

```json
// 200
{ "message": "Transfer completed", "transactionId": "TXN222492388" }
```

**400** same source and destination, invalid amount, or insufficient balance on the source · **404** either account not found.

Recorded as `type: "admin_push"`. When no `description` is supplied, one is generated naming the **acting admin**, so corrections stay attributable:

```
Refunded by admin (admin@example.com) from +211912399537 to +211912399506
```

### `POST /withdraw-from-user` · `POST /withdraw-from-agent`

```json
{ "userId": 6, "amount": 100, "description": "Correction" }
```

```json
{ "agentId": "471542", "amount": 100, "description": "Float recall" }
```

### `POST /request-agent-withdrawal`
Raises a cash-out request against an agent, which the **agent** approves.

```json
{ "agentId": "471542", "amount": 300 }
```

### `POST /approve-withdrawal-request` · `POST /reject-withdrawal-request` · `GET /agent-withdrawal-requests`
*auth only — no admin role*

These three are the **agent's** side of the flow above and deliberately skip `adminMiddleware`: the agent is the approver.

```json
{ "requestId": 8 }
```

```json
{ "requestId": 8, "reason": "Rejected by agent" }
```

**403** not your request · **404** not found · **409** already handled.

## Commission settings

### `GET /commission` · *any authenticated caller — no admin role*
### `POST /commission`
Retained for compatibility. Changes nothing:

```json
{ "message": "Commission settings are now managed via Tiered Commissions" }
```

### `GET /tiered-commission`

```json
// 200
{
  "sendTiers": [
    { "id": 1, "minAmount": "0.00", "maxAmount": "250.00", "companyPercent": "0.00" }
  ],
  "withdrawalTiers": [
    { "id": 1, "minAmount": "0.00",   "maxAmount": "250.00",    "agentPercent": "0.00", "companyPercent": "0.00" },
    { "id": 2, "minAmount": "251.00", "maxAmount": "500.00",    "agentPercent": "0.50", "companyPercent": "1.00" },
    { "id": 3, "minAmount": "501.00", "maxAmount": "100000.00", "agentPercent": "1.00", "companyPercent": "1.50" }
  ]
}
```

### `POST /tiered-commission` · `POST /tiered-commission/send-money` · `POST /tiered-commission/withdrawal`

```json
// POST /tiered-commission/withdrawal
{
  "withdrawalTiers": [
    { "minAmount": 0,   "maxAmount": 250,    "agentPercent": 0,   "companyPercent": 0 },
    { "minAmount": 251, "maxAmount": 500,    "agentPercent": 0.5, "companyPercent": 1 },
    { "minAmount": 501, "maxAmount": 100000, "agentPercent": 1,   "companyPercent": 1.5 }
  ]
}
```

```json
// POST /tiered-commission/send-money — no agentPercent on send tiers
{
  "tiers": [
    { "minAmount": 0,    "maxAmount": 99,     "companyPercent": 0 },
    { "minAmount": 100,  "maxAmount": 499,    "companyPercent": 1 },
    { "minAmount": 500,  "maxAmount": 999,    "companyPercent": 2 },
    { "minAmount": 1000, "maxAmount": 100000, "companyPercent": 3 }
  ]
}
```

**400** malformed. `POST /tiered-commission` takes both keys at once.

## Reporting

### `GET /stats`
Dashboard aggregates.

```json
// 200 (abridged — usersByRole, transactionsByStatus and
// myExchangesByCurrency are arrays of grouped rows)
{
  "totalUsers": 6,
  "totalTransactions": 14,
  "totalVolume": 400,
  "totalTopupVolume": 0,
  "totalAdminCashOut": 300,
  "completedTransactions": 13,
  "pendingTransactions": 1,
  "companyBenefits": 13,
  "usersByRole": [{ "role": "admin", "count": 2 }],
  "transactionsByStatus": [{ "status": "completed", "count": 13 }],
  "myExchangesByCurrency": [{ "currency": "USD", "count": 0, "total": 0 }]
}
```

Three money figures that are easy to confuse:

| Field | Scope | Card |
|---|---|---|
| `totalTopupVolume` | Company-wide top-ups — money **in** | Total Cash |
| `totalVolume` | Company-wide cash-outs — money **out** | Total Cash Out |
| `totalAdminCashOut` | **The signed-in admin only** — cash-outs where they are the receiver | You Cashed Out |

### `GET /stats/my-cashed-out`

```json
{ "totalAdminCashOut": 300 }
```

### `GET /stats/my-commission`
Commission the caller earned from `admin_state_push` transfers.

### `GET /transactions`
Every transaction, newest first, with `sender` and `receiver` attached. Same element shape as `GET /transactions/transactions` above.

## State settings

### `GET /state-settings`
### `POST /state-settings` · `PUT /state-settings/:id`

```json
{ "name": "JUBA", "commissionPercent": 5 }
```

### `DELETE /state-settings/:id`
**400** invalid · **404** not found.

## Admin-to-admin transfers by state

### `POST /send-state`

```json
// request
{
  "toAdminId": 2,
  "amount": 1000,
  "stateId": 1,
  "deductCommissionFromAmount": false,
  "currencyId": null
}
```

`deductCommissionFromAmount` decides where the state commission comes from:

- `true` — you send 100, the receiver gets 95, you keep 5 as commission
- `false` — you send 100, the receiver gets 100, the commission is added on top and credited to you

Recorded as `type: "admin_state_push"`, `status: "pending"`, with the description `Admin transfer from JUBA`. **400** invalid · **403** not permitted · **404** admin or state not found.

### `GET /send-state/pending` · `GET /send-state/pending/count`
### `POST /send-state/:id/receive` — the recipient admin confirms; funds settle
### `POST /send-state/:id/cancel` — the sender withdraws it
### `POST /send-state/:id/edit`

```json
{ "description": "Corrected", "amount": 900, "toAdminId": 2, "deductCommissionFromAmount": true }
```

All four: **403** when the caller is not a party · **404** when it does not exist.

## Currencies and exchange

### `GET /currencies`
### `POST /currencies` · `PUT /currencies/:id` · `DELETE /currencies/:id`

```json
{
  "name": "US Dollar",
  "code": "USD",
  "symbol": "$",
  "countries": "United States",
  "exchangeRate": 8000,
  "tier": 1,
  "buyingPrice": 7950,
  "sellingPrice": 8050
}
```

### `GET /exchange-rates?fromCode=SSP&toCode=USD`
Both query params optional; omit to list all.

### `POST /exchange-rates` · `PUT /exchange-rates/:id` · `DELETE /exchange-rates/:id`

```json
{ "fromCode": "SSP", "toCode": "USD", "buyingPrice": 8000, "sellingPrice": 8100, "price": 8050 }
```

### `POST /money-exchange`
Records a completed exchange.

```json
// request
{
  "amount": 1600000,
  "fromCurrency": "SSP",
  "toCurrency": "USD",
  "convertedAmount": 200,
  "rate": 0.000125
}
```

**201** with the created transaction · **400** invalid.

### `POST /convert-money-exchange`
Calculates a conversion **without recording anything**.

```json
// request
{ "amount": 1600000, "fromCurrency": "SSP", "toCurrency": "USD", "priceMode": "buying" }
```

`priceMode` is `buying` or `selling`.

---

## Transaction types

| `type` | Label | Raised by |
|---|---|---|
| `transfer` | Money Sent / Money Received | `POST /transactions/send-money` |
| `topup` | Account top-up | `POST /admin/topup-user` |
| `withdrawal` | Withdrawal | Admin withdrawal from a wallet |
| `user_withdraw` | Withdrawal | `POST /transactions/withdraw` |
| `agent_deposit` | Agent deposit | Agent float movement |
| `agent_cash_out_money` | Agent cash out | Agent → admin cash-out |
| `admin_push` | **Refunded by admin** | `POST /admin/push-money` |
| `admin_state_push` | Destination push | `POST /admin/send-state` |
| `money_exchange` | Money exchange | `POST /admin/money-exchange` |

Direction (`Money Sent` vs `Money Received`) is resolved per viewer for `transfer` only; every other type reads the same for both parties.

---

## Realtime — Socket.IO

The server runs Socket.IO alongside the REST API on the same origin.

```js
socket.emit('join-user', 6);          // enter the room user-6

socket.on('balance-updated', (p) => { /* { userId: 6, balance: 9388 } */ });
socket.on('new-notification', (n) => { /* the notification object */ });
socket.on('transaction-updated', (t) => { /* the transaction object */ });
```

| Event | Payload | Sent when |
|---|---|---|
| `balance-updated` | `{ userId, balance }` | The recipient's wallet changes, so dashboards update without a refetch |
| `new-notification` | the notification | A notification is created for that user |
| `transaction-updated` | the transaction | A transaction the user is party to changes state |

**Client → server:** `send-notification` relays a notification; `disconnect` leaves the room.

---

## Known issues

Recorded here because they affect anyone integrating against this API.

**`POST /auth/register` is unauthenticated and accepts `role: "admin"`.** Anyone who can reach the API can create an admin account — and since admins are created pre-verified, that account can sign in immediately. Removing the admin registration page did not change this. Gating the admin path behind `authMiddleware + adminMiddleware` is what would enforce "admins are provisioned by an existing admin".

**`GET /auth/profile` returns a live `verificationCode`.** It is the caller's own record, so the blast radius is limited, but an active verification code should not appear in any response.

**`GET /transactions/user-info/:phoneNumber` over-shares.** It returns any account's balance and email to any authenticated caller. Its callers only use name, phone, and role.

**`sequelize.sync({ alter: true })` runs on every boot.** It adds a fresh `UNIQUE` index to `Users` each time without reusing the previous one. MySQL caps a table at 64 keys, and once reached **the server will not start**, failing with `ER_TOO_MANY_KEYS`. Duplicate indexes can be dropped to recover, but migrations — or `sync()` without `alter` — would end it.

**`currencySymbol` stores a currency code, not a symbol** — and across rows it and `currencyCode` are populated in opposite orders, so an SSP amount can be labelled USD. Read `currencyCode` and treat `currencySymbol` as unreliable.

**`POST /admin/commission` is inert.** It answers `200` and changes nothing. Use the tiered-commission endpoints.

**Neither cash-out total filters on status.** `totalVolume` and `totalAdminCashOut` count pending and failed cash-outs alongside completed ones.
