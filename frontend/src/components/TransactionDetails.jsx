import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, Check, Copy, MapPin, X } from 'lucide-react';
import { typeLabel } from '../data/transactionTypes';
import { placeLabel } from '../utils/location';
import '../styles/transaction-details.css';

const n2 = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/* DECIMAL columns arrive from Sequelize as strings; coerce before formatting. */
const money = (v, symbol = 'SSP') =>
  symbol + ' ' + n2(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const rate = (v) => (v === null || v === undefined || v === '' || !n2(v) ? '' : ' (' + n2(v) + '%)');

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
};

const initialOf = (s) => (s || '?').trim().charAt(0).toUpperCase();

/* A party block: who they are, how to reach them, what role they hold. Replaces
   four interchangeable label/value rows that gave the reader no shape. */
function Party({ tag, person, fallbackId, place }) {
  const name = person?.name || person?.phone || (fallbackId ? 'Account #' + fallbackId : 'System');
  return (
    <div className="td-party">
      <span className="td-avatar">{initialOf(person?.name || person?.phone)}</span>
      <span className="td-party-copy">
        <span className="td-party-tag">{tag}</span>
        <span className="td-party-name">{name}</span>
        {person?.phone && person?.name && <span className="td-party-sub">{person.phone}</span>}
        {place && (
          <span className="td-party-place"><MapPin size={11} /> {place}</span>
        )}
      </span>
      {person?.role && <span className="td-role">{person.role}</span>}
    </div>
  );
}

/* Rows with no value are dropped rather than shown as an em dash — a transfer
   has no exchange rate and a top-up has no agent commission, so printing every
   field for every type buries the handful that matter. Filtering happens here,
   not in a child: an element is always truthy, so a child-level check would
   leave empty sections rendering their heading alone. */
function Section({ title, items }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!shown.length) return null;

  return (
    <section className="td-section">
      <h4>{title}</h4>
      <dl className="td-rows">
        {shown.map(([label, value, strong]) => (
          <div className={'td-row' + (strong ? ' is-strong' : '')} key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function TransactionDetails({ transaction: tx, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    /* The list behind the dialog must not scroll while it is open. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!tx) return null;

  const agentFee = n2(tx.agentCommission ?? tx.commission);
  const companyFee = n2(tx.companyCommission);
  const totalFee = agentFee + companyFee;
  const isExchange = tx.type === 'money_exchange' || !!tx.toCurrencyCode || tx.convertedAmount != null;

  /* currencySymbol stores a currency CODE despite its name, and on some rows it
     holds the target currency while currencyCode holds the source — trusting it
     labelled an SSP amount as USD. Only currencyCode is used, and only on an
     exchange; everything else in this system is SSP. */
  const symbol = isExchange ? (tx.currencyCode || 'SSP') : 'SSP';
  const toSymbol = tx.toCurrencyCode || tx.currencySymbol || symbol;

  const copyId = () => {
    if (tx.transactionId) navigator.clipboard?.writeText(tx.transactionId).catch(() => {});
  };

  return createPortal(
    <div className="td-scrim" onClick={onClose}>
      <div
        className="td-panel"
        role="dialog"
        aria-modal="true"
        aria-label={'Transaction ' + (tx.transactionId || '')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="td-head">
          <div className="td-head-top">
            <span className={'td-type is-' + tx.type}>{typeLabel(tx.type)}</span>
            <button type="button" className="td-close" onClick={onClose} aria-label="Close">
              <X size={17} />
            </button>
          </div>

          <h3 className="td-amount">{money(tx.amount, symbol)}</h3>

          <div className="td-meta">
            {tx.status && (
              <span className={'td-status is-' + tx.status}>
                {tx.status === 'completed' && <Check size={11} />}
                {tx.status}
              </span>
            )}
            {when(tx.createdAt) && <span className="td-when">{when(tx.createdAt)}</span>}
          </div>

          <button type="button" className="td-ref" onClick={copyId} title="Copy reference">
            {tx.transactionId || 'No reference'} <Copy size={11} />
          </button>
        </header>

        <div className="td-body">
          {/* Direction reads top to bottom, so the transfer is legible at a
              glance instead of assembled from four separate rows. */}
          <section className="td-section">
            <h4>Parties</h4>
            <div className="td-flow">
              <Party tag="From" person={tx.sender} fallbackId={tx.senderId} place={placeLabel(tx.senderLocation)} />
              <span className="td-flow-arrow"><ArrowDown size={14} /></span>
              <Party tag="To" person={tx.receiver} fallbackId={tx.receiverId} place={placeLabel(tx.receiverLocation)} />
            </div>
          </section>

          {/* The rate rides on the fee's own label — as its own row it read as
              a separate figure of equal importance. */}
          <Section
            title="Breakdown"
            items={[
              ['Amount', money(tx.amount, symbol)],
              ['Agent commission' + rate(tx.agentCommissionPercent ?? tx.commissionPercent),
                agentFee ? money(agentFee, symbol) : null],
              ['Service fee' + rate(tx.companyCommissionPercent),
                companyFee ? money(companyFee, symbol) : null],
              ['Sender paid', totalFee ? money(n2(tx.amount) + totalFee, symbol) : null, true],
              ['Recipient received', tx.receiverCredit != null
                ? money(tx.receiverCredit, isExchange ? toSymbol : symbol) : null, true],
            ]}
          />

          {/* Only for actual conversions — exchangeRate defaults to 1 on every
              row, which otherwise put an empty block on transfers and top-ups. */}
          <Section
            title="Currency exchange"
            items={!isExchange ? [] : [
              ['Converted to', tx.convertedAmount != null ? money(tx.convertedAmount, toSymbol) : null, true],
              ['Rate', tx.exchangeRate != null
                ? '1 ' + symbol + ' = ' + n2(tx.exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ' + toSymbol
                : null],
              ['Mode', tx.exchangeMode],
              ['Tier', tx.currencyTier],
            ]}
          />

          <Section title="Note" items={[['Description', tx.description]]} />
        </div>
      </div>
    </div>,
    document.body
  );
}
