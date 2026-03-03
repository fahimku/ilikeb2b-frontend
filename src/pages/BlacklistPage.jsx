import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const TYPE_OPTIONS = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
];

export default function BlacklistPage() {
  const { user } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'CATEGORY_ADMIN'].includes(user?.role);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [targetLink, setTargetLink] = useState('');
  const [type, setType] = useState('WEBSITE');
  const [reason, setReason] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const fetchList = () => {
    setLoading(true);
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (typeFilter) params.type = typeFilter;
    if (isSuperAdmin && categoryFilter) params.category = categoryFilter;
    api.get('/api/blacklist', { params })
      .then(({ data }) => setList(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load blacklist'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchList();
  }, [isAdmin, typeFilter, categoryFilter]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/api/categories').then(({ data }) => setCategories(data || [])).catch(() => {});
  }, [isSuperAdmin]);

  const addItem = async (e) => {
    e.preventDefault();
    if (!targetLink.trim()) return;
    if (isSuperAdmin && !categoryId) {
      setError('Category is required for Super Admin.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/api/blacklist', {
        type,
        targetLink: targetLink.trim(),
        reason: reason.trim(),
        ...(isSuperAdmin ? { category: categoryId } : {}),
      });
      setTargetLink('');
      setReason('');
      if (isSuperAdmin) setCategoryId('');
      fetchList();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add to blacklist');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id) => {
    if (!window.confirm('Remove from blacklist?')) return;
    try {
      await api.delete(`/api/blacklist/${id}`);
      fetchList();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove');
    }
  };

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Blacklist Management</h1>
        <p className="page-subtitle">Manage invalid websites/LinkedIn targets and prevent reassignment.</p>
      </motion.div>

      {error && <div className="dashboard-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Add blacklist entry</h2>
        <form onSubmit={addItem} style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: isSuperAdmin ? '1fr 1fr 1fr' : '1fr 1fr' }}>
            <select className="select-input" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {isSuperAdmin && (
              <select className="select-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            )}
            <input className="text-input" value={targetLink} onChange={(e) => setTargetLink(e.target.value)} placeholder="Target link / URL" />
          </div>
          <input className="text-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
          <div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add to blacklist'}</button>
          </div>
        </form>
      </motion.div>

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input className="text-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search link..." style={{ minWidth: '220px' }} />
          <select className="select-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {isSuperAdmin && (
            <select className="select-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchList}>Apply</button>
        </div>

        {loading ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}>
            <div className="auth-loading-spinner" />
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Category</th>
                  <th>Reason</th>
                  <th>Added at</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item._id}>
                    <td>{item.type === 'WEBSITE' ? 'Website' : 'LinkedIn'}</td>
                    <td style={{ maxWidth: '360px', overflowWrap: 'anywhere' }}>{item.targetLink}</td>
                    <td>{item.category?.name || '—'}</td>
                    <td>{item.reason || '—'}</td>
                    <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeItem(item._id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No blacklist records found.</p>}
          </div>
        )}
      </motion.div>
    </>
  );
}

