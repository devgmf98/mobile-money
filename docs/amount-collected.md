# Amount Collected

The **Collected** column on the Reports page answers one question:

> How much cash should this admin or sub-admin be holding for this period?

It is not a balance. A balance is what the system says an account is worth;
Collected is what should physically be in the drawer. Every movement that puts
money into the staff member's hands adds to it, and every movement that takes
money back out subtracts from it.

The column is defined **only for admins and sub-admins**. A user or agent never
handles cash on the platform's behalf, so their row shows a dash.

## The formula

```
Amount Collected =
      Total Amount Sent        (state push)
    + Total Commission         (state push)
    + Total Amount             (top-up)
    - Total Received           (state push)
    - Total Amount             (money exchange)
    + Total Amount Converted   (money exchange)
    - Total Amount             (agent cash out)
```

### Why each term has the sign it does

| Term | Sign | What happened |
|---|---|---|
| Amount sent (state push) | **+** | Someone handed the admin cash so it could be pushed to another destination. |
| Commission (state push) | **+** | The admin's fee on that push, collected at the same time. |
| Amount (top-up) | **+** | Cash taken in to credit a customer's wallet. |
| Received (state push) | **−** | A push arrived at this admin's end and they paid the cash out. |
| Amount (money exchange) | **−** | The currency given out to make the exchange. |
| Amount Converted (money exchange) | **+** | The currency taken back in return. |
| Amount (agent cash out) | **−** | Cash paid out to an agent. |

### The exchange contributes two terms, in two currencies

An exchange row carries two figures — `amount` in `currencyCode` and
`convertedAmount` in `toCurrencyCode` — and **both** are in this calculation,
with opposite signs. The currency given out is subtracted; the currency taken
back in return is added.

So one trade moves two buckets in opposite directions. It never nets to a single
number, because the two legs are different units.

## Two rules that govern the whole figure

### 1. Completed transactions only

A **pending** push has collected nothing yet — the money is in flight and
nobody has settled anything. A **cancelled** one never will. Only rows with
`status = 'completed'` count, in every term.

This means the Collected figure and the Sent/Received columns beside it will not
tie out: those count every status, this counts one.

It also means a currency can legitimately read `0.00` — see the edge cases
below. That is the true answer to "how much of this currency should I be
holding" when everything in it is still pending.

### 2. Per currency, never across

Each term lands in the bucket of the currency it was denominated in, and the
arithmetic happens inside that bucket. There is no cross-rate at report time, so
a single figure spanning SSP, USD and UGX would be adding unlike units.

A money exchange writes **two** different currencies onto one row:

```
amount 800,000 SSP  ->  convertedAmount 100 USD
(currencyCode)          (toCurrencyCode)
```

That single row takes 800,000 off the SSP bucket and puts 100 onto the USD one.
Netting the two legs into a single number would be meaningless: they are
different units.

A staff member who trades in three currencies gets three lines, and any of them
may be negative.

## Which side of the row the staff member sits on

This differs by transaction type, and getting it wrong silently inverts a term.

| Type | Staff member is the… | Column read |
|---|---|---|
| `admin_state_push` (sent) | sender | `senderId` |
| `admin_state_push` (received) | settler | `settledById` |
| `money_exchange` | sender — an exchange has no receiver | `senderId` |
| `topup` | sender — the customer is the receiver | `senderId` |
| `agent_cash_out_money` | **receiver** — the agent is the sender | `receiverId` |

`agent_cash_out_money` is the trap: the agent initiates it, so the admin is on
the receiving side of the record even though they are the one paying out cash.

## "Received" means settled, not addressed

For a state push, Received counts the transfers the staff member **marked as
received** (`settledById`), not the ones merely addressed to them. Any admin can
settle any transfer, so the person who confirms a push need not be the one it
was sent to — and confirming it is the act that puts them on the hook for paying
the cash out.

This is the same definition the Received column uses, so the two reconcile.

### Nobody is inferred

A push completed before the `settledAt` / `settledById` columns existed records
**no settler at all**, and "marked as received by" cannot honestly name someone
the row does not. Those rows count for nobody.

There are 4 such rows, worth 400,000.00 SSP, and excluding them makes two
admins' figures materially less negative:

| | with a fallback | strict |
|---|---|---|
| Juba Admin | −2,285,200.00 SSP | −2,185,200.00 SSP |
| Admin User | −90,100.00 SSP | **+209,900.00 SSP** |

Net collected is 400,000.00 SSP higher under the strict reading, for the same
reason.

The cash on those four pushes really was paid out by someone, so the strict
reading leaves 400,000.00 SSP of genuine outflow unattributed. That is the
trade: a figure that under-subtracts on old rows, against one that names a
person the record does not. The strict reading was chosen deliberately, and the
gap shrinks to nothing as new transfers accumulate — every push settled since
the column existed carries its settler.

## Edge cases

- **Every currency the person deals in gets a line, including 0.00.** Presence
  is decided over *every* status, while the arithmetic stays completed-only. So
  a currency whose activity is entirely pending shows `0.00` rather than
  disappearing — otherwise a reader cannot tell "no UGX business" from "UGX
  business, none of it settled yet", which are very different things to someone
  counting cash. A currency the person has never touched is not listed at all.
- **A currency only ever converted into still gets a real figure**, because the
  converted leg is a term in the formula. Exchanging SSP for USD adds to the USD
  bucket even if the person never handled USD any other way.
- **Negative results are legitimate.** An admin who paid out more than they took
  in during the period is genuinely negative for that currency, and the column
  shows it in red rather than hiding it.

## Net collected — the company's position

The **Net collected** panel in the overview is every staff member's Collected
figure added together, per currency:

```
Juba Admin    −2,185,200.00 SSP     199.00 USD
Sub Admin        801,000.00 SSP    −100.00 USD    0.00 UGX
Admin User       209,900.00 SSP
Wau admin              0.00 SSP
──────────────────────────────────────────────────────────
Net collected −1,174,300.00 SSP      99.00 USD    0.00 UGX
```

This is what came in through admins and sub-admins, less what went back out.
It is deliberately the *same* definition as the column, at a different scale, so
the two can never disagree.

Adding across **people** is safe in a way adding across **currencies** is not: a
thousand SSP is a thousand SSP whoever took it in, while a thousand SSP and a
thousand UGX are not two thousand of anything. So the panel stays split by
currency like every other figure on the page, and a negative line means the
company paid out more of that currency than it took in over the period.

## A related figure: transactions per person

The **Txns** column counts the transactions a person took part in, **once
each**, on whichever side they appear — sender, receiver or settler.

It is not `sent + received`. That sum was wrong in both directions:

- it **double-counted** anyone appearing on both sides of one row (an admin who
  settles a push they sent themselves is one transaction, not two);
- it **undercounted** staff badly, because their Received only counts pushes
  they settled — so being the addressee of a still-pending push, or the receiver
  of an agent cash-out, did not register at all.

One sub-admin showed 6 against 9 real transactions, and two admins showed 0
against 2 and 5. The count is now a distinct count over all three roles, across
all statuses.

## Where it lives

- Calculation: `backend/controllers/reportsController.js`, the
  `AMOUNT COLLECTED` block.
- Display: `frontend/src/pages/AdminReports.jsx`, the `Collected` column, which
  also carries the formula as a tooltip.
- The figure is included in the CSV export, one `amount CODE` pair per currency
  separated by `|`.
