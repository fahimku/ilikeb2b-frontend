import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Dialog from '../components/Dialog';

export default function ResearchAppealsPage() {
  const { user } = useAuth();
  const [res, setRes] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState(0);
  const [rejectItem, setRejectItem] = useState(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  const isAdminReviewer = ['SUPER_ADMIN', 'CATEGORY_ADMIN'].includes(user?.role);

  useEffect(() => {
    if (!isAdminReviewer) return;
    const controller = new AbortController();
    setLoading(true);
    const params = { list: 'appealed', page, limit };
    if (search.trim()) params.search = search.trim();
    api.get('/api/research', { params, signal: controller.signal })
      .then(({ data }) => setRes({ data: data.data || [], total: data.total ?? 0 }))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load appeals');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [isAdminReviewer, page, limit, searchSubmitted]);

  const handleApprove = async (item) => {
    try {
      setError('');
      await api.put(`/api/research/${item._id}/appeal-decision`, { decision: 'APPROVED' });
      setRes((prev) => ({
        ...prev,
        data: prev.data.filter((r) => r._id !== item._id),
        total: Math.max(0, (prev.total || 0) - 1),
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve appeal');
    }
  };

  if (!isAdminReviewer) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Appeal Review</h1>
        <p className="page-subtitle">
          Review appealed research records. Approve if rejection was incorrect, or reject with a written reason.
        </p>
      </motion.div>

      {error && <div className="dashboard-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Appealed research</h2>
          <form
            onSubmit={(e) => { e.preventDefault(); setPage(1); setSearchSubmitted((s) => s + 1); }}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <input
              className="text-input"
              placeholder="Search company / person / link"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '220px' }}
            />
            <button type="submit" className="btn btn-secondary btn-sm">Search</button>
          </form>
        </div>

        {loading ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}>
            <div className="auth-loading-spinner" />
          </div>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ref No</th>
                    <th>Type</th>
                    <th>Company / Person</th>
                    <th>Country</th>
                    <th>Researcher</th>
                    <th>Status</th>
                    <th>Disapproval reason</th>
                    <th>Appealed at</th>
                    <th style={{ width: '160px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {res.data.map((r) => (
                    <tr key={r._id}>
                      <td><strong>{r.referenceNo || '—'}</strong></td>
                      <td>{r.type === 'WEBSITE' ? 'Website' : 'LinkedIn'}</td>
                      <td>{r.companyName || r.personName || '—'}</td>
                      <td>{r.country || '—'}</td>
                      <td>{r.researcher?.name || '—'}</td>
                      <td><span className={`badge badge-${r.status === 'DISAPPROVED' ? 'disapproved' : r.status === 'APPROVED' ? 'approved' : 'pending'}`}>{r.status}</span></td>
                      <td>
                        {r.disapprovalReason
                          ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.disapprovalReason}</span>
                          : '—'}
                      </td>
                      <td>{r.appealedAt ? new Date(r.appealedAt).toLocaleString() : '—'}</td>
                      <td>
                        <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleApprove(r)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => setRejectItem(r)}
                          >
                            Reject
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {res.data.length === 0 && (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No appeals pending review.
              </p>
            )}
            {res.total > 0 && (
              <div className="pagination-wrap" style={{ marginTop: '1rem' }}>
                <span className="pagination-info">
                  Showing {(page - 1) * limit + 1}–{Math.min(page * limit, res.total)} of {res.total}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    className="select-input"
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: '0.875rem' }}>Page {page}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={page * limit >= res.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Reject Appeal Dialog */}
      <Dialog
        open={!!rejectItem}
        onClose={() => { if (!rejectLoading) setRejectItem(null); }}
        title="Reject Appeal"
        subtitle="Enter rejection reason. This will be sent to the researcher via internal message."
      >
        {rejectItem && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const reason = e.target.rejectionReason?.value?.trim() || '';
              if (!reason) return;
              setRejectLoading(true);
              try {
                await api.put(`/api/research/${rejectItem._id}/appeal-decision`, {
                  decision: 'DISAPPROVED',
                  rejectionReason: reason,
                });
                setRejectItem(null);
                setRes((prev) => ({
                  ...prev,
                  data: prev.data.filter((r) => r._id !== rejectItem._id),
                  total: Math.max(0, (prev.total || 0) - 1),
                }));
              } catch (err) {
                setError(err.response?.data?.message || 'Failed to reject appeal');
              } finally {
                setRejectLoading(false);
              }
            }}
            className="research-dialog-form"
          >
            <div>
              <label className="form-label">Rejection reason *</label>
              <textarea
                className="text-input"
                name="rejectionReason"
                rows={3}
                placeholder="Why does this not meet targeting criteria?"
                required
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { if (!rejectLoading) setRejectItem(null); }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={rejectLoading}>
                {rejectLoading ? 'Rejecting…' : 'Reject appeal'}
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

