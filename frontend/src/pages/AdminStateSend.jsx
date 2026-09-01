import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../context/store';
import { adminAPI } from '../utils/api';
import { findDestination } from '../utils/destination';
import Toast from '../components/Toast';
import { ArrowRight, Banknote, Coins, Map, Send, User } from 'lucide-react';
import Select from '../components/Select';
import '../styles/admin-state-send.css';

export default function AdminStateSend() {
  const [states, setStates] = useState([]);
  const [admins, setAdmins] = useState([]);
  /* The origin is a property of the signed-in admin, set when their account
     was created — not something to pick per transfer. Picking it meant an
     admin could book commission against a destination they have no part in. */
  const user = useAuthStore((state) => state.user);
  const myStateName = user?.state ?? null;
  const [toAdminId, setToAdminId] = useState('');
  const [toDestination, setToDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [deduct, setDeduct] = useState(true);
  const [commission, setCommission] = useState(0);
  const [receiverAmount, setReceiverAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [currencyId, setCurrencyId] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(null);

  const load = async () => {
    try {
      const sres = await adminAPI.getStateSettings();
      setStates(sres.data.states || []);
      const ures = await adminAPI.getAllUsers();
      /* Sub-admins hold destinations too, so they are valid recipients. */
      const adminsOnly = (ures.data || []).filter(u => u.role === 'admin' || u.role === 'sub-admin');
      setAdmins(adminsOnly);
      try {
        const cres = await adminAPI.getCurrencies();
        setCurrencies(cres.data.currencies || []);
      } catch (e) {
        console.debug('Currencies load failed', e?.message || e);
      }
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Failed to load data' });
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const amt = parseFloat(amount) || 0;
    const st = findDestination(states, myStateName);
    const pct = st ? parseFloat(st.commissionPercent) || 0 : 0;
    const comm = Math.round((amt * (pct / 100)) * 100) / 100;
    setCommission(comm);
    if (deduct) {
      // Deduct mode: You send full amount, receiver gets (amount - commission)
      setReceiverAmount(Math.round((amt - comm) * 100) / 100);
    } else {
      // Full mode: You send full amount, receiver gets full amount, commission credited to your card
      setReceiverAmount(amt);
    }
  }, [amount, myStateName, deduct, states]);

  const myState = findDestination(states, myStateName);
  const symbol = selectedCurrency?.symbol || selectedCurrency?.code || 'SSP';
  const amountValid = parseFloat(amount) > 0;
  const canSend = Boolean(myState && toDestination && currencyId && amountValid) && !loading;

  const handleSend = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Find the admin with the selected destination
      const receiverAdmin = admins.find(a => a.state === toDestination);
      if (!receiverAdmin) {
        setToast({ type: 'error', message: 'No admin found for the selected destination' });
        setLoading(false);
        return;
      }
      /* The server reads the origin from the sender's account. */
      const payload = { toAdminId: receiverAdmin.id, amount: Number(amount), deductCommissionFromAmount: deduct, currencyId };
      const res = await adminAPI.adminSendState(payload);
      setToast({ type: 'success', message: 'Transfer completed successfully!' });
      // Signal dashboard to refresh commission
      window.dispatchEvent(new CustomEvent('mpay:refresh-admin-commission'));
      // If we're in the admin area, reload to ensure admin pages refresh their data
      try {
        if (window.location.pathname.startsWith('/admin')) {
          // small delay so toast is visible before reload
          setTimeout(() => { window.location.reload(); }, 300);
        }
      } catch (e) {
        console.error('Auto-reload failed', e);
      }
      setAmount(''); setToDestination(''); setCurrencyId(''); setSelectedCurrency(null);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: err?.response?.data?.message || 'Send failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container state-send">
      <div className="page-header">
        <h1>Send To Destination</h1>
        <p>Transfer funds to another admin and credit the destination commission to your account.</p>
      </div>

      <form onSubmit={handleSend} className="card state-send-card">
        <div className="card-header">
          <h3><Send size={18} /> Transfer details</h3>
        </div>

        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label><Map size={14} /> From destination</label>
              <div className="ss-origin">
                {myState ? (
                  <strong>{myState.name}</strong>
                ) : (
                  <small className="ss-origin-missing">
                    No destination is assigned to your account, so commission cannot be
                    calculated. Ask an administrator to set it.
                  </small>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="ss-admin"><Map size={14} /> To Destination</label>
              <Select
                id="ss-admin"
                value={toDestination}
                onChange={setToDestination}
                placeholder="Select To Destination"
                ariaLabel="To Destination"
                options={states.map(s => ({
                  value: s.name,
                  label: s.name,
                  hint: `${parseFloat(s.commissionPercent || 0).toFixed(2)}% commission`
                }))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ss-currency"><Coins size={14} /> Currency</label>
              <Select
                id="ss-currency"
                value={currencyId}
                placeholder="Select currency"
                ariaLabel="Currency"
                onChange={(val) => {
                  setCurrencyId(val);
                  // option values are strings while Currency.id is an integer,
                  // so this has to compare as strings or it never matches.
                  const cur = currencies.find(c => String(c.id) === String(val));
                  setSelectedCurrency(cur || null);
                }}
                options={currencies.map(c => ({
                  value: String(c.id),
                  label: `${c.name} (${c.code})`,
                  hint: c.symbol || undefined,
                }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ss-amount"><Banknote size={14} /> Amount</label>
              <div className="amount-field">
                <span className="amount-prefix">{symbol}</span>
                <input
                  id="ss-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* commission mode */}
          <div className="commission-mode">
            <div className="commission-mode-copy">
              <span className="commission-mode-title">
                {deduct ? 'Deduct commission' : 'Give full amount'}
              </span>
              <span className="commission-mode-hint">
                {myState 
                  ? (deduct
                      ? `You send 100, receiver gets ${(100 - parseFloat(myState.commissionPercent)).toFixed(2)}, you keep ${parseFloat(myState.commissionPercent).toFixed(2)}% commission.`
                      : `You send 100, receiver gets 100 — you keep the ${parseFloat(myState.commissionPercent).toFixed(2)}% commission.`)
                  : 'No destination assigned to your account'}
              </span>
            </div>
            <div className="segmented" role="group" aria-label="Commission mode">
              <button
                type="button"
                className={'segmented-option' + (deduct ? ' active' : '')}
                aria-pressed={deduct}
                onClick={() => setDeduct(true)}
              >
                Deduct
              </button>
              <button
                type="button"
                className={'segmented-option' + (!deduct ? ' active' : '')}
                aria-pressed={!deduct}
                onClick={() => setDeduct(false)}
              >
                Full
              </button>
            </div>
          </div>

          {/* summary */}
          <div className="transfer-summary">
            {deduct ? (
              <>
                <div className="summary-row">
                  <span>You send</span>
                  <strong>{symbol} {(parseFloat(amount) || 0).toFixed(2)}</strong>
                </div>
                <div className="summary-row">
                  <span>Commission <em>credited to your Admin Cash</em></span>
                  <strong className="is-credit">+{symbol} {commission.toFixed(2)}</strong>
                </div>
                <div className="summary-row summary-total">
                  <span>Receiver gets <ArrowRight size={14} /></span>
                  <strong>{symbol} {receiverAmount.toFixed(2)}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="summary-row">
                  <span>You send</span>
                  <strong>{symbol} {(parseFloat(amount) || 0).toFixed(2)}</strong>
                </div>
                <div className="summary-row">
                  <span>Commission <em>credited to your Admin Cash</em></span>
                  <strong className="is-credit">+{symbol} {commission.toFixed(2)}</strong>
                </div>
                <div className="summary-row summary-total">
                  <span>Receiver gets <ArrowRight size={14} /></span>
                  <strong>{symbol} {(parseFloat(amount) || 0).toFixed(2)}</strong>
                </div>
              </>
            )}
          </div>

          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={!canSend}>
            <Send size={17} />
            {loading ? 'Sending…' : 'Send transfer'}
          </button>

          {!canSend && !loading && (
            <p className="form-hint">Select a To Destination, a currency and an amount to continue.</p>
          )}
        </div>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </form>
    </div>
  );
}
