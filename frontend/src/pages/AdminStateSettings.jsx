import React, { useEffect, useState } from 'react';
import { adminAPI } from '../utils/api';
import Toast from '../components/Toast';
import '../styles/admin-state-settings.css';
import { Map, MapPin, Pencil, Percent, Plus, RefreshCw, Trash2, X } from 'lucide-react';

export default function AdminStateSettings() {
  const [states, setStates] = useState([]);
  const [name, setName] = useState('');
  const [commission, setCommission] = useState('');
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getStateSettings();
      setStates(res.data.states || []);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to load destination settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pct = Number(commission);
  const nameValid = name.trim().length > 0;
  const pctValid = commission !== '' && !Number.isNaN(pct) && pct >= 0 && pct <= 100;
  const canSave = nameValid && pctValid && !saving;

  const resetForm = () => {
    setEditing(null);
    setName('');
    setCommission('');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), commissionPercent: Number(commission || 0) };
      if (editing) {
        await adminAPI.updateStateSetting(editing.id, payload);
        setToast({ message: `Updated ${payload.name}`, type: 'success' });
      } else {
        await adminAPI.createStateSetting(payload);
        setToast({ message: `Created ${payload.name}`, type: 'success' });
      }
      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      setToast({ message: err?.response?.data?.message || 'Failed to save', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s) => {
    setEditing(s);
    setName(s.name);
    setCommission(String(s.commissionPercent || 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (state) => {
    if (!window.confirm(`Delete “${state.name}”? Transfers already using it are not affected.`)) return;
    setDeletingId(state.id);
    try {
      await adminAPI.deleteStateSetting(state.id);
      setToast({ message: `Deleted ${state.name}`, type: 'success' });
      if (editing?.id === state.id) resetForm();
      await load();
    } catch (err) {
      console.error(err);
      setToast({ message: err?.response?.data?.message || 'Delete failed', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-container state-settings">
      <div className="page-header settings-header">
        <div>
          <h1>Destination Settings</h1>
          <p>Define the destinations used for admin transfers and the commission each one earns.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* create / edit */}
      <div className="card">
        <div className="card-header">
          <h3>
            {editing ? <><Pencil size={18} /> Edit Destination</> : <><Plus size={18} /> Add a Destination</>}
          </h3>
        </div>
        <div className="card-body">
          {editing && (
            <div className="editing-banner">
              <span><Pencil size={14} /> Editing <strong>{editing.name}</strong></span>
              <button type="button" className="btn btn-outline btn-sm" onClick={resetForm}>
                <X size={14} /> Cancel
              </button>
            </div>
          )}

          <form onSubmit={handleAdd}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="st-name"><MapPin size={14} /> Destination name</label>
                <input
                  id="st-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Central Equatoria"
                />
              </div>

              <div className="form-group">
                <label htmlFor="st-pct"><Percent size={14} /> Commission</label>
                <div className="pct-field">
                  <input
                    id="st-pct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    inputMode="decimal"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    placeholder="0.00"
                  />
                  <span className="pct-suffix">%</span>
                </div>
                {commission !== '' && !pctValid && (
                  <small className="is-invalid">Enter a value between 0 and 100.</small>
                )}
              </div>
            </div>

            <div className="settings-form-actions">
              <button type="submit" className="btn btn-primary" disabled={!canSave}>
                {saving ? 'Saving…' : editing ? <><Pencil size={15} /> Update Destination</> : <><Plus size={15} /> Create Destination</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* list */}
      <div className="card">
        <div className="card-header">
          <h3><Map size={18} /> Destinations <span className="count-pill">{states.length}</span></h3>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="empty-state">
              <span className="empty-icon"><RefreshCw size={22} className="spin" /></span>
              <h3>Loading destinations…</h3>
            </div>
          ) : states.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Map size={22} /></span>
              <h3>No destinations yet</h3>
              <p>Add your first destination above to start routing commission on admin transfers.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table states-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="num">Commission</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {states.map(s => (
                    <tr key={s.id} className={editing?.id === s.id ? 'is-editing' : ''}>
                      <td>
                        <span className="state-name"><MapPin size={14} /> {s.name}</span>
                      </td>
                      <td className="num">
                        <span className="badge badge-primary">{Number(s.commissionPercent || 0)}%</span>
                      </td>
                      <td className="right">
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            onClick={() => handleEdit(s)}
                            aria-label={`Edit ${s.name}`}
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn is-danger"
                            onClick={() => handleDelete(s)}
                            disabled={deletingId === s.id}
                            aria-label={`Delete ${s.name}`}
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

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'info' })}
      />
    </div>
  );
}
