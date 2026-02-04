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

  const fetchPayments = () => {
    api.get('/api/payments')
      .then(({ data }) => setList(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.get('/api/payments', { signal: controller.signal })
      .then(({ data }) => setList(data))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
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

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Payments</h1>
        <p className="page-subtitle">View and manage payments (Super Admin can mark as paid).</p>
      </motion.div>

      {error && <div className="dashboard-error">{error}</div>}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Payment records</h2>
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate payments'}
          </button>
        </div>

        {loading ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}><div className="auth-loading-spinner" /></div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Unit price</th>
                  <th>Approved count</th>
                  <th>Total</th>
                  <th>Status</th>
                  {canMarkPaid && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p._id}>
                    <td>{p.user?.name || '—'}</td>
                    <td>{p.role}</td>
                    <td>${p.unitPrice?.toFixed(2)}</td>
                    <td>{p.approvedCount}</td>
                    <td>${p.totalAmount?.toFixed(2)}</td>
                    <td><span className={`badge badge-${p.status?.toLowerCase()}`}>{p.status}</span></td>
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
            {list.length === 0 && <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>No payment records. Use &quot;Generate payments&quot; to create from approved work.</p>}
          </div>
        )}
      </motion.div>
    </>
  );
}
