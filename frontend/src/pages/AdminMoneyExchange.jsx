import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../utils/api';
import Select from '../components/Select';
import '../styles/admin-money-exchange.css';
import {
  ArrowRight, ArrowRightLeft, ArrowUpDown, ChartColumn, CircleCheck, CircleX,
  Coins, Link2, RefreshCw, Save, Settings2, Wallet
} from 'lucide-react';

export default function AdminMoneyExchange() {
  const [pairRates, setPairRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('SSP');
  const [amount, setAmount] = useState(1);
  const [priceMode, setPriceMode] = useState('buying');
  const [result, setResult] = useState('');
  const [usedPair, setUsedPair] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState('success');
  const [saving, setSaving] = useState(false);

  // Extract unique from/to codes from pairwise rates
  const pairCodes = {
    from: [...new Set(pairRates.map(p => (p.fromCode || '').toUpperCase()).filter(Boolean))],
    to: [...new Set(pairRates.map(p => (p.toCode || '').toUpperCase()).filter(Boolean))]
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminAPI.getExchangeRates();
      const rd = r?.data || r;
      const pr = Array.isArray(rd) ? rd : (Array.isArray(rd?.exchangeRates) ? rd.exchangeRates : []);
      setPairRates(pr);
      // keep the selects on codes that actually exist
      const froms = [...new Set(pr.map(p => (p.fromCode || '').toUpperCase()).filter(Boolean))];
      const tos = [...new Set(pr.map(p => (p.toCode || '').toUpperCase()).filter(Boolean))];
      if (froms.length && !froms.includes(from)) setFrom(froms[0]);
      if (tos.length && !tos.includes(to)) setTo(tos[0]);
    } catch (e) {
      console.debug('Failed to load pair rates', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const amountValid = Number(amount) > 0;
  const canConvert = Boolean(from && to && amountValid) && !converting;

  const convert = async () => {
    setUsedPair(null);
    setResult('');
    const a = Number(amount || 0);
    if (!from || !to || !a) return;

    setConverting(true);
    try {
      const response = await adminAPI.convertMoneyExchange({
        amount: a,
        fromCurrency: from,
        toCurrency: to,
        priceMode
      });
      const data = response?.data || response;
      if (data && data.convertedAmount !== undefined) {
        setResult(data.convertedAmount);
        setUsedPair(data.usedPair);
      } else {
        setResult('Error: Invalid response from server');
      }
    } catch (error) {
      console.error('Conversion failed:', error);
      setResult('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setConverting(false);
    }
  };

  const saveTransaction = async () => {
    if (!result || !usedPair) {
      setSaveStatus('error');
      setSaveMessage('Please perform a conversion first');
      return;
    }
    setSaving(true);
    try {
      await adminAPI.createTransaction({
        amount: Number(amount),
        fromCurrency: from,
        toCurrency: to,
        convertedAmount: Number(result),
        priceMode,
        pairUsed: { fromCode: usedPair.pair.fromCode, toCode: usedPair.pair.toCode, buyingPrice: usedPair.pair.buyingPrice, sellingPrice: usedPair.pair.sellingPrice },
        type: 'money_exchange',
        // NOTE: the " → " separator is parsed back out by the admin dashboard.
        description: `Money Exchange: ${amount} ${from} → ${result} ${to} (${priceMode})`
      });
      setSaveStatus('success');
      setSaveMessage('Transaction saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (e) {
      console.error('Failed to save transaction', e);
      setSaveStatus('error');
      setSaveMessage('Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const hasPairs = pairCodes.from.length > 0 && pairCodes.to.length > 0;
  const resultIsError = typeof result === 'string' && result.startsWith('Error:');

  return (
    <div className="page-container money-exchange">
      <div className="page-header exchange-header">
        <div>
          <h1>Money Exchange</h1>
          <p>Convert between currencies using your configured pairwise rates.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh rates
        </button>
      </div>

      {loading ? (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon"><RefreshCw size={22} className="spin" /></span>
            <h3>Loading exchange rates…</h3>
          </div>
        </div>
      ) : !hasPairs ? (
        // The selects are built from configured pairs, so with none set up they
        // render blank. Say so, rather than showing an unusable converter.
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon"><ArrowRightLeft size={22} /></span>
            <h3>No exchange rates configured</h3>
            <p>
              This converter reads your saved currency pairs. Add at least one pair
              before converting.
            </p>
            <div className="setup-links">
              <Link className="btn btn-primary btn-sm" to="/admin/currency-rates">
                <ChartColumn size={15} /> Set exchange rates
              </Link>
              <Link className="btn btn-secondary btn-sm" to="/admin/currencies">
                <Coins size={15} /> Manage currencies
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="exchange-grid">
            {/* converter */}
            <div className="converter-panel">
              <div className="conv-field">
                <label htmlFor="mx-from">From</label>
                <Select
                  id="mx-from"
                  value={from}
                  onChange={setFrom}
                  ariaLabel="From currency"
                  className="conv-select"
                  options={pairCodes.from.map(c => ({ value: c, label: c }))}
                />
                <div className="conv-amount">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    aria-label="Amount to convert"
                  />
                  <span className="conv-code">{from}</span>
                </div>
              </div>

              <button
                className="conv-swap"
                onClick={() => { const t = from; setFrom(to); setTo(t); }}
                title="Swap currencies"
                aria-label="Swap currencies"
                type="button"
              >
                <ArrowUpDown size={18} />
              </button>

              <div className="conv-field">
                <label htmlFor="mx-to">To</label>
                <Select
                  id="mx-to"
                  value={to}
                  onChange={setTo}
                  ariaLabel="To currency"
                  className="conv-select"
                  options={pairCodes.to.map(c => ({ value: c, label: c }))}
                />
                <div className={'conv-result' + (resultIsError ? ' is-error' : '')}>
                  <span className="conv-result-value">{resultIsError ? '—' : (result || '0.00')}</span>
                  <span className="conv-code">{to}</span>
                </div>
              </div>
            </div>

            {/* summary */}
            <div className="card exchange-summary">
              <div className="card-header">
                <h3><Settings2 size={18} /> Conversion</h3>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label htmlFor="mx-mode">Exchange mode</label>
                  <Select
                    id="mx-mode"
                    value={priceMode}
                    onChange={setPriceMode}
                    ariaLabel="Exchange mode"
                    options={[
                      { value: 'buying', label: 'Buying', hint: 'You receive the target currency' },
                      { value: 'selling', label: 'Selling', hint: 'You send the source currency' },
                    ]}
                  />
                </div>

                <dl className="exchange-rows">
                  <div className="exchange-row">
                    <dt><Wallet size={15} /> You send</dt>
                    <dd>{amount || 0} <span className="unit">{from}</span></dd>
                  </div>
                  <div className="exchange-row">
                    <dt><CircleCheck size={15} /> You receive</dt>
                    <dd className="is-total">{resultIsError ? '—' : (result || '0.00')} <span className="unit">{to}</span></dd>
                  </div>
                  <div className="exchange-row">
                    <dt><Link2 size={15} /> Pair used</dt>
                    <dd>
                      {usedPair ? (
                        <span className="pair-tag">
                          {usedPair.pair.fromCode} <ArrowRight size={13} /> {usedPair.pair.toCode}
                          <em>{usedPair.inverse ? 'inverse' : 'direct'}</em>
                        </span>
                      ) : <span className="muted">Not converted yet</span>}
                    </dd>
                  </div>
                </dl>

                {resultIsError && <p className="conv-error">{result}</p>}

                <div className="exchange-actions">
                  <button className="btn btn-primary btn-block" onClick={convert} disabled={!canConvert}>
                    <RefreshCw size={16} className={converting ? 'spin' : ''} />
                    {converting ? 'Converting…' : 'Convert'}
                  </button>
                  {result !== '' && result !== null && !resultIsError && (
                    <button className="btn btn-success btn-block" onClick={saveTransaction} disabled={saving}>
                      <Save size={16} /> {saving ? 'Saving…' : 'Save transaction'}
                    </button>
                  )}
                </div>

                {saveMessage && (
                  <p className={'save-note' + (saveStatus === 'success' ? ' is-success' : ' is-error')}>
                    {saveStatus === 'success' ? <CircleCheck size={15} /> : <CircleX size={15} />}
                    {saveMessage}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* rate detail */}
          {usedPair && (
            <div className="card">
              <div className="card-header">
                <h3><ChartColumn size={18} /> Rate details</h3>
              </div>
              <div className="card-body">
                <div className="rate-grid">
                  <div className="rate-tile">
                    <span className="rate-label">Pair</span>
                    <span className="rate-value">
                      {usedPair.pair.fromCode} <ArrowRight size={14} /> {usedPair.pair.toCode}
                    </span>
                  </div>
                  <div className="rate-tile">
                    <span className="rate-label">Rate type</span>
                    <span className="rate-value">{usedPair.pair.priceType === 'fixed' ? 'Fixed' : 'Percentage'}</span>
                  </div>
                  <div className="rate-tile">
                    <span className="rate-label">Buying rate</span>
                    <span className="rate-value">{usedPair.pair.buyingPrice ?? '—'}</span>
                  </div>
                  <div className="rate-tile">
                    <span className="rate-label">Selling rate</span>
                    <span className="rate-value">{usedPair.pair.sellingPrice ?? '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
