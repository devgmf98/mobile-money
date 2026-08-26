import { useState, useEffect } from 'react';
import { adminAPI } from '../utils/api';
import Toast from '../components/Toast';
import Footer from '../components/Footer';
import '../styles/withdraw.css';
import { ArrowRight, Banknote, CircleDollarSign, ClipboardList, Info, Layers, Plus, Save, Send, Trash2, Wallet } from 'lucide-react';
import '../styles/admin-tiered-commission.css';

// Illustrative figures for the explainer card only - not live settings.
const HOW_IT_WORKS_TIERS = [
  { range: '0 - 99', percent: '0%' },
  { range: '100 - 499', percent: '1%' },
  { range: '500 - 999', percent: '2%' },
  { range: '1000 +', percent: '3%' },
];

const HOW_IT_WORKS_EXAMPLES = [
  { amount: '50', percent: '0%', range: '0 - 99' },
  { amount: '150', percent: '1%', range: '100 - 499' },
  { amount: '600', percent: '2%', range: '500 - 999' },
];

export default function AdminTieredCommission() {
  const [sendTiers, setSendTiers] = useState([]);
  const [withdrawalTiers, setWithdrawalTiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const { data } = await adminAPI.getTieredCommission();
        // Normalize tiers to arrays (API may return object or JSON string)
        const normalize = (val) => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          if (typeof val === 'string') {
            try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : Object.values(parsed || {}); } catch (e) { return [] }
          }
          if (typeof val === 'object') return Object.values(val || {});
          return [];
        };

        setSendTiers(normalize(data.tiers));
        setWithdrawalTiers(normalize(data.withdrawalTiers));
      } catch (err) {
        console.error('Failed to load tiered commission', err);
        setMessage('Failed to load tiered commission settings');
      }
    };
    fetchTiers();
  }, []);

  const handleTierChange = (index, field, value, tierType = 'send') => {
    const tiers = tierType === 'send' ? sendTiers : withdrawalTiers;
    const setTiers = tierType === 'send' ? setSendTiers : setWithdrawalTiers;
    
    const newTiers = [...tiers];
    newTiers[index] = {
      ...newTiers[index],
      [field]: (field === 'minAmount' || field === 'maxAmount' || field === 'agentPercent' || field === 'companyPercent') 
        ? parseFloat(value) || 0 
        : parseFloat(value) || 0
    };
    setTiers(newTiers);
  };

  const addTier = (tierType = 'send') => {
    if (tierType === 'send') {
      setSendTiers([...sendTiers, { minAmount: 0, maxAmount: 0, companyPercent: 0 }]);
    } else {
      setWithdrawalTiers([...withdrawalTiers, { minAmount: 0, maxAmount: 0, agentPercent: 0, companyPercent: 0 }]);
    }
  };

  const removeTier = (index, tierType = 'send') => {
    if (tierType === 'send') {
      setSendTiers(sendTiers.filter((_, i) => i !== index));
    } else {
      setWithdrawalTiers(withdrawalTiers.filter((_, i) => i !== index));
    }
  };

  const handleSaveSendMoney = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Validate send tiers
      for (const tier of sendTiers) {
        if (isNaN(tier.minAmount) || tier.minAmount < 0) {
          setMessage('All send tier minimum amounts must be valid numbers >= 0');
          setLoading(false);
          return;
        }
        if (isNaN(tier.maxAmount) || tier.maxAmount < tier.minAmount) {
          setMessage('All send tier maximum amounts must be valid numbers >= minimum amount');
          setLoading(false);
          return;
        }
        if (isNaN(tier.companyPercent) || tier.companyPercent < 0 || tier.companyPercent > 100) {
          setMessage('All send tier company commission percentages must be between 0 and 100');
          setLoading(false);
          return;
        }
      }

      const { data } = await adminAPI.setSendMoneyTiers({ tiers: sendTiers });
      setMessage('Send Money Commission Tiers saved successfully!');
      setToastMessage('Send Money Commission Tiers updated successfully');
      setToastType('success');
      
      // Update local state with response
      const normalize = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : Object.values(parsed || {}); } catch (e) { return [] }
        }
        if (typeof val === 'object') return Object.values(val || {});
        return [];
      };
      setSendTiers(normalize(data.tiers));
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to save Send Money Commission Tiers');
      setToastMessage('Failed to save Send Money Commission Tiers');
      setToastType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWithdrawal = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Validate withdrawal tiers
      for (const tier of withdrawalTiers) {
        if (isNaN(tier.minAmount) || tier.minAmount < 0) {
          setMessage('All withdrawal tier minimum amounts must be valid numbers >= 0');
          setLoading(false);
          return;
        }
        if (isNaN(tier.maxAmount) || tier.maxAmount < tier.minAmount) {
          setMessage('All withdrawal tier maximum amounts must be valid numbers >= minimum amount');
          setLoading(false);
          return;
        }
        if (isNaN(tier.agentPercent) || tier.agentPercent < 0 || tier.agentPercent > 100) {
          setMessage('All withdrawal tier agent commission percentages must be between 0 and 100');
          setLoading(false);
          return;
        }
        if (isNaN(tier.companyPercent) || tier.companyPercent < 0 || tier.companyPercent > 100) {
          setMessage('All withdrawal tier company commission percentages must be between 0 and 100');
          setLoading(false);
          return;
        }
      }

      const { data } = await adminAPI.setWithdrawalTiers({ withdrawalTiers });
      setMessage('Withdrawal Commission Tiers saved successfully!');
      setToastMessage('Withdrawal Commission Tiers updated successfully');
      setToastType('success');
      
      // Update local state with response
      const normalize = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : Object.values(parsed || {}); } catch (e) { return [] }
        }
        if (typeof val === 'object') return Object.values(val || {});
        return [];
      };
      setWithdrawalTiers(normalize(data.withdrawalTiers));
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to save Withdrawal Commission Tiers');
      setToastMessage('Failed to save Withdrawal Commission Tiers');
      setToastType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="page-container">
      <div className="page-header">
        <h1>Tiered Commission Settings</h1>
        <p>Configure commission percentages based on transaction amount ranges (from minimum to maximum SSP)</p>
      </div>

      {message && (
        <div className={`alert ${message.includes('Failed') ? 'alert-danger' : 'alert-success'}`}>
          {message}
        </div>
      )}

      {/* Send money tiers */}
      <div className="card tier-card">
        <div className="card-header tier-head">
          <div>
            <h3><Send size={17} /> Send money tiers</h3>
            <p>Commission taken by the company on transfers, by amount range.</p>
          </div>
          <span className="tier-count">{sendTiers.length} tier{sendTiers.length === 1 ? '' : 's'}</span>
        </div>

        <div className="card-body">
          {sendTiers.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Layers size={22} /></span>
              <h3>No send money tiers</h3>
              <p>Add a tier to charge commission on transfers within an amount range.</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => addTier('send')}>
                <Plus size={15} /> Add first tier
              </button>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table tier-table">
                  <thead>
                    <tr>
                      <th>Minimum (SSP)</th>
                      <th>Maximum (SSP)</th>
                      <th>Company %</th>
                      <th className="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sendTiers || []).map((tier, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            type="number" min="0" step="1"
                            value={tier?.minAmount || 0}
                            onChange={(e) => handleTierChange(index, 'minAmount', e.target.value, 'send')}
                            aria-label={`Tier ${index + 1} minimum amount`}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min={tier?.minAmount || 0} step="1"
                            value={tier?.maxAmount || 0}
                            onChange={(e) => handleTierChange(index, 'maxAmount', e.target.value, 'send')}
                            aria-label={`Tier ${index + 1} maximum amount`}
                          />
                        </td>
                        <td>
                          <div className="pct-cell">
                            <input
                              type="number" min="0" max="100" step="0.01"
                              value={tier.companyPercent || 0}
                              onChange={(e) => handleTierChange(index, 'companyPercent', e.target.value, 'send')}
                              aria-label={`Tier ${index + 1} company commission`}
                            />
                            <span>%</span>
                          </div>
                        </td>
                        <td className="right">
                          <button
                            type="button"
                            className="icon-btn is-danger"
                            onClick={() => removeTier(index, 'send')}
                            aria-label={`Remove tier ${index + 1}`}
                            title="Remove tier"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="tier-actions">
                <button type="button" className="btn btn-outline" onClick={() => addTier('send')}>
                  <Plus size={15} /> Add tier
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSendMoney}
                  disabled={loading || sendTiers.length === 0}
                >
                  <Save size={15} /> {loading ? 'Saving…' : 'Save send money tiers'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Withdrawal tiers - a sibling card. It was previously nested inside the
          send-money card body, which rendered a card inside a card. */}
      <div className="card tier-card">
        <div className="card-header tier-head">
          <div>
            <h3><Banknote size={17} /> Withdrawal tiers</h3>
            <p>Commission split between the agent and the company on withdrawals.</p>
          </div>
          <span className="tier-count">{withdrawalTiers.length} tier{withdrawalTiers.length === 1 ? '' : 's'}</span>
        </div>

        <div className="card-body">
          {withdrawalTiers.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Layers size={22} /></span>
              <h3>No withdrawal tiers</h3>
              <p>Add a tier to set agent and company commission for a withdrawal range.</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => addTier('withdrawal')}>
                <Plus size={15} /> Add first tier
              </button>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table tier-table">
                  <thead>
                    <tr>
                      <th>Minimum (SSP)</th>
                      <th>Maximum (SSP)</th>
                      <th>Agent %</th>
                      <th>Company %</th>
                      <th className="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(withdrawalTiers || []).map((tier, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            type="number" min="0" step="1"
                            value={tier?.minAmount || 0}
                            onChange={(e) => handleTierChange(index, 'minAmount', e.target.value, 'withdrawal')}
                            aria-label={`Withdrawal tier ${index + 1} minimum`}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min={tier?.minAmount || 0} step="1"
                            value={tier?.maxAmount || 0}
                            onChange={(e) => handleTierChange(index, 'maxAmount', e.target.value, 'withdrawal')}
                            aria-label={`Withdrawal tier ${index + 1} maximum`}
                          />
                        </td>
                        <td>
                          <div className="pct-cell">
                            <input
                              type="number" min="0" max="100" step="0.01"
                              value={tier.agentPercent || 0}
                              onChange={(e) => handleTierChange(index, 'agentPercent', e.target.value, 'withdrawal')}
                              aria-label={`Withdrawal tier ${index + 1} agent commission`}
                            />
                            <span>%</span>
                          </div>
                        </td>
                        <td>
                          <div className="pct-cell">
                            <input
                              type="number" min="0" max="100" step="0.01"
                              value={tier.companyPercent || 0}
                              onChange={(e) => handleTierChange(index, 'companyPercent', e.target.value, 'withdrawal')}
                              aria-label={`Withdrawal tier ${index + 1} company commission`}
                            />
                            <span>%</span>
                          </div>
                        </td>
                        <td className="right">
                          <button
                            type="button"
                            className="icon-btn is-danger"
                            onClick={() => removeTier(index, 'withdrawal')}
                            aria-label={`Remove withdrawal tier ${index + 1}`}
                            title="Remove tier"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="tier-actions">
                <button type="button" className="btn btn-outline" onClick={() => addTier('withdrawal')}>
                  <Plus size={15} /> Add tier
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveWithdrawal}
                  disabled={loading || withdrawalTiers.length === 0}
                >
                  <Save size={15} /> {loading ? 'Saving…' : 'Save withdrawal tiers'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header">
          <h3><ClipboardList size={18} /> How It Works</h3>
        </div>
        <div className="card-body">
          <p className="hiw-lead">
            When a user sends money or makes a withdrawal, the system finds the tier whose
            <strong> minimum-to-maximum range</strong> contains the transaction amount, and applies
            that tier's percentage.
          </p>

          <div className="hiw-cols">
            <div className="hiw-col">
              <span className="hiw-label">Example ladder</span>
              <ul className="hiw-ladder">
                {HOW_IT_WORKS_TIERS.map((t) => (
                  <li key={t.range}>
                    <span className="hiw-range">{t.range} SSP</span>
                    <span className={'hiw-pct' + (t.percent === '0%' ? ' is-zero' : '')}>{t.percent}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hiw-col">
              <span className="hiw-label">How an amount is matched</span>
              <ul className="hiw-examples">
                {HOW_IT_WORKS_EXAMPLES.map((e) => (
                  <li key={e.amount}>
                    <span className="hiw-amount">{e.amount} SSP</span>
                    <ArrowRight size={14} />
                    <span className="hiw-result">
                      <strong>{e.percent}</strong>
                      <em>{e.range} range</em>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="hiw-note">
            <Info size={14} /> Ranges should not overlap, and the highest tier acts as the catch-all
            for anything above it.
          </p>
        </div>
      </div>
    </div>
    <Footer />
    <Toast 
      message={toastMessage} 
      type={toastType} 
      onClose={() => setToastMessage('')} 
    />
    </>
  );
}
