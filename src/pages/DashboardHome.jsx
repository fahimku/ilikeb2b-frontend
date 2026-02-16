import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { ROLE_LABELS } from '../config/sidebarNav';

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

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/api/categories').then(({ data }) => setCategories(data || [])).catch(() => {});
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = {};
    if (isSuperAdmin && categoryFilter) params.category = categoryFilter;
    api.get('/api/dashboard', { params, signal: controller.signal })
      .then(({ data }) => setStats(data))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [categoryFilter, isSuperAdmin]);

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

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">Welcome back, {user?.name || 'User'}!</h1>
            <p className="page-subtitle">{today}</p>
          </div>
          {isSuperAdmin && (
            <select className="select-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ minWidth: '180px' }}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      </motion.div>

      {loading && (
        <div className="dashboard-loading" style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '3rem' }}>
          <div className="auth-loading-spinner" />
          <span>Loading dashboard...</span>
        </div>
      )}

      {error && (
        <motion.div className="dashboard-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {error}
        </motion.div>
      )}

      {/* Super Admin: Unit prices, totals by role, paid/left, top workers */}
      {!loading && stats?.superAdminPayment && (
        <motion.div
          className="content-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          style={{ marginBottom: '1.5rem' }}
        >
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Payment Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unit Price by Role</span>
              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                {(stats.superAdminPayment.unitPricesByRole || []).map((u) => (
                  <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>{ROLE_LABELS[u._id] || u._id}</span>
                    <span>{(u.unitPrices || []).map((p) => `$${Number(p).toFixed(2)}`).join(', ') || '—'}</span>
                  </div>
                ))}
                {(!stats.superAdminPayment.unitPricesByRole || stats.superAdminPayment.unitPricesByRole.length === 0) && (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total by Role</span>
              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                {(stats.superAdminPayment.totalAmountByRole || []).map((r) => (
                  <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span>{r._id || '—'}</span>
                    <span>${(r.total || 0).toFixed(2)}</span>
                  </div>
                ))}
                {(!stats.superAdminPayment.totalAmountByRole || stats.superAdminPayment.totalAmountByRole.length === 0) && (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payment Paid</span>
              <div style={{ marginTop: '0.5rem', fontSize: '1.25rem', fontWeight: 600 }}>${(stats.superAdminPayment.paymentPaid ?? 0).toFixed(2)}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payment Left</span>
              <div style={{ marginTop: '0.5rem', fontSize: '1.25rem', fontWeight: 600 }}>${(stats.superAdminPayment.paymentLeft ?? 0).toFixed(2)}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Top 3 Researchers</span>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                {(stats.superAdminPayment.topResearchers || []).map((w, i) => (
                  <li key={i}>{w.name}: ${(w.total || 0).toFixed(2)} ({w.count} approved)</li>
                ))}
                {(!stats.superAdminPayment.topResearchers || stats.superAdminPayment.topResearchers.length === 0) && (
                  <li style={{ color: 'var(--text-muted)' }}>—</li>
                )}
              </ul>
            </div>
            <div style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Top 3 Inquirers</span>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                {(stats.superAdminPayment.topInquirers || []).map((w, i) => (
                  <li key={i}>{w.name}: ${(w.total || 0).toFixed(2)} ({w.count} approved)</li>
                ))}
                {(!stats.superAdminPayment.topInquirers || stats.superAdminPayment.topInquirers.length === 0) && (
                  <li style={{ color: 'var(--text-muted)' }}>—</li>
                )}
              </ul>
            </div>
          </div>
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
            {/* Super Admin: global stats */}
            {user?.role === 'SUPER_ADMIN' && (
              <>
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
                  value={`$${((paymentByStatus.PAID ?? 0) + (paymentByStatus.UNPAID ?? 0) + (paymentByStatus.PARTIAL ?? 0)).toFixed(0)}`}
                  sub={`Paid: $${(paymentByStatus.PAID ?? 0).toFixed(0)} · Unpaid: $${(paymentByStatus.UNPAID ?? 0).toFixed(0)}`}
                  delay={0.2}
                  icon="💰"
                />
              </>
            )}
            {/* Category Admin: category-scoped stats */}
            {user?.role === 'CATEGORY_ADMIN' && (
              <>
                <StatCard
                  title="Category users"
                  value={stats.users ?? 0}
                  delay={0.05}
                  icon="👥"
                />
                <StatCard
                  title="Category Research"
                  value={researchByStatus.APPROVED ?? 0}
                  sub={`Pending: ${researchByStatus.PENDING ?? 0} · Rejected: ${researchByStatus.DISAPPROVED ?? 0}`}
                  delay={0.1}
                  icon="🔍"
                />
                <StatCard
                  title="Category Inquiries"
                  value={inquiryByStatus.APPROVED ?? 0}
                  sub={`Pending: ${inquiryByStatus.PENDING ?? 0} · Rejected: ${inquiryByStatus.DISAPPROVED ?? 0}`}
                  delay={0.15}
                  icon="✉️"
                />
                <StatCard
                  title="Category Payments"
                  value={`$${((paymentByStatus.PAID ?? 0) + (paymentByStatus.UNPAID ?? 0) + (paymentByStatus.PARTIAL ?? 0)).toFixed(0)}`}
                  sub={`Paid: $${(paymentByStatus.PAID ?? 0).toFixed(0)} · Unpaid: $${(paymentByStatus.UNPAID ?? 0).toFixed(0)}`}
                  delay={0.2}
                  icon="💰"
                />
              </>
            )}
            {/* Researcher: My Research + My Payments */}
            {['WEBSITE_RESEARCHER', 'LINKEDIN_RESEARCHER'].includes(user?.role) && (
              <>
                <StatCard
                  title="My Research"
                  value={researchByStatus.APPROVED ?? 0}
                  sub={`Pending: ${researchByStatus.PENDING ?? 0} · Rejected: ${researchByStatus.DISAPPROVED ?? 0}`}
                  delay={0.05}
                  icon="🔍"
                />
                <StatCard
                  title="My Payments"
                  value={`$${((stats?.userPaymentSummary?.total ?? 0)).toFixed(0)}`}
                  sub={`Paid: $${(stats?.userPaymentSummary?.paid ?? 0).toFixed(0)} · Pending: $${(stats?.userPaymentSummary?.pending ?? 0).toFixed(0)}`}
                  delay={0.1}
                  icon="💰"
                />
              </>
            )}
            {/* Inquirer: My Inquiries + My Payments */}
            {['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(user?.role) && (
              <>
                <StatCard
                  title="My Inquiries"
                  value={inquiryByStatus.APPROVED ?? 0}
                  sub={`Pending: ${inquiryByStatus.PENDING ?? 0} · Rejected: ${inquiryByStatus.DISAPPROVED ?? 0}`}
                  delay={0.05}
                  icon="✉️"
                />
                <StatCard
                  title="My Payments"
                  value={`$${((stats?.userPaymentSummary?.total ?? 0)).toFixed(0)}`}
                  sub={`Paid: $${(stats?.userPaymentSummary?.paid ?? 0).toFixed(0)} · Pending: $${(stats?.userPaymentSummary?.pending ?? 0).toFixed(0)}`}
                  delay={0.1}
                  icon="💰"
                />
              </>
            )}
            {/* Auditors: Pending to Audit + My Payments */}
            {['WEBSITE_RESEARCH_AUDITOR', 'LINKEDIN_RESEARCH_AUDITOR'].includes(user?.role) && (
              <>
                <StatCard
                  title="Pending Research to Audit"
                  value={researchByStatus.PENDING ?? 0}
                  sub={`Approved: ${researchByStatus.APPROVED ?? 0} · Rejected: ${researchByStatus.DISAPPROVED ?? 0}`}
                  delay={0.05}
                  icon="🔍"
                />
                <StatCard
                  title="My Payments"
                  value={`$${((stats?.userPaymentSummary?.total ?? 0)).toFixed(0)}`}
                  sub={`Paid: $${(stats?.userPaymentSummary?.paid ?? 0).toFixed(0)} · Pending: $${(stats?.userPaymentSummary?.pending ?? 0).toFixed(0)}`}
                  delay={0.1}
                  icon="💰"
                />
              </>
            )}
            {['WEBSITE_INQUIRY_AUDITOR', 'LINKEDIN_INQUIRY_AUDITOR'].includes(user?.role) && (
              <>
                <StatCard
                  title="Pending Inquiries to Audit"
                  value={inquiryByStatus.PENDING ?? 0}
                  sub={`Approved: ${inquiryByStatus.APPROVED ?? 0} · Rejected: ${inquiryByStatus.DISAPPROVED ?? 0}`}
                  delay={0.05}
                  icon="✉️"
                />
                <StatCard
                  title="My Payments"
                  value={`$${((stats?.userPaymentSummary?.total ?? 0)).toFixed(0)}`}
                  sub={`Paid: $${(stats?.userPaymentSummary?.paid ?? 0).toFixed(0)} · Pending: $${(stats?.userPaymentSummary?.pending ?? 0).toFixed(0)}`}
                  delay={0.1}
                  icon="💰"
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notices & Messages - below stat cards for all users */}
      {(stats?.notices?.length > 0 || stats?.unreadMessages > 0) && (
        <motion.div
          className="content-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}
        >
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Notices & Messages</h2>
          {stats?.notices?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: stats?.unreadMessages > 0 ? '1rem' : 0 }}>
              {stats.notices.map((n) => (
                <div key={n._id} style={{ padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{n.title}</strong>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{n.body?.slice(0, 120)}{n.body?.length > 120 ? '…' : ''}</p>
                </div>
              ))}
            </div>
          )}
          {stats?.unreadMessages > 0 && (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent)' }}>
              You have {stats.unreadMessages} unread inner message(s). <Link to="/dashboard/notices" style={{ color: 'var(--accent)' }}>View →</Link>
            </p>
          )}
        </motion.div>
      )}
    </>
  );
}
