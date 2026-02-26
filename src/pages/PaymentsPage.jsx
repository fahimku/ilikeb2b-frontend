import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../config/sidebarNav';

const PAYMENT_CHANNELS = [
  { value: '', label: 'Select channel' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'STRIPE', label: 'Stripe' },
  { value: 'WISE', label: 'Wise' },
  { value: 'OTHER', label: 'Other' },
];

export default function PaymentsPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [payAmount, setPayAmount] = useState(''); // kept for compatibility but not editable by Super Admin
  const [payChannel, setPayChannel] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [workStatusFilter, setWorkStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const canMarkPaid = user?.role === 'SUPER_ADMIN';
  const canGenerate = user?.role === 'CATEGORY_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const fetchPayments = () => {
    setLoading(true);
    const params = {};
    if (isSuperAdmin && categoryFilter) params.category = categoryFilter;
    if (search.trim()) params.search = search.trim();
    if (roleFilter) params.role = roleFilter;
    if (statusFilter) params.status = statusFilter;
    if (workStatusFilter) params.workStatus = workStatusFilter;
    if (channelFilter) params.channel = channelFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    api.get('/api/payments', { params })
      .then(({ data }) => setList(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/api/categories').then(({ data }) => setCategories(data || [])).catch(() => {});
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchPayments();
  }, [categoryFilter, search, roleFilter, statusFilter, workStatusFilter, channelFilter, dateFrom, dateTo]);

  const handleGenerate = () => {
    setGenerating(true);
    api.post('/api/payments/generate')
      .then(() => fetchPayments())
      .catch((err) => setError(err.response?.data?.message || 'Generate failed'))
      .finally(() => setGenerating(false));
  };

  const handleMarkPaid = (id) => {
    if (!payChannel) {
      setError('Select payment channel before marking as paid.');
      return;
    }
    const payment = list.find((p) => p._id === id);
    if (!payment) return;
    const amount = payment.totalAmount ?? 0;
    if (Number.isNaN(amount) || amount < 0) return;
    setPayingId(id);
    const body = { paidAmount: amount };
    if (payChannel) body.paymentChannel = payChannel;
    api.put(`/api/payments/${id}/pay`, body)
      .then(() => {
        setPayAmount('');
        setPayChannel('');
        setPayingId(null);
        fetchPayments();
      })
      .catch((err) => setError(err.response?.data?.message || 'Update failed'))
      .finally(() => setPayingId(null));
  };

  const channelLabel = (v) => PAYMENT_CHANNELS.find((c) => c.value === v)?.label || v || '—';

  const chartByStatus = list.length > 0
    ? [
        { name: 'Paid', count: list.filter((p) => (p.status || '').toUpperCase() === 'PAID').length },
        { name: 'Unpaid', count: list.filter((p) => (p.status || '').toUpperCase() === 'UNPAID').length },
        { name: 'Partial', count: list.filter((p) => (p.status || '').toUpperCase() === 'PARTIAL').length },
      ]
    : [];
  const chartByRole = list.length > 0
    ? Object.entries(
        list.reduce((acc, p) => {
          const r = p.role || 'Other';
          acc[r] = (acc[r] || 0) + 1;
          return acc;
        }, {})
      ).map(([role, count]) => ({ name: ROLE_LABELS[role] || role, count }))
    : [];

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const emptyMsg = canGenerate
    ? 'No payment records. Payments are created automatically when research/inquiry is approved. Use "Generate payments" to backfill for existing approved work.'
    : 'No payment records yet. Payments are created when your approved research or inquiry work is audited.';
  const isCategoryAdmin = user?.role === 'CATEGORY_ADMIN';
  const showFilters = isSuperAdmin || isCategoryAdmin;

  // My Payments summary (for non-admin users who see their own payments)
  const showMyPaymentsSummary = !canMarkPaid && !canGenerate;
  const paymentSummary = showMyPaymentsSummary && list.length > 0
    ? list.reduce(
        (acc, p) => {
          const amt = p.totalAmount ?? 0;
          const paidAmt = p.paidAmount ?? 0;
          acc.total += amt;
          acc.paid += paidAmt;
          if (p.workStatus === 'PENDING') {
            acc.pendingWorkCount++;
            acc.pendingWorkAmount += amt;
          } else {
            acc.approvedWorkCount++;
            acc.approvedWorkAmount += amt;
          }
          return acc;
        },
        { total: 0, paid: 0, pendingWorkCount: 0, approvedWorkCount: 0, pendingWorkAmount: 0, approvedWorkAmount: 0 }
      )
    : null;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Payments</h1>
        <p className="page-subtitle">
          {canMarkPaid ? 'View and manage payments. Mark records as paid.' : 'View your payment records, pending and approved.'}
        </p>
      </motion.div>

      {error && <div className="dashboard-error">{error}</div>}

      {showMyPaymentsSummary && paymentSummary && !loading && (
        <motion.div
          className="content-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '1rem' }}
        >
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>My Payments</h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Pending audit: {paymentSummary.pendingWorkCount} (${(paymentSummary.pendingWorkAmount ?? 0).toFixed(2)}) · Approved: {paymentSummary.approvedWorkCount} (${(paymentSummary.approvedWorkAmount ?? 0).toFixed(2)}) · Paid: ${(paymentSummary.paid ?? 0).toFixed(2)}
          </p>
        </motion.div>
      )}

      {list.length > 0 && !loading && (chartByStatus.some((d) => d.count > 0) || chartByRole.length > 0) && (
        <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: 'var(--text-muted)' }}>Payment overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', minHeight: '200px' }}>
            {chartByStatus.some((d) => d.count > 0) && (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartByStatus} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartByRole.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartByRole} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--text-muted)" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="var(--text-muted)" width={100} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} />
                  <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>
      )}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Payment Records</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="text-input"
              placeholder="Search..."
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
            {canGenerate && (
              <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating…' : 'Generate payments (backfill)'}
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filters:</span>
            <select className="select-input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ minWidth: '140px' }}>
              <option value="">All roles</option>
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <option key={role} value={role}>{label}</option>
              ))}
            </select>
            <select className="select-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: '110px' }}>
              <option value="">All status</option>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
            </select>
            <select className="select-input" value={workStatusFilter} onChange={(e) => setWorkStatusFilter(e.target.value)} style={{ minWidth: '120px' }}>
              <option value="">Work status</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
            </select>
            <select className="select-input" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} style={{ minWidth: '130px' }}>
              <option value="">All channels</option>
              {PAYMENT_CHANNELS.filter((c) => c.value).map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input type="date" className="text-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '140px' }} placeholder="From" />
            <input type="date" className="text-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '140px' }} placeholder="To" />
          </div>
        )}

        {loading ? (
          <div className="dashboard-loading" style={{ minHeight: '120px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <div className="auth-loading-spinner" />
            <span>Loading payments...</span>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref No</th>
                  {canMarkPaid && <th>User</th>}
                  <th>Role</th>
                  <th>Type</th>
                  <th>Company / Person</th>
                  <th>Work status</th>
                  <th>Unit price</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Channel</th>
                  <th>Record date</th>
                  <th>Paid date</th>
                  {canMarkPaid && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p._id}>
                    <td><strong>{p.referenceNo || '—'}</strong></td>
                    {canMarkPaid && <td>{p.user?.name || '—'}</td>}
                    <td>{p.role || '—'}</td>
                    <td>{p.beneficiaryType || '—'}</td>
                    <td>
                      {p.sourceDetails
                        ? (p.sourceDetails.companyName || p.sourceDetails.personName || '—')
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${(p.workStatus || 'pending').toLowerCase()}`}>
                        {p.workStatus === 'APPROVED' ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td>${(p.unitPrice ?? 0).toFixed(2)}</td>
                    <td>{p.quantity ?? p.approvedCount ?? 1}</td>
                    <td>${(p.totalAmount ?? 0).toFixed(2)}</td>
                    <td><span className={`badge badge-${(p.status || 'unpaid').toLowerCase()}`}>{p.status || 'UNPAID'}</span></td>
                    <td><span style={{ fontSize: '0.85rem' }}>{channelLabel(p.paymentChannel)}</span></td>
                    <td>{formatDate(p.createdAt)}</td>
                    <td>{formatDate(p.paymentDate)}</td>
                    {canMarkPaid && (
                      <td>
                        {p.status !== 'PAID' && (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="number"
                              className="text-input"
                              value={(p.totalAmount ?? 0).toFixed(2)}
                              readOnly
                              style={{ width: '80px', opacity: 0.9, cursor: 'not-allowed' }}
                            />
                            <select
                              className="select-input"
                              value={payingId === p._id ? payChannel : ''}
                              onChange={(e) => { setPayingId(p._id); setPayChannel(e.target.value); }}
                              style={{ width: '120px' }}
                            >
                              {PAYMENT_CHANNELS.map((c) => (
                                <option key={c.value || 'any'} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={payingId !== p._id || !payChannel}
                              onClick={() => handleMarkPaid(p._id)}
                            >
                              {payingId === p._id && payingId ? 'Pay' : 'Mark paid'}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>{emptyMsg}</p>}
          </div>
        )}
      </motion.div>
    </>
  );
}
