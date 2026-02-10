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
  const canMarkPaid = user?.role === 'SUPER_ADMIN';
  const canGenerate = ['SUPER_ADMIN', 'CATEGORY_ADMIN'].includes(user?.role);

  const fetchPayments = () => {
    setLoading(true);
    api.get('/api/payments')
      .then(({ data }) => setList(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPayments();
  }, []);

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

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Payments</h1>
        <p className="page-subtitle">
          {canMarkPaid ? 'View and manage payments. Mark records as paid.' : 'View your payment records, pending and approved.'}
        </p>
      </motion.div>

      {error && <div className="dashboard-error">{error}</div>}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Payment Records</h2>
          {canGenerate && (
            <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating…' : 'Generate payments (backfill)'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}><div className="auth-loading-spinner" /></div>
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
