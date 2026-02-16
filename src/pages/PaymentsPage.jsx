import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function PaymentsPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const canMarkPaid = user?.role === 'SUPER_ADMIN';
  const canGenerate = ['SUPER_ADMIN', 'CATEGORY_ADMIN'].includes(user?.role);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const fetchPayments = () => {
    setLoading(true);
    const params = {};
    if (isSuperAdmin && categoryFilter) params.category = categoryFilter;
    if (search.trim()) params.search = search.trim();
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
  }, [categoryFilter, search]);

  const handleGenerate = () => {
    setGenerating(true);
    api.post('/api/payments/generate')
      .then(() => fetchPayments())
      .catch((err) => setError(err.response?.data?.message || 'Generate failed'))
      .finally(() => setGenerating(false));
  };

  const handleMarkPaid = (id) => {
    const amount = parseFloat(payAmount);
    if (Number.isNaN(amount) || amount < 0) return;
    setPayingId(id);
    api.put(`/api/payments/${id}/pay`, { paidAmount: amount })
      .then(() => {
        setPayAmount('');
        setPayingId(null);
        fetchPayments();
      })
      .catch((err) => setError(err.response?.data?.message || 'Update failed'))
      .finally(() => setPayingId(null));
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const emptyMsg = canGenerate
    ? 'No payment records. Payments are created automatically when research/inquiry is approved. Use "Generate payments" to backfill for existing approved work.'
    : 'No payment records yet. Payments are created when your approved research or inquiry work is audited.';

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
                    <td>{formatDate(p.createdAt)}</td>
                    <td>{formatDate(p.paymentDate)}</td>
                    {canMarkPaid && (
                      <td>
                        {p.status !== 'PAID' && (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="number"
                              className="text-input"
                              placeholder="Amount"
                              value={payingId === p._id ? payAmount : ''}
                              onChange={(e) => setPayAmount(e.target.value)}
                              onFocus={() => { setPayingId(p._id); setPayAmount(p.totalAmount?.toString() ?? ''); }}
                              style={{ width: '90px' }}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={!payAmount}
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
