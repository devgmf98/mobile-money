import React, { useEffect, useState } from 'react';
import { adminAPI } from '../utils/api';
import '../styles/layout.css';
import { ArrowRight, Banknote, ChartColumn, Link2, Pencil, Plus, RefreshCw, Search, Trash2, X, Zap } from 'lucide-react';
import '../styles/admin-currency-rates.css';

export default function AdminCurrencyRates() {
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [newCountry, setNewCountry] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState({ code: '', name: '', symbol: '', countries: [] });
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(true);
  const [showCreateRate, setShowCreateRate] = useState(false);
  const [createRateData, setCreateRateData] = useState({ fromCode: '', toCode: '', buyingPrice: '', sellingPrice: '', priceType: 'fixed' });
  const [editingRateId, setEditingRateId] = useState(null);
  const [editRateData, setEditRateData] = useState({});
  

  useEffect(() => {
    loadCurrencies();
    loadExchangeRates();
  }, []);

  const loadExchangeRates = async () => {
    setLoadingRates(true);
    try {
      const res = await adminAPI.getExchangeRates();
      const data = res?.data || res;
      const list = Array.isArray(data) ? data : (Array.isArray(data?.exchangeRates) ? data.exchangeRates : []);
      setExchangeRates(list);
    } catch (err) {
      console.error('Failed to load exchange rates', err);
    } finally {
      setLoadingRates(false);
    }
  };

  const loadCurrencies = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getCurrencies();
      const data = res?.data || res;
      const list = Array.isArray(data) ? data : (Array.isArray(data?.currencies) ? data.currencies : []);
      setCurrencies(list);
    } catch (err) {
      console.error('Failed to load currencies', err);
    } finally {
      setLoading(false);
    }
  };

  


  const startEdit = (currency) => {
    setEditingId(currency.id);
    setEditData({
      name: currency.name,
      symbol: currency.symbol || '',
      countries: currency.countries || []
    });
    setNewCountry('');
    setShowModal(true);
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addCountry = () => {
    if (newCountry.trim() && !editData.countries.includes(newCountry.trim())) {
      setEditData(prev => ({
        ...prev,
        countries: [...prev.countries, newCountry.trim()]
      }));
      setNewCountry('');
    }
  };

  const removeCountry = (index) => {
    setEditData(prev => ({
      ...prev,
      countries: prev.countries.filter((_, i) => i !== index)
    }));
  };

  const saveEdit = async () => {
    try {
      await adminAPI.updateCurrency(editingId, editData);
      setShowModal(false);
      setEditingId(null);
      loadCurrencies();
    } catch (err) {
      console.error('Failed to update currency', err);
      alert('Error updating currency: ' + (err.response?.data?.error || err.message));
    }
  };

  const cancelEdit = () => {
    setShowModal(false);
    setEditingId(null);
    setEditData({});
  };

  const openCreate = () => {
    setCreateData({ code: '', name: '', symbol: '', countries: [] });
    setShowCreate(true);
  };

  const handleCreateChange = (field, value) => {
    setCreateData(prev => ({ ...prev, [field]: value }));
  };

  const addCreateCountry = (country) => {
    const c = (country || '').trim();
    if (!c) return;
    if (!createData.countries.includes(c)) {
      setCreateData(prev => ({ ...prev, countries: [...prev.countries, c] }));
    }
  };

  const removeCreateCountry = (index) => {
    setCreateData(prev => ({ ...prev, countries: prev.countries.filter((_, i) => i !== index) }));
  };

  const saveCreate = async () => {
    try {
      // Create a new currency (UI no longer captures single-currency buy/sell prices)
      const payload = { code: createData.code, name: createData.name, symbol: createData.symbol, countries: createData.countries };
      await adminAPI.createCurrency(payload);
      setShowCreate(false);
      loadCurrencies();
    } catch (err) {
      console.error('Failed to create currency', err);
      alert('Error creating currency: ' + (err.response?.data?.error || err.message));
    }
  };

  

  const deleteCurrency = async (id) => {
    if (window.confirm('Are you sure you want to delete this currency?')) {
      try {
        await adminAPI.deleteCurrency(id);
        loadCurrencies();
      } catch (err) {
        console.error('Failed to delete currency', err);
        alert('Error deleting currency: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  // Pairwise rate handlers
  const openCreateRate = () => {
    setCreateRateData({ fromCode: '', toCode: '', buyingPrice: '', sellingPrice: '', priceType: 'fixed' });
    setEditingRateId(null);
    setShowCreateRate(true);
  };

  const handleCreateRateChange = (field, value) => {
    setCreateRateData(prev => ({ ...prev, [field]: value }));
  };

  const saveCreateRate = async () => {
    try {
      if (editingRateId) {
        await adminAPI.updateExchangeRate(editingRateId, editRateData);
      } else {
        await adminAPI.createExchangeRate(createRateData);
      }
      setShowCreateRate(false);
      loadExchangeRates();
    } catch (err) {
      console.error('Failed to save exchange rate', err);
      alert('Error saving rate: ' + (err.response?.data?.message || err.message));
    }
  };

  const deleteRate = async (id) => {
    if (!window.confirm('Delete this exchange rate?')) return;
    try {
      await adminAPI.deleteExchangeRate(id);
      loadExchangeRates();
    } catch (err) {
      console.error('Failed to delete rate', err);
      alert('Error deleting rate: ' + (err.response?.data?.message || err.message));
    }
  };

  const startEditRate = (rate) => {
    setEditingRateId(rate.id);
    setEditRateData({ fromCode: rate.fromCode || '', toCode: rate.toCode || '', buyingPrice: rate.buyingPrice ?? '', sellingPrice: rate.sellingPrice ?? '', priceType: rate.priceType || 'fixed' });
    setShowCreateRate(true);
  };

  // Base currency used for pairwise rate context
  // Rates are DECIMAL(x,10) so they arrive as "8000.0000000000". Show a
  // readable number: thousands separators, no trailing zero padding, but keep
  // small rates like 0.000125 intact.
  const fmtRate = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    const decimals = Math.abs(n) >= 1 ? 2 : 8;
    return Number(n.toFixed(decimals)).toLocaleString(undefined, { maximumFractionDigits: decimals });
  };

  // Real figures rather than the hardcoded "Real-time"/"Active" placeholders.
  const rateSearch = searchTerm.trim().toLowerCase();
  const filteredRates = exchangeRates.filter(r => {
    if (!rateSearch) return true;
    return `${r.fromCode || ''} ${r.toCode || ''}`.toLowerCase().includes(rateSearch);
  });
  const currenciesInPairs = new Set(
    exchangeRates.flatMap(r => [r.fromCode, r.toCode]).filter(Boolean).map(c => c.toUpperCase())
  );
  const fixedCount = exchangeRates.filter(r => r.priceType === 'fixed').length;
  const lastUpdated = exchangeRates.reduce((latest, r) => {
    const t = new Date(r.updatedAt || r.createdAt || 0).getTime();
    return t > latest ? t : latest;
  }, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Exchange Rates</h1>
        <p>View and manage all currency exchange rates</p>
      </div>

      {/* summary */}
      <div className="rates-summary">
        <div className="rsum-tile">
          <span className="rsum-icon"><Link2 size={18} /></span>
          <span className="rsum-value">{exchangeRates.length}</span>
          <span className="rsum-label">Pair rates</span>
        </div>
        <div className="rsum-tile">
          <span className="rsum-icon"><Banknote size={18} /></span>
          <span className="rsum-value">{currenciesInPairs.size}</span>
          <span className="rsum-label">Currencies used</span>
        </div>
        <div className="rsum-tile">
          <span className="rsum-icon"><Zap size={18} /></span>
          <span className="rsum-value">{fixedCount}<span className="rsum-sub">/{exchangeRates.length}</span></span>
          <span className="rsum-label">Fixed rate</span>
        </div>
        <div className="rsum-tile">
          <span className="rsum-icon"><RefreshCw size={18} /></span>
          <span className="rsum-value is-small">
            {lastUpdated ? new Date(lastUpdated).toLocaleDateString() : '—'}
          </span>
          <span className="rsum-label">Last updated</span>
        </div>
      </div>

      {/* pair rates */}
      <div className="card">
        <div className="card-header rates-toolbar">
          <h3><Link2 size={18} /> Pairwise exchange rates</h3>
          <div className="rates-toolbar-right">
            <div className="rate-search">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search by currency code"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search rates by currency code"
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={openCreateRate}>
              <Plus size={15} /> Add pair rate
            </button>
          </div>
        </div>

        <div className="card-body">
          {loadingRates ? (
            <div className="empty-state">
              <span className="empty-icon"><RefreshCw size={22} className="spin" /></span>
              <h3>Loading rates…</h3>
            </div>
          ) : filteredRates.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Link2 size={22} /></span>
              <h3>{exchangeRates.length === 0 ? 'No pair rates yet' : 'No matching rates'}</h3>
              <p>
                {exchangeRates.length === 0
                  ? 'Add a currency pair to start converting between currencies.'
                  : `Nothing matches "${searchTerm}".`}
              </p>
              {exchangeRates.length === 0 ? (
                <button className="btn btn-primary btn-sm" onClick={openCreateRate}>
                  <Plus size={15} /> Add pair rate
                </button>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => setSearchTerm('')}>Clear search</button>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table rates-table">
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th className="num">Buying</th>
                    <th className="num">Selling</th>
                    <th>Type</th>
                    <th>Updated</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map(r => (
                    <tr key={r.id} className={editingRateId === r.id ? 'is-editing' : ''}>
                      <td>
                        <span className="pair-cell">
                          <strong>{r.fromCode}</strong>
                          <ArrowRight size={14} />
                          <strong>{r.toCode}</strong>
                        </span>
                      </td>
                      <td className="num"><span className="rate-num is-buy">{fmtRate(r.buyingPrice)}</span></td>
                      <td className="num"><span className="rate-num is-sell">{fmtRate(r.sellingPrice)}</span></td>
                      <td>
                        <span className={'badge ' + (r.priceType === 'fixed' ? 'badge-primary' : 'badge-info')}>
                          {r.priceType === 'fixed' ? 'Fixed' : 'Percentage'}
                        </span>
                      </td>
                      <td className="rate-when">
                        {r.updatedAt || r.createdAt
                          ? new Date(r.updatedAt || r.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="right">
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            onClick={() => startEditRate(r)}
                            aria-label={`Edit ${r.fromCode} to ${r.toCode}`}
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn is-danger"
                            onClick={() => deleteRate(r.id)}
                            aria-label={`Delete ${r.fromCode} to ${r.toCode}`}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2><Pencil size={18} /> Edit Currency</h2>
              <button className="modal-close" onClick={cancelEdit}><X size={18} /></button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Currency Name</label>
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => handleEditChange('name', e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Symbol</label>
                <input
                  type="text"
                  value={editData.symbol || ''}
                  onChange={(e) => handleEditChange('symbol', e.target.value)}
                  className="form-input"
                  placeholder="e.g., $, ₦, ₵"
                />
              </div>

              {/* Single-currency price inputs removed; pairwise rates are managed separately */}

              <div className="form-group">
                <label>Countries</label>
                <div className="countries-input-group">
                  <input
                    type="text"
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCountry()}
                    className="form-input"
                    placeholder="Add country name"
                  />
                  <button className="btn-add-country" onClick={addCountry}>Add</button>
                </div>

                <div className="countries-tags">
                  {editData.countries && editData.countries.map((country, idx) => (
                    <div key={idx} className="country-tag">
                      {country}
                      <button 
                        className="country-tag-remove"
                        onClick={() => removeCountry(idx)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

        

      {/* Create Modal */}
      {showCreateRate && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingRateId ? <><Pencil size={18} /> Edit Pair Rate</> : <><Plus size={18} /> Add Pair Rate</>}</h2>
              <button className="modal-close" onClick={() => setShowCreateRate(false)}><X size={18} /></button>
            </div>

            <div className="modal-body">
              {/* Read as a pair, so they sit on one row. */}
              <div className="form-row">
                <div className="form-group">
                  <label>From Currency Code</label>
                  <input
                    type="text"
                    value={editingRateId ? (editRateData.fromCode || '') : (createRateData.fromCode || '')}
                    onChange={(e) => editingRateId ? setEditRateData(prev => ({...prev, fromCode: e.target.value.toUpperCase()})) : handleCreateRateChange('fromCode', e.target.value.toUpperCase())}
                    className="form-input"
                    placeholder="e.g., USD"
                  />
                </div>

                <div className="form-group">
                  <label>To Currency Code</label>
                  <input
                    type="text"
                    value={editingRateId ? (editRateData.toCode || '') : (createRateData.toCode || '')}
                    onChange={(e) => editingRateId ? setEditRateData(prev => ({...prev, toCode: e.target.value.toUpperCase()})) : handleCreateRateChange('toCode', e.target.value.toUpperCase())}
                    className="form-input"
                    placeholder="e.g., SSP"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Price Type</label>
                <select
                  value={editingRateId ? (editRateData.priceType || 'fixed') : createRateData.priceType}
                  onChange={(e) => editingRateId ? setEditRateData(prev => ({...prev, priceType: e.target.value})) : handleCreateRateChange('priceType', e.target.value)}
                  className="form-input"
                >
                  <option value="fixed">Fixed Amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Buying Price {editingRateId ? (editRateData.priceType === 'percentage' ? '(%)' : '') : (createRateData.priceType === 'percentage' ? '(%)' : '')}</label>
                  <input
                    type="number"
                    value={editingRateId ? (editRateData.buyingPrice ?? '') : (createRateData.buyingPrice ?? '')}
                    onChange={(e) => editingRateId ? setEditRateData(prev => ({...prev, buyingPrice: e.target.value})) : handleCreateRateChange('buyingPrice', e.target.value)}
                    className="form-input"
                    placeholder={createRateData.priceType === 'percentage' ? 'e.g., 2.5' : 'e.g., 5800 or 0.000172'}
                    step="any"
                  />
                </div>

                <div className="form-group">
                  <label>Selling Price {editingRateId ? (editRateData.priceType === 'percentage' ? '(%)' : '') : (createRateData.priceType === 'percentage' ? '(%)' : '')}</label>
                  <input
                    type="number"
                    value={editingRateId ? (editRateData.sellingPrice ?? '') : (createRateData.sellingPrice ?? '')}
                    onChange={(e) => editingRateId ? setEditRateData(prev => ({...prev, sellingPrice: e.target.value})) : handleCreateRateChange('sellingPrice', e.target.value)}
                    className="form-input"
                    placeholder={createRateData.priceType === 'percentage' ? 'e.g., 1.5' : 'e.g., 5700 or 0.000175'}
                    step="any"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateRate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCreateRate}>{editingRateId ? 'Save Changes' : 'Create Rate'}</button>
            </div>
          </div>
        </div>
      )}
      {showCreate && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2><Plus size={18} /> Add Currency Rate</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Currency Code</label>
                <input
                  type="text"
                  value={createData.code}
                  onChange={(e) => handleCreateChange('code', e.target.value.toUpperCase())}
                  className="form-input"
                  placeholder="e.g., NGN"
                />
              </div>

              <div className="form-group">
                <label>Currency Name</label>
                <input
                  type="text"
                  value={createData.name}
                  onChange={(e) => handleCreateChange('name', e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Symbol</label>
                <input
                  type="text"
                  value={createData.symbol}
                  onChange={(e) => handleCreateChange('symbol', e.target.value)}
                  className="form-input"
                  placeholder="e.g., ₦"
                />
              </div>

              <div className="form-group">
                <div style={{color: '#666'}}>Note: Buying/Selling prices are configured per currency pair in the "Pairwise Exchange Rates" section.</div>
              </div>

              <div className="form-group">
                <label>Countries</label>
                <div className="countries-input-group">
                  <input
                    type="text"
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (addCreateCountry(newCountry), setNewCountry(''))}
                    className="form-input"
                    placeholder="Add country name"
                  />
                  <button className="btn-add-country" onClick={() => { addCreateCountry(newCountry); setNewCountry(''); }}>Add</button>
                </div>

                <div className="countries-tags">
                  {createData.countries && createData.countries.map((country, idx) => (
                    <div key={idx} className="country-tag">
                      {country}
                      <button 
                        className="country-tag-remove"
                        onClick={() => removeCreateCountry(idx)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCreate}>Create Currency</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
