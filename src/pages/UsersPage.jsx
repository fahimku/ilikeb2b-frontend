import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../config/sidebarNav';
import Dialog from '../components/Dialog';
import { COUNTRIES } from '../config/countries';

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
  unitPayment: '',
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [list, setList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [editProfileImageFile, setEditProfileImageFile] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const isCategoryAdmin = currentUser?.role === 'CATEGORY_ADMIN';
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const fetchUsers = (signal) => {
    const params = {};
    if (isSuperAdmin && categoryFilter) params.category = categoryFilter;
    return api.get('/api/users', { params, signal });
  };

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true);
    Promise.all([
      fetchUsers(signal),
      api.get('/api/categories', { signal }),
    ])
      .then(([u, c]) => {
        if (signal.aborted) return;
        setList(u.data);
        setFilteredList(u.data);
        setCategories(c.data);
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load');
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [categoryFilter, isSuperAdmin]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredList(list);
    } else {
      const searchLower = search.toLowerCase();
      setFilteredList(list.filter((u) => 
        u.name?.toLowerCase().includes(searchLower) || 
        u.email?.toLowerCase().includes(searchLower) ||
        u.role?.toLowerCase().includes(searchLower)
      ));
    }
  }, [search, list]);

  const openDialog = () => {
    setErrors({});
    setTouched({});
    setProfileImageFile(null);
    const adminCategory = currentUser?.category?._id ?? currentUser?.category;
    const defaultCategory = isCategoryAdmin ? adminCategory : (values.category || categories[0]?._id);
    setValues({ ...initialValues, role: 'WEBSITE_RESEARCHER', category: defaultCategory || '', unitPayment: '' });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setErrors({});
    setValues(initialValues);
    setProfileImageFile(null);
  };

  const openEditDialog = (u) => {
    setEditUser(u);
    setEditValues({
      name: u.name || '',
      email: u.email || '',
      country: u.country || '',
      role: u.role || '',
      category: u.category?._id || u.category || '',
      isActive: u.isActive !== false,
      unitPayment: u.unitPayment ?? '',
      trustedInquirer: !!u.trustedInquirer,
    });
    setEditProfileImageFile(null);
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditUser(null);
    setEditProfileImageFile(null);
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
    const fd = new FormData();
    fd.append('name', values.name.trim());
    fd.append('email', values.email.trim());
    fd.append('password', values.password);
    fd.append('role', values.role);
    fd.append('country', values.country || '');
    fd.append('category', values.category);
    if (values.unitPayment !== '' && values.unitPayment != null) fd.append('unitPayment', values.unitPayment);
    if (profileImageFile) fd.append('profileImage', profileImageFile);
    api.post('/api/users', fd)
      .then(() => {
        closeDialog();
        fetchUsers();
      })
      .catch((err) => setError(err.response?.data?.message || 'Create failed'))
      .finally(() => setSubmitting(false));
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editUser) return;
    setError('');
    setEditSubmitting(true);
    const fd = new FormData();
    fd.append('name', editValues.name.trim());
    fd.append('email', editValues.email.trim());
    fd.append('country', editValues.country || '');
    fd.append('role', editValues.role);
    fd.append('category', editValues.category || '');
    fd.append('isActive', editValues.isActive);
    if (isSuperAdmin && editValues.unitPayment !== '' && editValues.unitPayment != null) {
      fd.append('unitPayment', editValues.unitPayment);
    }
    if ((isSuperAdmin || isCategoryAdmin) && ['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(editValues.role) && editValues.trustedInquirer !== undefined) {
      fd.append('trustedInquirer', editValues.trustedInquirer ? '1' : '0');
    }
    if (editProfileImageFile) fd.append('profileImage', editProfileImageFile);
    api.put(`/api/users/${editUser._id}`, fd)
      .then(() => {
        closeEditDialog();
        fetchUsers();
      })
      .catch((err) => setError(err.response?.data?.message || 'Update failed'))
      .finally(() => setEditSubmitting(false));
  };

  const canEditUser = (u) => {
    if (isSuperAdmin) return true;
    if (isCategoryAdmin) return String(u.category?._id || u.category) === String(currentUser?.category?._id ?? currentUser?.category);
    return false;
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Users</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="text-input"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '180px' }}
            />
            {isSuperAdmin && (
              <select className="select-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ minWidth: '150px' }}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            )}
            <button type="button" className="btn btn-primary" onClick={openDialog}>
              + Add User
            </button>
          </div>
        </div>

        {loading ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}><div className="auth-loading-spinner" /></div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '44px' }}>Photo</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Country</th>
                  <th>Category</th>
                  <th>Unit Pay</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((u) => (
                  <tr key={u._id}>
                    <td>
                      {u.profileImage ? (
                        <img src={u.profileImage} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem' }}>{u.name?.charAt(0)?.toUpperCase() || '?'}</span>
                      )}
                    </td>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {ROLE_LABELS[u.role] || u.role}
                        {['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(u.role) && u.trustedInquirer && (
                          <span className="badge" style={{ background: 'var(--accent)', color: 'var(--bg)', fontSize: '0.7rem' }}>Trusted</span>
                        )}
                      </span>
                    </td>
                    <td>{u.country || '—'}</td>
                    <td>{u.category?.name || '—'}</td>
                    <td>{u.unitPayment != null ? u.unitPayment : '—'}</td>
                    <td><span className={`badge ${u.isActive !== false ? 'badge-approved' : 'badge-disapproved'}`}>{u.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {canEditUser(u) && (
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEditDialog(u)}>Edit</button>
                      )}
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
                <select id="user-category" {...fieldProps('category')} disabled={isCategoryAdmin}>
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
                {isCategoryAdmin && <span className="form-hint" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Same as your category</span>}
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
            <select id="user-country" {...fieldProps('country')}>
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </motion.div>
          <motion.div className="form-field" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
            <label htmlFor="user-unitPayment">Unit Payment</label>
            <input id="user-unitPayment" type="number" min="0" step="0.01" placeholder="0" {...fieldProps('unitPayment')} disabled={isCategoryAdmin} />
            {isCategoryAdmin && <span className="form-hint" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Super Admin only</span>}
          </motion.div>
          <motion.div className="form-field" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <label htmlFor="user-profileImage">Profile Image (optional)</label>
            <input id="user-profileImage" type="file" accept="image/*" onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)} />
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

      <Dialog open={editDialogOpen} onClose={closeEditDialog} title="Edit User" subtitle={editUser ? `Update ${editUser.name}` : ''}>
        {editUser && (
          <form onSubmit={handleEditSubmit} className="dialog-form">
            <div className="form-field">
              <label>Profile Image</label>
              {editUser.profileImage && !editProfileImageFile && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <img src={editUser.profileImage} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                </div>
              )}
              <input type="file" accept="image/*" onChange={(e) => setEditProfileImageFile(e.target.files?.[0] || null)} />
            </div>
            <div className="form-field">
              <label>Name *</label>
              <input className="form-input" value={editValues.name} onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))} required />
            </div>
            <div className="form-field">
              <label>Email *</label>
              <input className="form-input" type="email" value={editValues.email} onChange={(e) => setEditValues((v) => ({ ...v, email: e.target.value }))} required disabled={!isSuperAdmin} />
              {!isSuperAdmin && <span className="form-hint" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Super Admin only</span>}
            </div>
            <div className="form-field">
              <label>Country</label>
              <select className="form-input" value={editValues.country} onChange={(e) => setEditValues((v) => ({ ...v, country: e.target.value }))}>
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {isSuperAdmin && (
              <>
                <div className="form-field">
                  <label>Role</label>
                  <select className="form-input" value={editValues.role} onChange={(e) => setEditValues((v) => ({ ...v, role: e.target.value }))}>
                    {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'SUPER_ADMIN').map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Category</label>
                  <select className="form-input" value={editValues.category} onChange={(e) => setEditValues((v) => ({ ...v, category: e.target.value }))}>
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Unit Payment</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={editValues.unitPayment} onChange={(e) => setEditValues((v) => ({ ...v, unitPayment: e.target.value }))} />
                </div>
              </>
            )}
            {!isSuperAdmin && (
              <div className="form-field">
                <label>Unit Payment</label>
                <input className="form-input" type="number" value={editValues.unitPayment} disabled />
              </div>
            )}
            {(isSuperAdmin || isCategoryAdmin) && ['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(editValues.role) && (
              <div className="form-field">
                <label>
                  <input type="checkbox" checked={editValues.trustedInquirer} onChange={(e) => setEditValues((v) => ({ ...v, trustedInquirer: e.target.checked }))} /> Trusted Inquirer (can submit inquiry without screenshot)
                </label>
              </div>
            )}
            <div className="form-field">
              <label>
                <input type="checkbox" checked={editValues.isActive} onChange={(e) => setEditValues((v) => ({ ...v, isActive: e.target.checked }))} /> Active
              </label>
            </div>
            <div className="dialog-form-actions">
              <button type="button" className="btn btn-secondary" onClick={closeEditDialog}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                {editSubmitting ? <><span className="btn-spinner" style={{ marginRight: '0.5rem' }} />Updating...</> : 'Update'}
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
