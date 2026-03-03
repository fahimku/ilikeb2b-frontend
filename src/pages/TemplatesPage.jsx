import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const TYPE_OPTIONS = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
];

export default function TemplatesPage() {
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

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('WEBSITE');
  const [categoryId, setCategoryId] = useState('');
  const [editingId, setEditingId] = useState(null);

  const fetchTemplates = () => {
    setLoading(true);
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (typeFilter) params.type = typeFilter;
    if (isSuperAdmin && categoryFilter) params.category = categoryFilter;
    api.get('/api/templates', { params })
      .then(({ data }) => setList(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load templates'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchTemplates();
  }, [isAdmin, typeFilter, categoryFilter]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/api/categories').then(({ data }) => setCategories(data || [])).catch(() => {});
  }, [isSuperAdmin]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setType('WEBSITE');
    setCategoryId('');
    setEditingId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    if (isSuperAdmin && !editingId && !categoryId) {
      setError('Category is required for Super Admin.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      type,
      title: title.trim(),
      content: content.trim(),
      ...(isSuperAdmin && !editingId ? { category: categoryId } : {}),
    };
    try {
      if (editingId) {
        await api.put(`/api/templates/${editingId}`, payload);
      } else {
        await api.post('/api/templates', payload);
      }
      resetForm();
      fetchTemplates();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const editItem = (item) => {
    setEditingId(item._id);
    setTitle(item.title || '');
    setContent(item.content || '');
    setType(item.type || 'WEBSITE');
    setCategoryId(item.category?._id || '');
  };

  const toggleStatus = async (item) => {
    try {
      await api.put(`/api/templates/${item._id}`, { isActive: !item.isActive });
      fetchTemplates();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const removeItem = async (item) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`/api/templates/${item._id}`);
      fetchTemplates();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete template');
    }
  };

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Inquiry Templates</h1>
        <p className="page-subtitle">Create reusable response templates for Website and LinkedIn workflows.</p>
      </motion.div>

      {error && <div className="dashboard-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>{editingId ? 'Edit template' : 'New template'}</h2>
        <form onSubmit={submit} style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isSuperAdmin ? '1fr 1fr 1fr' : '1fr 1fr', gap: '0.75rem' }}>
            <select className="select-input" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {isSuperAdmin && !editingId && (
              <select className="select-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            )}
            <input className="text-input" placeholder="Template title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <textarea
            className="text-input"
            rows={4}
            placeholder="Template content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editingId ? 'Update template' : 'Create template')}</button>
            {editingId && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </motion.div>

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input className="text-input" placeholder="Search title..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: '200px' }} />
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchTemplates}>Apply</button>
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
                  <th>Title</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Content</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item._id}>
                    <td><strong>{item.title}</strong></td>
                    <td>{item.type === 'WEBSITE' ? 'Website' : 'LinkedIn'}</td>
                    <td>{item.category?.name || '—'}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td style={{ maxWidth: '340px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{(item.content || '').slice(0, 120)}{item.content?.length > 120 ? '…' : ''}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => editItem(item)}>Edit</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleStatus(item)}>
                          {item.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeItem(item)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No templates found.</p>}
          </div>
        )}
      </motion.div>
    </>
  );
}

