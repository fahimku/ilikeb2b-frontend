import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Your account information.</p>
      </motion.div>
      <motion.div
        className="content-card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Profile</h2>
        <dl style={{ margin: 0, display: 'grid', gap: '0.5rem' }}>
          <div><dt style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Name</dt><dd style={{ margin: 0 }}>{user?.name || '—'}</dd></div>
          <div><dt style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Email</dt><dd style={{ margin: 0 }}>{user?.email || '—'}</dd></div>
          <div><dt style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Role</dt><dd style={{ margin: 0 }}>{user?.role || '—'}</dd></div>
        </dl>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '1rem' }}>Password change and more options can be added when the backend supports them.</p>
      </motion.div>
    </>
  );
}
