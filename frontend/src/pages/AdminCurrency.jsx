import React, { useEffect, useMemo, useState } from 'react';
import { Coins, DollarSign, Hash, Pencil, Plus, RefreshCw, Tag, Trash2, X } from 'lucide-react';
import { adminAPI } from '../utils/api';
import Toast from '../components/Toast';
import '../styles/admin-currency.css';

export default function AdminCurrency() {
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [symbol, setSymbol] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getCurrencies();
      setCurrencies(data.currencies || []);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Failed to load currencies' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setCode('');
    setSymbol('');
  };

  const handleEdit = (curr) => {
    setEditing(curr);
    setName(curr.name || '');
    setCode(curr.code || '');
    setSymbol(curr.symbol || '');
  };

  // Warn before the server rejects it, rather than after.
  const duplicate = useMemo(() => {
    const c = code.trim().toUpperCase();
    if (!c) return null;
    return currencies.find(x => (x.code || '').toUpperCase() === c && x.id !== editing?.id) || null;
  }, [code, currencies, editing]);

  const canSave = code.trim().length >= 2 && name.trim().length > 0 && !duplicate && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = { name: name.trim(), code: code.trim().toUpperCase(), symbol: symbol.trim() };

      if (editing) {
        await adminAPI.updateCurrency(editing.id, payload);
        setToast({ type: 'success', message: payload.code + ' updated' });
      } else {
        await adminAPI.createCurrency(payload);
        setToast({ type: 'success', message: payload.code + ' created' });
      }

      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: err?.response?.data?.message || 'Operation failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (curr) => {
    if (!window.confirm('Delete ' + curr.code + '? Transactions already using it are not affected.')) return;
    setDeletingId(curr.id);
    try {
      await adminAPI.deleteCurrency(curr.id);
      setToast({ type: 'success', message: 'Deleted ' + curr.code });
      if (editing?.id === curr.id) resetForm();
      await load();
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: err?.response?.data?.message || 'Failed to delete' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-container currency-page">
      <div className="page-header currency-header">
        <div>
          <h1>Currencies</h1>
          <p>Define the currencies available across transfers, top-ups and exchanges.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* create / edit */}
      <div className="card">
        <div className="card-header">
          <h3>
            {editing ? <><Pencil size={18} /> Edit Currency</> : <><Plus size={18} /> Add a Currency</>}
          </h3>
        </div>
        <div className="card-body">
          {editing && (
            <div className="editing-banner">
              <span><Pencil size={14} /> Editing <strong>{editing.code}</strong></span>
              <button type="button" className="btn btn-outline btn-sm" onClick={resetForm}>
                <X size={14} /> Cancel
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-row currency-form-row">
              <div className="form-group">
                <label htmlFor="cu-code"><Hash size={14} /> Code</label>
                <input
                  id="cu-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="USD"
                  maxLength={4}
                  autoComplete="off"
                  spellCheck="false"
                />
                {duplicate
                  ? <small className="is-invalid">{duplicate.code} already exists.</small>
                  : <small className="field-hint">ISO code, 2-4 letters.</small>}
              </div>

              <div className="form-group">
                <label htmlFor="cu-name"><Tag size={14} /> Name</label>
                <input
                  id="cu-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="US Dollar"
                  autoComplete="off"
                />
                <small className="field-hint">Shown wherever the currency is listed.</small>
              </div>

              <div className="form-group">
                <label htmlFor="cu-symbol"><DollarSign size={14} /> Symbol</label>
                <input
                  id="cu-symbol"
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="$"
                  maxLength={5}
                  autoComplete="off"
                />
                <small className="field-hint">Optional. Falls back to the code.</small>
              </div>
            </div>

            <div className="currency-form-footer">
              <div className="currency-preview" aria-live="polite">
                <span className="preview-label">Preview</span>
                <span className="preview-chip">
                  <span className="preview-code">{code.trim() || 'CODE'}</span>
                  <span className="preview-sym">{symbol.trim() || code.trim() || '-'}</span>
                  <span className="preview-name">{name.trim() || 'Currency name'}</span>
                </span>
              </div>

              <button type="submit" className="btn btn-primary" disabled={!canSave}>
                {saving
                  ? 'Saving...'
                  : editing
                    ? <><Pencil size={15} /> Update Currency</>
                    : <><Plus size={15} /> Create Currency</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* list */}
      <div className="card">
        <div className="card-header">
          <h3><Coins size={18} /> Currencies <span className="count-pill">{currencies.length}</span></h3>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="empty-state">
              <span className="empty-icon"><RefreshCw size={22} className="spin" /></span>
              <h3>Loading currencies...</h3>
            </div>
          ) : currencies.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Coins size={22} /></span>
              <h3>No currencies yet</h3>
              <p>Add your first currency above to start recording transfers and exchanges.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table currency-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th className="num">Symbol</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map(curr => (
                    <tr key={curr.id} className={editing?.id === curr.id ? 'is-editing' : ''}>
                      <td><span className="badge badge-primary">{curr.code}</span></td>
                      <td><span className="currency-name">{curr.name}</span></td>
                      <td className="num"><span className="currency-symbol">{curr.symbol || '-'}</span></td>
                      <td className="right">
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            onClick={() => handleEdit(curr)}
                            aria-label={'Edit ' + curr.code}
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn is-danger"
                            onClick={() => handleDelete(curr)}
                            disabled={deletingId === curr.id}
                            aria-label={'Delete ' + curr.code}
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

      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
