import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  CATEGORY_ADMIN: 'Category Admin',
  WEBSITE_RESEARCHER: 'Website Researcher',
  LINKEDIN_RESEARCHER: 'LinkedIn Researcher',
  WEBSITE_INQUIRER: 'Website Inquirer',
  LINKEDIN_INQUIRER: 'LinkedIn Inquirer',
  WEBSITE_RESEARCH_AUDITOR: 'Website Research Auditor',
  LINKEDIN_RESEARCH_AUDITOR: 'LinkedIn Research Auditor',
  WEBSITE_INQUIRY_AUDITOR: 'Website Inquiry Auditor',
  LINKEDIN_INQUIRY_AUDITOR: 'LinkedIn Inquiry Auditor',
};

function StatCard({ title, value, sub, delay, icon }) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      {icon && <span className="stat-icon">{icon}</span>}
      <div className="stat-content">
        <span className="stat-value">{value}</span>
        <span className="stat-title">{title}</span>
        {sub != null && <span className="stat-sub">{sub}</span>}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/dashboard')
      .then(({ data }) => setStats(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const researchByStatus = (stats?.research || []).reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});
  const inquiryByStatus = (stats?.inquiry || []).reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});
  const paymentByStatus = (stats?.payments || []).reduce((acc, r) => {
    acc[r._id] = r.amount;
    return acc;
  }, {});

  return (
    <div className="dashboard">
      <motion.header
        className="dashboard-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="header-left">
          <h1>Dashboard</h1>
          <span className="role-badge">{ROLE_LABELS[user?.role] || user?.role}</span>
        </div>
        <div className="header-right">
          <span className="user-name">{user?.name}</span>
          <motion.button
            type="button"
            className="logout-btn"
            onClick={logout}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Log out
          </motion.button>
        </div>
      </motion.header>

      <main className="dashboard-main">
        {loading && (
          <div className="dashboard-loading">
            <div className="auth-loading-spinner" />
            <span>Loading dashboard...</span>
          </div>
        )}

        {error && (
          <motion.div
            className="dashboard-error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence>
          {!loading && stats && (
            <motion.div
              className="stats-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <StatCard
                title="Total users"
                value={stats.users ?? 0}
                delay={0.05}
                icon="👥"
              />
              <StatCard
                title="Research"
                value={researchByStatus.APPROVED ?? 0}
                sub={`Pending: ${researchByStatus.PENDING ?? 0} · Rejected: ${researchByStatus.DISAPPROVED ?? 0}`}
                delay={0.1}
                icon="🔍"
              />
              <StatCard
                title="Inquiries"
                value={inquiryByStatus.APPROVED ?? 0}
                sub={`Pending: ${inquiryByStatus.PENDING ?? 0} · Rejected: ${inquiryByStatus.DISAPPROVED ?? 0}`}
                delay={0.15}
                icon="✉️"
              />
              <StatCard
                title="Payments"
                value={`$${((paymentByStatus.PAID ?? 0) + (paymentByStatus.UNPAID ?? 0)).toFixed(0)}`}
                sub={`Paid: $${(paymentByStatus.PAID ?? 0).toFixed(0)} · Unpaid: $${(paymentByStatus.UNPAID ?? 0).toFixed(0)}`}
                delay={0.2}
                icon="💰"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
