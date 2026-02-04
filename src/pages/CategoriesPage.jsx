import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function CategoriesPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'SUPER_ADMIN';
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', cooldownDays: 30 });

  const fetchCategories = () => {
    setLoading(true);
    api.get('/api/categories')
      .then(({ data }) => setList(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.get('/api/categories', { signal: controller.signal })
      .then(({ data }) => setList(data))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    setSubmitting(true);
    api.post('/api/categories', form)
      .then(() => {
        setForm({ name: '', cooldownDays: 30 });
        setShowForm(false);
        fetchCategories();
      })
      .catch((err) => setError(err.response?.data?.message || 'Create failed'))
      .finally(() => setSubmitting(false));
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Categories</h1>
        <p className="page-subtitle">Manage business categories (Super Admin can create).</p>
      </motion.div>

      {error && <div className="dashboard-error">{error}</div>}

      <motion.div
        className="content-card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>All categories</h2>
          {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add category'}
          </button>
        )}
        </div>

        {showForm && (
          <motion.form
            onSubmit={handleCreate}
            style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--content-bg)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <label>
              Name
              <input
                className="text-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Category name"
                required
                style={{ marginLeft: '0.5rem' }}
              />
            </label>
            <label>
              Cooldown days
              <input
                type="number"
                className="text-input"
                value={form.cooldownDays}
                onChange={(e) => setForm((f) => ({ ...f, cooldownDays: Number(e.target.value) || 30 }))}
                min={1}
                style={{ marginLeft: '0.5rem', width: '80px' }}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </motion.form>
        )}

        {loading ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}>
            <div className="auth-loading-spinner" />
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cooldown (days)</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c._id}>
                    <td>{c.name}</td>
                    <td>{c.cooldownDays ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>No categories yet.</p>}
          </div>
        )}
      </motion.div>
    </>
  );
}
