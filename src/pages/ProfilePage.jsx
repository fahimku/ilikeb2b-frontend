import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../config/sidebarNav';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword && !currentPassword) {
      setError('Current password is required to change password');
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.append('name', name.trim());
    if (newPassword) {
      fd.append('currentPassword', currentPassword);
      fd.append('newPassword', newPassword);
    }
    if (profileImageFile) fd.append('profileImage', profileImageFile);

    api.put('/api/auth/profile', fd)
      .then(async () => {
        await refreshUser();
        setSuccess('Profile updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setProfileImageFile(null);
      })
      .catch((err) => setError(err.response?.data?.message || 'Update failed'))
      .finally(() => setSubmitting(false));
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Update your account information.</p>
      </motion.div>

      {error && <div className="dashboard-error">{error}</div>}
      {success && <div style={{ padding: '0.75rem 1rem', background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', color: 'var(--accent)', marginBottom: '1rem' }}>{success}</div>}

      <motion.div
        className="content-card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Your Profile</h2>

        <form onSubmit={handleSubmit} className="dialog-form" style={{ maxWidth: '400px' }}>
          <div className="form-field">
            <label>Profile Image</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              {(user?.profileImage || profileImageFile) ? (
                <img
                  src={profileImageFile ? URL.createObjectURL(profileImageFile) : user?.profileImage}
                  alt=""
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
              <input type="file" accept="image/*" onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          <div className="form-field">
            <label>Name *</label>
            <input className="form-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
          </div>

          <div className="form-field">
            <label style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Email</label>
            <input className="form-input" type="email" value={user?.email || ''} disabled style={{ opacity: 0.8 }} />
          </div>

          <div className="form-field">
            <label style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Role</label>
            <input className="form-input" value={ROLE_LABELS[user?.role] || user?.role || '—'} disabled style={{ opacity: 0.8 }} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Change Password</h3>
          <div className="form-field">
            <label>Current Password</label>
            <input className="form-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required if changing password" />
          </div>
          <div className="form-field">
            <label>New Password</label>
            <input className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
          </div>
          <div className="form-field">
            <label>Confirm New Password</label>
            <input className="form-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
          </div>

          <div className="dialog-form-actions" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <><span className="btn-spinner" style={{ marginRight: '0.5rem' }} />Updating...</> : 'Update Profile'}
            </button>
          </div>
        </form>
      </motion.div>
    </>
  );
}
