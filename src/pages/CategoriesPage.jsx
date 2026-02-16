import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Dialog from '../components/Dialog';

export default function CategoriesPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'SUPER_ADMIN';
  const [list, setList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', cooldownDays: 30 });
  const [search, setSearch] = useState('');

  const fetchCategories = () => {
    setLoading(true);
    api.get('/api/categories')
      .then(({ data }) => {
        setList(data);
        setFilteredList(data);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.get('/api/categories', { signal: controller.signal })
      .then(({ data }) => {
        setList(data);
        setFilteredList(data);
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredList(list);
    } else {
      const searchLower = search.toLowerCase();
      setFilteredList(list.filter((c) => c.name?.toLowerCase().includes(searchLower)));
    }
  }, [search, list]);

  const openDialog = () => {
    setForm({ name: '', cooldownDays: 30 });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setForm({ name: '', cooldownDays: 30 });
  };

  const handleCreate = (e) => {
    e.preventDefault();
    setSubmitting(true);
    api.post('/api/categories', form)
      .then(() => {
        closeDialog();
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>All categories</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              className="text-input"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '200px' }}
            />
            {canCreate && (
              <button type="button" className="btn btn-primary" onClick={openDialog}>
                Add category
              </button>
            )}
          </div>
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
                  <th>Name</th>
                  <th>Cooldown (days)</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((c) => (
                  <tr key={c._id}>
                    <td>{c.name}</td>
                    <td>{c.cooldownDays ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredList.length === 0 && list.length > 0 && <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>No categories match your search.</p>}
            {list.length === 0 && <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>No categories yet.</p>}
          </div>
        )}
      </motion.div>

      {canCreate && (
        <Dialog open={dialogOpen} onClose={closeDialog} title="Add category" subtitle="Create a new business category.">
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label>
              <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Name</span>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Category name"
                required
              />
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Cooldown (days)</span>
              <input
                type="number"
                className="form-input"
                value={form.cooldownDays}
                onChange={(e) => setForm((f) => ({ ...f, cooldownDays: Number(e.target.value) || 30 }))}
                min={1}
                style={{ width: '100px' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeDialog}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
