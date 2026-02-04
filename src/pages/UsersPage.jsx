import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { ROLE_LABELS } from '../config/sidebarNav';
import Dialog from '../components/Dialog';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(values) {
  const err = {};
  if (!values.name?.trim()) err.name = 'Name is required';
  else if (values.name.trim().length < 2) err.name = 'Name must be at least 2 characters';
  if (!values.email?.trim()) err.email = 'Email is required';
  else if (!EMAIL_REGEX.test(values.email.trim())) err.email = 'Enter a valid email address';
  if (!values.password) err.password = 'Password is required';
  else if (values.password.length < 6) err.password = 'Password must be at least 6 characters';
  if (!values.role) err.role = 'Role is required';
  if (!values.category) err.category = 'Category is required';
  return err;
}

const initialValues = {
  name: '',
  email: '',
  password: '',
  role: 'WEBSITE_RESEARCHER',
  country: '',
  category: '',
};

export default function UsersPage() {
  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const fetchUsers = () => {
    api.get('/api/users').then(({ data }) => setList(data)).catch(() => setError('Failed to load users'));
  };

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true);
    Promise.all([
      api.get('/api/users', { signal }),
      api.get('/api/categories', { signal }),
    ])
      .then(([u, c]) => {
        if (signal.aborted) return;
        setList(u.data);
        setCategories(c.data);
        if (c.data?.length) setValues((v) => (v.category ? v : { ...v, category: c.data[0]._id }));
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load');
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const openDialog = () => {
    setErrors({});
    setTouched({});
    setValues((v) => (v.category || categories[0]?._id ? { ...initialValues, role: 'WEBSITE_RESEARCHER', category: v.category || categories[0]?._id } : { ...initialValues }));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setErrors({});
    setValues(initialValues);
  };

  const handleChange = (field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  };

  const handleBlur = (field) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const nextErrors = validateForm({ ...values, [field]: values[field] });
    if (nextErrors[field]) setErrors((e) => ({ ...e, [field]: nextErrors[field] }));
    else setErrors((e) => ({ ...e, [field]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const nextErrors = validateForm(values);
    setErrors(nextErrors);
    setTouched({ name: true, email: true, password: true, role: true, category: true });
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    api.post('/api/users', values)
      .then(() => {
        closeDialog();
        fetchUsers();
      })
      .catch((err) => setError(err.response?.data?.message || 'Create failed'))
      .finally(() => setSubmitting(false));
  };

  const handleToggle = (id) => {
    api.patch(`/api/users/${id}/toggle`)
      .then(() => fetchUsers())
      .catch((err) => setError(err.response?.data?.message || 'Update failed'));
  };

  const fieldProps = (field) => ({
    value: values[field] ?? '',
    onChange: (e) => handleChange(field, e.target.value),
    onBlur: () => handleBlur(field),
    className: `form-input ${errors[field] ? 'form-input-error' : ''}`,
  });

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Users</h1>
        <p className="page-subtitle">Manage team members and their roles.</p>
      </motion.div>

      {error && <div className="dashboard-error">{error}</div>}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Users</h2>
          <button type="button" className="btn btn-primary" onClick={openDialog}>
            + Add User
          </button>
        </div>

        {loading ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}><div className="auth-loading-spinner" /></div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Country</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u._id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABELS[u.role] || u.role}</td>
                    <td>{u.country || '—'}</td>
                    <td>{u.category?.name || '—'}</td>
                    <td><span className={`badge ${u.isActive !== false ? 'badge-approved' : 'badge-disapproved'}`}>{u.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleToggle(u._id)}>
                        {u.isActive !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>No users.</p>}
          </div>
        )}
      </motion.div>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title="Add User"
        subtitle="Create a new user profile"
      >
        <form onSubmit={handleSubmit} className="dialog-form">
          <motion.div className="form-field" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <label htmlFor="user-name">Name *</label>
            <input id="user-name" type="text" placeholder="Full name" {...fieldProps('name')} />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </motion.div>
          <motion.div className="form-field" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <label htmlFor="user-email">Email *</label>
            <input id="user-email" type="email" placeholder="e.g. user@example.com" {...fieldProps('email')} />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </motion.div>
          <motion.div className="form-field" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
            <label htmlFor="user-password">Password *</label>
            <input id="user-password" type="password" placeholder="Min. 6 characters" {...fieldProps('password')} />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </motion.div>
          <motion.div className="form-field" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
            <label htmlFor="user-category">Category *</label>
            {categories.length === 0 ? (
              <div className="form-category-empty">
                <p className="form-category-empty-text">No categories yet. Please add a category first.</p>
                <Link to="/dashboard/categories" className="form-category-empty-link" onClick={() => closeDialog()}>
                  Go to Categories →
                </Link>
              </div>
            ) : (
              <>
                <select id="user-category" {...fieldProps('category')}>
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
                {errors.category && <span className="form-error">{errors.category}</span>}
              </>
            )}
          </motion.div>
          <motion.div className="form-field" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
            <label htmlFor="user-role">Role *</label>
            <select id="user-role" {...fieldProps('role')}>
              {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'SUPER_ADMIN').map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {errors.role && <span className="form-error">{errors.role}</span>}
          </motion.div>
          <motion.div className="form-field" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <label htmlFor="user-country">Country</label>
            <input id="user-country" type="text" placeholder="e.g. USA" {...fieldProps('country')} />
          </motion.div>
          <motion.div
            className="dialog-form-actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <button type="button" className="btn btn-secondary" onClick={closeDialog}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || categories.length === 0}>
              {submitting ? (
                <>
                  <span className="btn-spinner" style={{ marginRight: '0.5rem' }} />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </button>
          </motion.div>
        </form>
      </Dialog>
    </>
  );
}
