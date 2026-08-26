import React, { useEffect, useState } from 'react';
import { adminAPI } from '../utils/api';
import '../styles/layout.css';
import { ArrowRight, ArrowRightLeft, ArrowUpDown, ChartColumn, CircleCheck, CircleDollarSign, Link2, Wallet, Wrench, Zap } from 'lucide-react';

export default function AdminCurrencyConverter() {
  const [currencies, setCurrencies] = useState([]);
  const [amount, setAmount] = useState('1000');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState('');
  const [priceMode, setPriceMode] = useState('buying'); // 'buying' or 'selling'
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState(null);
  const [pairRates, setPairRates] = useState([]);
  const [usedPairState, setUsedPairState] = useState(null);

  // Platform base currency code (fallback to 'SSP' if not provided via Vite env)
  const BASE_CURRENCY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BASE_CURRENCY) || 'SSP';

  // Determine effective numeric rate for a currency and side (buying/selling)
  // NOTE: Converter should use ONLY buying/selling prices. If a required side price
  // is missing the converter will treat the rate as unavailable (null) and not perform conversion.
  // Special-case: treat platform base currency (e.g. SSP) as having an implicit rate of 1 when prices are missing.
  const getEffectiveRate = (cur, side) => {
    if (!cur) return null;
    const pt = cur.priceType || 'fixed';
    const code = (cur.code || '').toUpperCase();
    // Fixed prices: expect absolute numbers in buyingPrice/sellingPrice
    if (pt === 'fixed') {
      const val = side === 'buying' ? cur.buyingPrice : cur.sellingPrice;
      if (val !== undefined && val !== null && val !== '') return Number(val);
      // Allow base currency to default to 1 when explicit prices are not set
      if (code === (BASE_CURRENCY || 'SSP').toUpperCase()) return 1;
      return null;
    }
    // Percentage prices: require an exchangeRate to compute the absolute price
    if (pt === 'percentage') {
      const pct = side === 'buying' ? cur.buyingPrice : cur.sellingPrice;
      // If pct and exchangeRate available, compute
      if (pct !== undefined && pct !== null && pct !== '' && cur.exchangeRate !== undefined && cur.exchangeRate !== null && cur.exchangeRate !== '') {
        return Number(cur.exchangeRate) * (1 + Number(pct) / 100);
      }
      // If pct available but exchangeRate missing, allow base currency to use 1 as base
      if (pct !== undefined && pct !== null && pct !== '' && code === (BASE_CURRENCY || 'SSP').toUpperCase()) {
        return 1 * (1 + Number(pct) / 100);
      }
      return null;
    }
    return null;
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await adminAPI.getCurrencies();
        const data = res?.data || res;
        const list = Array.isArray(data) ? data : (Array.isArray(data?.currencies) ? data.currencies : []);
        if (!mounted) return;
        setCurrencies(list);
        if (list.length > 0) {
          const usd = list.find(c => (c.code || '').toUpperCase() === 'USD');
          const defaultFrom = usd ? (usd.code || 'USD').toUpperCase() : (list[0].code || '').toUpperCase();
          const defaultTo = (list.find(c => (c.code || '').toUpperCase() !== defaultFrom) || list[0]).code.toUpperCase();
          setFrom(defaultFrom);
          setTo(defaultTo);
        }
        // load pairwise rates
        try {
          const r = await adminAPI.getExchangeRates();
          const rd = r?.data || r;
          const pr = Array.isArray(rd) ? rd : (Array.isArray(rd?.exchangeRates) ? rd.exchangeRates : []);
          if (mounted) setPairRates(pr);
        } catch (e) {
          console.debug('Failed to load pairwise rates', e);
        }
      } catch (err) {
        console.error('Failed to load currencies', err);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const a = Number(amount || 0);
    if (!from || !to || !a) {
      setResult('');
      return;
    }
    const f = currencies.find(c => (c.code || '').toUpperCase() === (from || '').toUpperCase());
    const t = currencies.find(c => (c.code || '').toUpperCase() === (to || '').toUpperCase());
    if (!f || !t) {
      setResult('');
      return;
    }

    // Determine transactional rates based on selected mode.
    // Prefer pairwise rates if configured for the selected from->to pair.
    const pair = pairRates.find(p => (p.fromCode || '').toUpperCase() === (from || '').toUpperCase() && (p.toCode || '').toUpperCase() === (to || '').toUpperCase());
    const inversePair = pairRates.find(p => (p.fromCode || '').toUpperCase() === (to || '').toUpperCase() && (p.toCode || '').toUpperCase() === (from || '').toUpperCase());

    let usedPair = null;
    let convertedRaw = null;

    // If a direct pair exists and has the appropriate side price, use it directly
    if (pair) {
      usedPair = { pair, inverse: false };
      const sideKey = priceMode === 'buying' ? 'buyingPrice' : 'sellingPrice';
      const sideVal = pair[sideKey];
      if (sideVal !== undefined && sideVal !== null && sideVal !== '') {
        // Direct pair provides rate as: 1 [from] = [sideVal] [to]
        convertedRaw = Number(a) * Number(sideVal);
      }
    }

    // If direct conversion not available try using inverse pair (reciprocal)
    if (convertedRaw == null && inversePair) {
      usedPair = { pair: inversePair, inverse: true };
      // For inverse, pick the opposite side as the basis then invert.
      // e.g., if inversePair represents (to -> from) with selling/buying prices in [from] per [to],
      // the direct rate (from -> to) is reciprocal of that side.
      const invSideKey = priceMode === 'buying' ? 'sellingPrice' : 'buyingPrice';
      const invSideVal = inversePair[invSideKey];
      if (invSideVal !== undefined && invSideVal !== null && invSideVal !== '' && Number(invSideVal) !== 0) {
        convertedRaw = Number(a) / Number(invSideVal);
      }
    }

    // If neither direct nor inverse pair produced a conversion, fall back to per-currency effective rates
    let fromRate = null;
    let toRate = null;
    if (convertedRaw == null) {
      fromRate = priceMode === 'buying' ? getEffectiveRate(f, 'selling') : getEffectiveRate(f, 'buying');
      toRate = priceMode === 'buying' ? getEffectiveRate(t, 'buying') : getEffectiveRate(t, 'selling');
    }

    // Ensure numeric rates (both must be present). If either side rate is missing, abort conversion.
    let numFromRate = fromRate == null ? null : Number(fromRate);
    let numToRate = toRate == null ? null : Number(toRate);
    // Conservative fallback: if converting TO base currency and fromRate is suspiciously small (<=1)
    // but the currency has a defined sellingPrice that looks like an absolute SSP rate (>10),
    // prefer using the sellingPrice for the 'from' side. This fixes cases where admin entered
    // buyingPrice incorrectly as 1 while sellingPrice contains the real SSP equivalent.
    try {
      const baseCode = (BASE_CURRENCY || 'SSP').toUpperCase();
      if (t && (t.code || '').toUpperCase() === baseCode && numFromRate != null && numFromRate <= 1) {
        // Try direct sellingPrice first (explicit admin value)
        const sellingExplicit = f && f.sellingPrice != null && f.sellingPrice !== '' ? Number(f.sellingPrice) : null;
        if (sellingExplicit != null && isFinite(sellingExplicit) && sellingExplicit > 10) {
          console.debug('Converter: using explicit sellingPrice as fallback', { from: f.code, sellingExplicit });
          numFromRate = sellingExplicit;
        } else {
          // Fallback to computed effective rate for selling side
          const sellingFallback = getEffectiveRate(f, 'selling');
          if (sellingFallback != null && isFinite(Number(sellingFallback)) && Number(sellingFallback) > 10) {
            console.debug('Converter: applying conservative fallback - using source sellingPrice instead of buyingPrice', {from: f.code, sellingFallback});
            numFromRate = Number(sellingFallback);
          }
        }
      }

      // Generic per-side fallback: if fromRate is small (<=1) but the opposite side looks like a real SSP rate (>10), use it.
      if (numFromRate != null && numFromRate <= 1) {
        const otherSide = (priceMode === 'buying') ? getEffectiveRate(f, 'buying') : getEffectiveRate(f, 'selling');
        const explicitOther = (priceMode === 'buying') ? (f && f.buyingPrice != null && f.buyingPrice !== '' ? Number(f.buyingPrice) : null) : (f && f.sellingPrice != null && f.sellingPrice !== '' ? Number(f.sellingPrice) : null);
        if (explicitOther != null && isFinite(explicitOther) && explicitOther > 10) {
          console.debug('Converter: correcting fromRate using explicit opposite-side price', { from: f.code, explicitOther });
          numFromRate = explicitOther;
        } else if (otherSide != null && isFinite(Number(otherSide)) && Number(otherSide) > 10) {
          console.debug('Converter: correcting fromRate using computed opposite-side effective rate', { from: f.code, otherSide });
          numFromRate = Number(otherSide);
        }
      }

      // Symmetric fallback for the 'to' side
      if (numToRate != null && numToRate <= 1) {
        const otherSideTo = (priceMode === 'buying') ? getEffectiveRate(t, 'selling') : getEffectiveRate(t, 'buying');
        const explicitOtherTo = (priceMode === 'buying') ? (t && t.sellingPrice != null && t.sellingPrice !== '' ? Number(t.sellingPrice) : null) : (t && t.buyingPrice != null && t.buyingPrice !== '' ? Number(t.buyingPrice) : null);
        if (explicitOtherTo != null && isFinite(explicitOtherTo) && explicitOtherTo > 10) {
          console.debug('Converter: correcting toRate using explicit opposite-side price', { to: t.code, explicitOtherTo });
          numToRate = explicitOtherTo;
        } else if (otherSideTo != null && isFinite(Number(otherSideTo)) && Number(otherSideTo) > 10) {
          console.debug('Converter: correcting toRate using computed opposite-side effective rate', { to: t.code, otherSideTo });
          numToRate = Number(otherSideTo);
        }
      }
    } catch (e) {
      // swallow any unexpected errors in fallback logic
      console.debug('Converter fallback error', e);
    }

    if (convertedRaw == null && (numFromRate == null || numToRate == null || !isFinite(numFromRate) || !isFinite(numToRate) || numFromRate === 0 || numToRate === 0)) {
      console.debug('Converter: missing/invalid rates', { fromRate, toRate, numFromRate, numToRate });
      setDebugData({
        amount: a,
        priceMode,
        ratesUsed: {
          fromSide: priceMode === 'buying' ? 'selling' : 'buying',
          toSide: priceMode === 'buying' ? 'buying' : 'selling'
        },
        from: { code: f?.code },
        to: { code: t?.code },
        fromRate: numFromRate,
        toRate: numToRate,
        pairUsed: usedPair ? { fromCode: usedPair.pair.fromCode, toCode: usedPair.pair.toCode, inverse: usedPair.inverse } : null,
        convertedRaw: null,
        swapped: false
      });
      setResult('');
      return;
    }

    // Rates are expressed as: 1 unit of [currency] = [rate] units of base currency (SSP)
    // To convert A units of `from` into `to`:
    //   Convert from -> base: A * fromRate (gives SSP equivalent)
    //   Convert base -> to: SSP / toRate (gives `to` units)
    //   Combined: A * fromRate / toRate = A * (fromRate / toRate)
    // NOTE: The formula is correct. Verify fromRate and toRate are assigned correctly per mode.
      // Standard conversion (no swap heuristic)
        let swapped = false; // keep shape for debugData but always false
        if (convertedRaw == null) convertedRaw = Number(a) * (numFromRate / numToRate);
    // Detailed debug output for browser console to troubleshoot USD->SSP 'You Receive' values
    const dbg = {
      amount: a,
      priceMode,
      ratesUsed: {
        fromSide: priceMode === 'buying' ? 'selling' : 'buying',
        toSide: priceMode === 'buying' ? 'buying' : 'selling'
      },
      from: { code: f.code, exchangeRate: f.exchangeRate, buyingPrice: f.buyingPrice, sellingPrice: f.sellingPrice, priceType: f.priceType },
      to: { code: t.code, exchangeRate: t.exchangeRate, buyingPrice: t.buyingPrice, sellingPrice: t.sellingPrice, priceType: t.priceType },
      pairUsed: usedPair ? { fromCode: usedPair.pair.fromCode, toCode: usedPair.pair.toCode, buyingPrice: usedPair.pair.buyingPrice, sellingPrice: usedPair.pair.sellingPrice, priceType: usedPair.pair.priceType, inverse: usedPair.inverse } : null,
      fromRate: numFromRate,
      toRate: numToRate,
      convertedRaw,
      swapped
    };
    console.debug('Converter Debug', dbg);
    setDebugData(dbg);
    // persist which pair (if any) was used for UI display
    setUsedPairState(usedPair);
    setResult(isFinite(convertedRaw) ? convertedRaw.toFixed(2) : '');
  }, [amount, from, to, currencies, priceMode, pairRates]);

  const swap = () => {
    const f = from;
    setFrom(to);
    setTo(f);
  };

  const fromCurr = currencies.find(c => (c.code || '').toUpperCase() === (from || '').toUpperCase());
  const toCurr = currencies.find(c => (c.code || '').toUpperCase() === (to || '').toUpperCase());
  
  // Get rates based on price mode (use effective rate logic). These may be null if missing.
  const fromRate = priceMode === 'buying' ? getEffectiveRate(fromCurr, 'selling') : getEffectiveRate(fromCurr, 'buying');
  const toRate = priceMode === 'buying' ? getEffectiveRate(toCurr, 'buying') : getEffectiveRate(toCurr, 'selling');

  // Prepare safe formatted rate displays
  const numFromRate = fromRate == null ? null : Number(fromRate);
  const numToRate = toRate == null ? null : Number(toRate);
  // Default per-currency rate value (fromRate / toRate)
  const perCurrencyRateValue = (numFromRate != null && numToRate != null && isFinite(numFromRate) && isFinite(numToRate) && numToRate !== 0)
    ? (numFromRate / numToRate)
    : null;

  // If a pair was used, prefer that for the displayed rate
  let displayRateValue = perCurrencyRateValue;
  let displayInverse = perCurrencyRateValue != null && perCurrencyRateValue !== 0 ? (1 / perCurrencyRateValue) : null;
  if (usedPairState && usedPairState.pair) {
    const p = usedPairState.pair;
    if (!usedPairState.inverse) {
      const sideKey = priceMode === 'buying' ? 'buyingPrice' : 'sellingPrice';
      const val = p[sideKey];
      if (val !== undefined && val !== null && val !== '' && Number(val) !== 0) {
        displayRateValue = Number(val);
        displayInverse = 1 / Number(val);
      }
    } else {
      const invSideKey = priceMode === 'buying' ? 'sellingPrice' : 'buyingPrice';
      const invVal = p[invSideKey];
      if (invVal !== undefined && invVal !== null && invVal !== '' && Number(invVal) !== 0) {
        displayRateValue = 1 / Number(invVal);
        displayInverse = Number(invVal);
      }
    }
  }

  const rateDisplay = displayRateValue !== null && displayRateValue !== undefined && isFinite(displayRateValue) ? displayRateValue.toFixed(4) : '—';
  const reverseDisplay = displayInverse !== null && displayInverse !== undefined && isFinite(displayInverse) ? displayInverse.toFixed(4) : '—';

  const formatPairValue = (pair, key, inverse) => {
    if (!pair) return '—';
    const raw = pair[key];
    if (raw === undefined || raw === null || raw === '') return '—';
    const num = Number(raw);
    if (!isFinite(num) || num === 0) return '—';
    if (!inverse) return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    // inverse: display reciprocal
    const inv = 1 / num;
    return inv.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  // Format result for display (preserve small values and show up to 8 decimals)
  const formattedResult = result !== '' && !isNaN(Number(result))
    ? Number(result).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })
    : '0.00';

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><ArrowRightLeft size={18} /> Currency Converter</h1>
        <p>Convert between configured currencies. Choose a mode that matches the transaction:
          <strong> "User Buys Target"</strong> means the user will receive the target currency.
          <strong> "User Sells Target"</strong> means the user sends the source currency.
        </p>
      </div>

      {/* Price Mode Selector */}
      <div className="card" style={{marginBottom: 24}}>
        <div style={{display: 'flex', gap: 16, alignItems: 'center'}}>
          <label style={{fontWeight: 600, fontSize: 12.5}}>Transaction Mode:</label>
            <select
              value={priceMode}
              onChange={(e) => setPriceMode(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e0e0e0', fontSize: 12.5, cursor: 'pointer' }}
            >
              <option value="buying">Buying</option>
              <option value="selling">Selling</option>
            </select>
            <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>
              {priceMode === 'buying' && 'Using platform selling rate for source and buying rate for target (you receive target).'}
              {priceMode === 'selling' && 'Using platform buying rate for source and selling rate for target (you send source).'}
            </span>
        </div>
      </div>

      <div className="converter-main-grid">
        {/* Main Converter Card */}
        <div className="converter-card">
          <div className="converter-input-section">
            <div className="converter-input-group">
              <label>From</label>
              <select 
                value={from} 
                onChange={(e) => setFrom(e.target.value)} 
                className="converter-select-lg"
              >
                <option value="">Select currency</option>
                {currencies.map(c => (
                  <option key={c.id} value={(c.code||'').toUpperCase()}>
                    {(c.code||'').toUpperCase()} — {c.name}
                  </option>
                ))}
              </select>
              <div className="converter-rate">1 {from} = {rateDisplay} {to}</div>
            </div>

            {/* Pairwise rate badges for From (source) */}
            <div style={{marginTop:8, display:'flex', gap:8, alignItems:'center'}}>
              {usedPairState && usedPairState.pair ? (
                <>
                  <div style={{fontSize: 11, color:'#666'}}>From</div>
                  <div style={{fontWeight:700}}>{(usedPairState.pair.fromCode || '').toUpperCase()}</div>
                  <div style={{marginLeft:'auto', display:'flex', gap:8}}>
                    <span className="price-badge buying-badge">Buy {formatPairValue(usedPairState.pair, 'buyingPrice', usedPairState.inverse)}</span>
                    <span className="price-badge selling-badge">Sell {formatPairValue(usedPairState.pair, 'sellingPrice', usedPairState.inverse)}</span>
                  </div>
                </>
              ) : (
                <div style={{color:'#666'}}>No pair used for this conversion.</div>
              )}
            </div>

            <div className="converter-amount-input">
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="converter-input-amount"
              />
              <span className="converter-code">{from}</span>
            </div>
          </div>

          <button className="converter-swap-btn" onClick={swap} title="Swap currencies">
            <span><ArrowUpDown size={18} /></span>
          </button>

          <div className="converter-output-section">
            <div className="converter-input-group">
              <label>To</label>
              <select 
                value={to} 
                onChange={(e) => setTo(e.target.value)} 
                className="converter-select-lg"
              >
                <option value="">Select currency</option>
                {currencies.map(c => (
                  <option key={c.id} value={(c.code||'').toUpperCase()}>
                    {(c.code||'').toUpperCase()} — {c.name}
                  </option>
                ))}
              </select>
              <div className="converter-rate">1 {to} = {reverseDisplay} {from}</div>
            </div>

            {/* Pairwise rate badges for To (target) */}
            <div style={{marginTop:8, display:'flex', gap:8, alignItems:'center'}}>
              {usedPairState && usedPairState.pair ? (
                <>
                  <div style={{fontSize: 11, color:'#666'}}>Pair:</div>
                  <div style={{fontWeight:700}}>{usedPairState.pair.fromCode} <ArrowRight size={18} /> {usedPairState.pair.toCode} {usedPairState.inverse ? '(inverse)' : ''}</div>
                  <div style={{marginLeft:'auto', display:'flex', gap:8}}>
                    <span className="price-badge buying-badge">Buy {formatPairValue(usedPairState.pair, 'buyingPrice', usedPairState.inverse)}</span>
                    <span className="price-badge selling-badge">Sell {formatPairValue(usedPairState.pair, 'sellingPrice', usedPairState.inverse)}</span>
                  </div>
                </>
              ) : (
                <div style={{color:'#666'}}>No pair used for this conversion.</div>
              )}
            </div>

            <div className="converter-result-box">
              <div className="converter-result-value">
                {formattedResult}
              </div>
              <span className="converter-code">{to}</span>
              {/* Human-friendly calculation summary */}
              {debugData && (
                <div style={{marginTop: 8, fontSize: 11, color: '#333'}}>
                  <div><strong>Rates used:</strong></div>
                  <div style={{marginTop:4}}>
                    <span style={{display:'inline-block', minWidth:220}}>
                      {debugData.from.code} ({debugData.ratesUsed.fromSide}): {debugData.fromRate}
                    </span>
                    <span>
                      {debugData.to.code} ({debugData.ratesUsed.toSide}): {debugData.toRate}
                    </span>
                  </div>
                  <div style={{marginTop:6}}>
                        <strong>Calculation:</strong>&nbsp;{debugData.amount} × ({debugData.fromRate} ÷ {debugData.toRate}) = <strong>{Number(debugData.convertedRaw).toLocaleString()}</strong>
                        {/* swap heuristic removed; no note needed */}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="converter-info-grid">
          <div className="info-card">
            <div className="info-icon"><ChartColumn size={28} /></div>
            <h3>{priceMode === 'buying' ? <><Wallet size={18} /> Buying Rate</> : <><CircleDollarSign size={18} /> Selling Rate</>}</h3>
            <p className="info-value">
              1 {from} = <span className="highlight">{rateDisplay}</span> {to}
            </p>
            <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0 0' }}>
              {priceMode === 'buying' && 'Using buying prices'}
              {priceMode === 'selling' && 'Using selling prices'}
            </p>
          </div>

          <div className="info-card">
            <div className="info-icon"><Wallet size={28} /></div>
            <h3>You Send</h3>
            <p className="info-value">
              <span className="highlight">{amount}</span> {from}
            </p>
          </div>

          <div className="info-card">
            <div className="info-icon"><Link2 size={28} /></div>
            <h3>Pair Used</h3>
            {usedPairState && usedPairState.pair ? (
              <div style={{fontSize: 11.5}}>
                <div style={{fontWeight:700}}>{usedPairState.pair.fromCode} <ArrowRight size={18} /> {usedPairState.pair.toCode} {usedPairState.inverse ? '(inverse)' : ''}</div>
                <div style={{marginTop:6}}>
                  <div>Type: {usedPairState.pair.priceType || 'fixed'}</div>
                  <div>Buy: {usedPairState.pair.buyingPrice ?? '—'} &nbsp; Sell: {usedPairState.pair.sellingPrice ?? '—'}</div>
                </div>
              </div>
            ) : (
              <div style={{color:'#666'}}>No direct pair used; falling back to currency rates.</div>
            )}
          </div>

          <div className="info-card">
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <h3 style={{margin: 0}}><Wrench size={18} /> Debug</h3>
              <button
                onClick={() => setShowDebug(s => !s)}
                style={{padding: '6px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 6}}
              >
                {showDebug ? 'Hide' : 'Show'}
              </button>
            </div>
            {showDebug && (
              <div style={{marginTop: 8, fontSize: 11}}>
                <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f6f6f6', padding: 8, borderRadius: 6}}>
                  {debugData ? JSON.stringify(debugData, null, 2) : 'No debug data yet'}
                </pre>
              </div>
            )}
          </div>

          <div className="info-card">
            <div className="info-icon"><CircleCheck size={28} /></div>
            <h3>You Receive</h3>
            <p className="info-value">
              <span className="highlight">{formattedResult}</span> {to}
            </p>
          </div>

          <div className="info-card">
            <div className="info-icon"><Zap size={28} /></div>
            <h3>{priceMode === 'buying' ? <><Wallet size={18} /> Buying Mode</> : <><CircleDollarSign size={18} /> Selling Mode</>}</h3>
            <p className="info-value">
              <span className="highlight">
                {priceMode === 'buying' && 'Buying'}
                {priceMode === 'selling' && 'Selling'}
              </span>
            </p>
            <p style={{fontSize: 11, color: '#999', margin: '4px 0 0 0'}}>Active mode</p>
          </div>
        </div>
      </div>

      {/* Currency Details Table */}
      <div className="card">
        <h3 style={{marginBottom: 16}}>Available Currencies</h3>
        <div className="currencies-table-wrapper">
          <table className="currencies-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Currency Name</th>
                <th>Buying Price</th>
                <th>Selling Price</th>
                <th>Countries</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.code}</strong></td>
                  <td>{c.name}</td>
                  <td><span className="price-badge buying-badge">{c.buyingPrice ?? '—'}</span></td>
                  <td><span className="price-badge selling-badge">{c.sellingPrice ?? '—'}</span></td>
                  <td>{c.countries && c.countries.length > 0 ? c.countries.join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

