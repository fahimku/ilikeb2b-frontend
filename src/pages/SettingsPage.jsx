import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';

const TABS = [
  { id: 'disapproval', label: 'Disapproval Reasons' },
  { id: 'general', label: 'General' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('disapproval');
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');

  const fetchReasons = () => {
    setLoading(true);
    api.get('/api/settings/disapproval-reasons')
      .then(({ data }) => setReasons(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'disapproval') fetchReasons();
  }, [activeTab]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setSubmitting(true);
    api.post('/api/settings/disapproval-reasons', { label: newLabel.trim() })
      .then(() => {
        setNewLabel('');
        setShowAdd(false);
        fetchReasons();
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to add'))
      .finally(() => setSubmitting(false));
  };

  const handleUpdate = (id) => {
    if (!editLabel.trim()) return;
    setSubmitting(true);
    api.put(`/api/settings/disapproval-reasons/${id}`, { label: editLabel.trim() })
      .then(() => {
        setEditingId(null);
        setEditLabel('');
        fetchReasons();
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to update'))
      .finally(() => setSubmitting(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Remove this reason?')) return;
    api.delete(`/api/settings/disapproval-reasons/${id}`)
      .then(() => fetchReasons())
      .catch((err) => setError(err.response?.data?.message || 'Failed to delete'));
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage system settings and configurations.</p>
      </motion.div>

      <div className="settings-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      {activeTab === 'disapproval' && (
        <motion.div
          className="content-card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
        >
          <div className="settings-section-head">
            <div>
              <h2 className="settings-section-title">Disapproval Reasons</h2>
              <p className="settings-section-desc">Manage reasons that auditors can use when disapproving submissions.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAdd(true)}
            >
              + Add Reason
            </button>
          </div>

          {showAdd && (
            <form onSubmit={handleAdd} className="settings-add-form">
              <input
                type="text"
                className="text-input"
                placeholder="Reason label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !newLabel.trim()}>
                {submitting ? 'Adding...' : 'Add'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowAdd(false); setNewLabel(''); }}>
                Cancel
              </button>
            </form>
          )}

          {loading ? (
            <div className="dashboard-loading" style={{ padding: '2rem' }}>
              <div className="auth-loading-spinner" />
            </div>
          ) : reasons.length === 0 ? (
            <div className="settings-empty">
              <span className="settings-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </span>
              <p className="settings-empty-text">No disapproval reasons configured</p>
            </div>
          ) : (
            <ul className="settings-reasons-list">
              {reasons.map((r) => (
                <li key={r._id} className="settings-reason-item">
                  {editingId === r._id ? (
                    <>
                      <input
                        type="text"
                        className="text-input"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleUpdate(r._id)} disabled={submitting}>Save</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingId(null); setEditLabel(''); }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="settings-reason-label">{r.label}</span>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingId(r._id); setEditLabel(r.label); }}>Edit</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDelete(r._id)}>Delete</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}

      {activeTab === 'general' && (
        <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
          <h2 className="settings-section-title">General</h2>
          <p className="settings-section-desc">Other system options can be added here.</p>
        </motion.div>
      )}
    </>
  );
}
