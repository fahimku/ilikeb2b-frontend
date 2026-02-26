import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { ROLE_LABELS } from '../config/sidebarNav';

const CHART_COLORS = ['#0ea5e9', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6'];

function MetricCard({ title, value, sub, delay, icon }) {
  return (
    <motion.div
      className="dashboard-metric-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      {icon && <div className="dashboard-metric-icon">{icon}</div>}
      <div className="dashboard-metric-value">{value}</div>
      <div className="dashboard-metric-title">{title}</div>
      {sub != null && <div className="dashboard-metric-sub">{sub}</div>}
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
  const [researchByCountry, setResearchByCountry] = useState([]);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isResearcher = ['WEBSITE_RESEARCHER', 'LINKEDIN_RESEARCHER'].includes(user?.role);

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

  // Country statistics: only approved research counts per country (for researchers)
  useEffect(() => {
    if (!isResearcher || loading) return;
    const controller = new AbortController();
    if (stats?.researchByCountry && Array.isArray(stats.researchByCountry)) {
      setResearchByCountry(stats.researchByCountry);
      return () => controller.abort();
    }
    api.get('/api/research', { params: { status: 'APPROVED', limit: 1000 }, signal: controller.signal })
      .then(({ data }) => {
        const list = data?.data || [];
        const byCountry = list.reduce((acc, r) => {
          const c = (r.country || '').trim() || '—';
          acc[c] = (acc[c] || 0) + 1;
          return acc;
        }, {});
        setResearchByCountry(
          Object.entries(byCountry)
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => (b.count - a.count))
        );
      })
      .catch(() => setResearchByCountry([]));
    return () => controller.abort();
  }, [isResearcher, loading, stats?.researchByCountry]);

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

  // researchByType: { type, status, count }[]
  const researchByTypeMap = (stats?.researchByType || []).reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = {};
    acc[r.type][r.status] = r.count;
    return acc;
  }, {});
  // inquiryByType: { type, status, count }[]
  const inquiryByTypeMap = (stats?.inquiryByType || []).reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = {};
    acc[r.type][r.status] = r.count;
    return acc;
  }, {});

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div
      className="dashboard-home"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hero: welcome + date + category filter */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-left">
          <h1>Welcome back, {user?.name || 'User'}!</h1>
          <p>{today}</p>
        </div>
        {isSuperAdmin && (
          <select className="select-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="dashboard-loading" style={{ minHeight: '200px' }}>
          <div className="auth-loading-spinner" />
          <span>Loading dashboard...</span>
        </div>
      )}

      {error && (
        <motion.div className="dashboard-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {error}
        </motion.div>
      )}

      {/* Key metrics grid */}
      <AnimatePresence>
        {!loading && stats && (
          <motion.div
            className="dashboard-metrics"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {user?.role === 'SUPER_ADMIN' && (
              <>
                <MetricCard title="Categories" value={stats.categoryCount ?? 0} delay={0.05} icon="📁" />
                <MetricCard title="Total users" value={stats.users ?? 0} delay={0.08} icon="👥" />
                <MetricCard title="Research" value={researchByStatus.APPROVED ?? 0} sub={`Pending: ${researchByStatus.PENDING ?? 0} · Rejected: ${researchByStatus.DISAPPROVED ?? 0}`} delay={0.1} icon="🔍" />
                <MetricCard title="Inquiries" value={inquiryByStatus.APPROVED ?? 0} sub={`Pending: ${inquiryByStatus.PENDING ?? 0} · Rejected: ${inquiryByStatus.DISAPPROVED ?? 0}`} delay={0.15} icon="✉️" />
                <MetricCard title="Payments" value={`$${((paymentByStatus.PAID ?? 0) + (paymentByStatus.UNPAID ?? 0) + (paymentByStatus.PARTIAL ?? 0)).toFixed(0)}`} sub={`Paid: $${(paymentByStatus.PAID ?? 0).toFixed(0)} · Unpaid: $${(paymentByStatus.UNPAID ?? 0).toFixed(0)}`} delay={0.2} icon="💰" />
              </>
            )}
            {user?.role === 'CATEGORY_ADMIN' && (
              <>
                <MetricCard title="Category users" value={stats.users ?? 0} delay={0.05} icon="👥" />
                <MetricCard title="Category Research" value={researchByStatus.APPROVED ?? 0} sub={`Pending: ${researchByStatus.PENDING ?? 0} · Rejected: ${researchByStatus.DISAPPROVED ?? 0}`} delay={0.1} icon="🔍" />
                <MetricCard title="Category Inquiries" value={inquiryByStatus.APPROVED ?? 0} sub={`Pending: ${inquiryByStatus.PENDING ?? 0} · Rejected: ${inquiryByStatus.DISAPPROVED ?? 0}`} delay={0.15} icon="✉️" />
                <MetricCard title="Category Payments" value={`$${((paymentByStatus.PAID ?? 0) + (paymentByStatus.UNPAID ?? 0) + (paymentByStatus.PARTIAL ?? 0)).toFixed(0)}`} sub={`Paid: $${(paymentByStatus.PAID ?? 0).toFixed(0)} · Unpaid: $${(paymentByStatus.UNPAID ?? 0).toFixed(0)}`} delay={0.2} icon="💰" />
              </>
            )}
            {['WEBSITE_RESEARCHER', 'LINKEDIN_RESEARCHER'].includes(user?.role) && (
              <>
                <MetricCard title="My Research" value={researchByStatus.APPROVED ?? 0} sub={`Pending: ${researchByStatus.PENDING ?? 0} · Rejected: ${researchByStatus.DISAPPROVED ?? 0}`} delay={0.05} icon="🔍" />
                <MetricCard title="My Payments" value={`$${((stats?.userPaymentSummary?.total ?? 0)).toFixed(0)}`} sub={`Paid: $${(stats?.userPaymentSummary?.paid ?? 0).toFixed(0)} · Pending: $${(stats?.userPaymentSummary?.pending ?? 0).toFixed(0)}`} delay={0.1} icon="💰" />
              </>
            )}
            {['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(user?.role) && (
              <>
                <MetricCard title="Assigned to you" value={stats?.distributedCount ?? 0} sub="Research assigned, not yet inquired" delay={0.05} icon="📋" />
                <MetricCard title="My Inquiries" value={inquiryByStatus.APPROVED ?? 0} sub={`Pending: ${inquiryByStatus.PENDING ?? 0} · Rejected: ${inquiryByStatus.DISAPPROVED ?? 0}`} delay={0.08} icon="✉️" />
                <MetricCard title="My Payments" value={`$${((stats?.userPaymentSummary?.total ?? 0)).toFixed(0)}`} sub={`Paid: $${(stats?.userPaymentSummary?.paid ?? 0).toFixed(0)} · Pending: $${(stats?.userPaymentSummary?.pending ?? 0).toFixed(0)}`} delay={0.1} icon="💰" />
              </>
            )}
            {['WEBSITE_RESEARCH_AUDITOR', 'LINKEDIN_RESEARCH_AUDITOR'].includes(user?.role) && (
              <>
                <MetricCard title="Pending Research to Audit" value={researchByStatus.PENDING ?? 0} sub={`Approved: ${researchByStatus.APPROVED ?? 0} · Rejected: ${researchByStatus.DISAPPROVED ?? 0}`} delay={0.05} icon="🔍" />
                <MetricCard title="My Payments" value={`$${((stats?.userPaymentSummary?.total ?? 0)).toFixed(0)}`} sub={`Paid: $${(stats?.userPaymentSummary?.paid ?? 0).toFixed(0)} · Pending: $${(stats?.userPaymentSummary?.pending ?? 0).toFixed(0)}`} delay={0.1} icon="💰" />
              </>
            )}
            {['WEBSITE_INQUIRY_AUDITOR', 'LINKEDIN_INQUIRY_AUDITOR'].includes(user?.role) && (
              <>
                <MetricCard title="Pending Inquiries to Audit" value={inquiryByStatus.PENDING ?? 0} sub={`Approved: ${inquiryByStatus.APPROVED ?? 0} · Rejected: ${inquiryByStatus.DISAPPROVED ?? 0}`} delay={0.05} icon="✉️" />
                <MetricCard title="My Payments" value={`$${((stats?.userPaymentSummary?.total ?? 0)).toFixed(0)}`} sub={`Paid: $${(stats?.userPaymentSummary?.paid ?? 0).toFixed(0)} · Pending: $${(stats?.userPaymentSummary?.pending ?? 0).toFixed(0)}`} delay={0.1} icon="💰" />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Super Admin: Users by role (below metric cards) */}
      {!loading && user?.role === 'SUPER_ADMIN' && (stats?.usersByRole?.length > 0) && (
        <motion.div className="dashboard-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
          <h2 className="dashboard-section-title">Users by role</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {stats.usersByRole.map(({ role, count }) => (
              <span key={role} className="dashboard-pill">
                {ROLE_LABELS[role] || role}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Super Admin: Payment Overview (below key metrics) */}
      {!loading && stats?.superAdminPayment && (
        <motion.div className="dashboard-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
          <h2 className="dashboard-section-title">Payment Overview</h2>
          <div className="dashboard-section-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '1.25rem' }}>
            <div className="dashboard-kvp" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span className="dashboard-kvp-label">Unit price by role</span>
              <div style={{ fontSize: '0.9rem' }}>
                {(stats.superAdminPayment.unitPricesByRole || []).map((u) => (
                  <div key={u._id} className="dashboard-kvp">
                    <span className="dashboard-kvp-label">{ROLE_LABELS[u._id] || u._id}</span>
                    <span className="dashboard-kvp-value">{(u.unitPrices || []).map((p) => `$${Number(p).toFixed(2)}`).join(', ') || '—'}</span>
                  </div>
                ))}
                {(!stats.superAdminPayment.unitPricesByRole || stats.superAdminPayment.unitPricesByRole.length === 0) && (
                  <span className="dashboard-kvp-value" style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            </div>
            <div className="dashboard-kvp" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span className="dashboard-kvp-label">Total by role</span>
              <div style={{ fontSize: '0.9rem' }}>
                {(stats.superAdminPayment.totalAmountByRole || []).map((r) => (
                  <div key={r._id} className="dashboard-kvp">
                    <span className="dashboard-kvp-label">{r._id || '—'}</span>
                    <span className="dashboard-kvp-value">${(r.total || 0).toFixed(2)}</span>
                  </div>
                ))}
                {(!stats.superAdminPayment.totalAmountByRole || stats.superAdminPayment.totalAmountByRole.length === 0) && (
                  <span className="dashboard-kvp-value" style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            </div>
            <div className="dashboard-kvp" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="dashboard-kvp-label">Payment paid</span>
              <span className="dashboard-kvp-value" style={{ fontSize: '1.25rem' }}>${(stats.superAdminPayment.paymentPaid ?? 0).toFixed(2)}</span>
            </div>
            <div className="dashboard-kvp" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="dashboard-kvp-label">Payment left</span>
              <span className="dashboard-kvp-value" style={{ fontSize: '1.25rem' }}>${(stats.superAdminPayment.paymentLeft ?? 0).toFixed(2)}</span>
            </div>
          </div>
          <div className="dashboard-section-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <span className="dashboard-kvp-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Top 3 researchers</span>
              {(stats.superAdminPayment.topResearchers || []).length > 0 ? (
                (stats.superAdminPayment.topResearchers || []).map((w, i) => (
                  <div key={i} className="dashboard-leader-item">
                    <span>{w.name}</span>
                    <span className="dashboard-kvp-value">${(w.total || 0).toFixed(2)} ({w.count})</span>
                  </div>
                ))
              ) : (
                <p className="dashboard-empty-hint">—</p>
              )}
            </div>
            <div>
              <span className="dashboard-kvp-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Top 3 inquirers</span>
              {(stats.superAdminPayment.topInquirers || []).length > 0 ? (
                (stats.superAdminPayment.topInquirers || []).map((w, i) => (
                  <div key={i} className="dashboard-leader-item">
                    <span>{w.name}</span>
                    <span className="dashboard-kvp-value">${(w.total || 0).toFixed(2)} ({w.count})</span>
                  </div>
                ))
              ) : (
                <p className="dashboard-empty-hint">—</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Data visualization — for roles with full stats */}
      {!loading && stats && (user?.role === 'SUPER_ADMIN' || user?.role === 'CATEGORY_ADMIN') && (
        <motion.div
          className="dashboard-section"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <h2 className="dashboard-section-title">Data Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '0.5rem' }}>
            <div style={{ minHeight: '240px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Research by status</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    { name: 'Approved', count: researchByStatus.APPROVED ?? 0, fill: CHART_COLORS[1] },
                    { name: 'Pending', count: researchByStatus.PENDING ?? 0, fill: CHART_COLORS[2] },
                    { name: 'Rejected', count: researchByStatus.DISAPPROVED ?? 0, fill: CHART_COLORS[3] },
                  ]}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ minHeight: '240px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Inquiries by status</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    { name: 'Approved', count: inquiryByStatus.APPROVED ?? 0, fill: CHART_COLORS[1] },
                    { name: 'Pending', count: inquiryByStatus.PENDING ?? 0, fill: CHART_COLORS[2] },
                    { name: 'Rejected', count: inquiryByStatus.DISAPPROVED ?? 0, fill: CHART_COLORS[3] },
                  ]}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ minHeight: '240px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Payments</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Paid', value: paymentByStatus.PAID ?? 0, color: CHART_COLORS[1] },
                      { name: 'Unpaid', value: paymentByStatus.UNPAID ?? 0, color: CHART_COLORS[2] },
                      { name: 'Partial', value: paymentByStatus.PARTIAL ?? 0, color: CHART_COLORS[3] },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => value ? `${name}: ${value}` : null}
                  >
                    {[
                      { name: 'Paid', value: paymentByStatus.PAID ?? 0 },
                      { name: 'Unpaid', value: paymentByStatus.UNPAID ?? 0 },
                      { name: 'Partial', value: paymentByStatus.PARTIAL ?? 0 },
                    ]
                      .filter((d) => d.value > 0)
                      .map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(0)}`, 'Amount']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      {/* Researcher: Scholarship */}
      {!loading && isResearcher && (stats?.topWorkersByType?.topResearchers?.length > 0) && (
        <motion.div className="dashboard-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <h2 className="dashboard-section-title">Scholarship — Top researchers this month</h2>
          <div className="dashboard-section-grid">
            {stats.topWorkersByType.topResearchers.map((w, i) => (
              <div key={i} className="dashboard-leader-item">
                <span>{w.name}</span>
                <span className="dashboard-kvp-value">${(w.total || 0).toFixed(2)} ({w.count} approved)</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Inquirer: Scholarship */}
      {!loading && ['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(user?.role) && (stats?.topWorkersByType?.topInquirers?.length > 0) && (
        <motion.div className="dashboard-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <h2 className="dashboard-section-title">Scholarship — Top inquirers this month</h2>
          <div className="dashboard-section-grid">
            {stats.topWorkersByType.topInquirers.map((w, i) => (
              <div key={i} className="dashboard-leader-item">
                <span>{w.name}</span>
                <span className="dashboard-kvp-value">${(w.total || 0).toFixed(2)} ({w.count} approved)</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Researcher: Approved research by country */}
      {isResearcher && researchByCountry.length > 0 && (
        <motion.div className="dashboard-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="dashboard-section-title">Approved research by country</h2>
          <p className="dashboard-metric-sub" style={{ marginBottom: '1rem' }}>Counts reflect approved research entries only.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
            {researchByCountry.map(({ country, count }) => (
              <div key={country} className="dashboard-country-chip">
                <span>{country}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Notices & Messages */}
      {(stats?.notices?.length > 0 || stats?.unreadMessages > 0) && (
        <motion.div className="dashboard-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="dashboard-section-title">Notices & Messages</h2>
          {stats?.notices?.length > 0 && (
            <div style={{ marginBottom: stats?.unreadMessages > 0 ? '1rem' : 0 }}>
              {stats.notices.map((n) => (
                <div key={n._id} className="dashboard-notice-item">
                  <strong>{n.title}</strong>
                  <p>{n.body?.slice(0, 120)}{n.body?.length > 120 ? '…' : ''}</p>
                </div>
              ))}
            </div>
          )}
          {stats?.unreadMessages > 0 && (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 500 }}>
              You have {stats.unreadMessages} unread message(s). <Link to="/dashboard/notices" style={{ color: 'var(--accent)' }}>View →</Link>
            </p>
          )}
        </motion.div>
      )}

      {/* Reports — last (Category Admin only) */}
      {!loading && user?.role === 'CATEGORY_ADMIN' && (
        <motion.div className="dashboard-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h2 className="dashboard-section-title">Reports</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            <div className="dashboard-section-grid">
              <h3 className="dashboard-kvp-label" style={{ marginBottom: '0.5rem' }}>Research by type</h3>
              <div className="dashboard-notice-item" style={{ borderLeftColor: 'var(--border)' }}>
                <strong>Website</strong> — Approved: {(researchByTypeMap.WEBSITE || {}).APPROVED ?? 0} · Pending: {(researchByTypeMap.WEBSITE || {}).PENDING ?? 0} · Disapproved: {(researchByTypeMap.WEBSITE || {}).DISAPPROVED ?? 0}
              </div>
              <div className="dashboard-notice-item" style={{ borderLeftColor: 'var(--border)' }}>
                <strong>LinkedIn</strong> — Approved: {(researchByTypeMap.LINKEDIN || {}).APPROVED ?? 0} · Pending: {(researchByTypeMap.LINKEDIN || {}).PENDING ?? 0} · Disapproved: {(researchByTypeMap.LINKEDIN || {}).DISAPPROVED ?? 0}
              </div>
            </div>
            <div className="dashboard-section-grid">
              <h3 className="dashboard-kvp-label" style={{ marginBottom: '0.5rem' }}>Inquiry by type</h3>
              <div className="dashboard-notice-item" style={{ borderLeftColor: 'var(--border)' }}>
                <strong>Website</strong> — Approved: {(inquiryByTypeMap.WEBSITE || {}).APPROVED ?? 0} · Pending: {(inquiryByTypeMap.WEBSITE || {}).PENDING ?? 0} · Disapproved: {(inquiryByTypeMap.WEBSITE || {}).DISAPPROVED ?? 0}
              </div>
              <div className="dashboard-notice-item" style={{ borderLeftColor: 'var(--border)' }}>
                <strong>LinkedIn</strong> — Approved: {(inquiryByTypeMap.LINKEDIN || {}).APPROVED ?? 0} · Pending: {(inquiryByTypeMap.LINKEDIN || {}).PENDING ?? 0} · Disapproved: {(inquiryByTypeMap.LINKEDIN || {}).DISAPPROVED ?? 0}
              </div>
            </div>
            {stats?.usersByRole?.length > 0 && (
              <div>
                <h3 className="dashboard-kvp-label" style={{ marginBottom: '0.5rem' }}>Users by role</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {stats.usersByRole.map(({ role, count }) => (
                    <span key={role} className="dashboard-pill">{ROLE_LABELS[role] || role}: {count}</span>
                  ))}
                </div>
              </div>
            )}
            {stats?.categoriesWithCooldown?.length > 0 && (
              <div className="dashboard-section-grid">
                <h3 className="dashboard-kvp-label" style={{ marginBottom: '0.5rem' }}>Cooldown period</h3>
                {stats.categoriesWithCooldown.map((c) => (
                  <div key={c._id} className="dashboard-country-chip">
                    <span>{c.name}</span>
                    <span>{c.cooldownDays ?? 30} days</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
