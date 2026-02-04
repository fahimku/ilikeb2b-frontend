import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DISAPPROVED', label: 'Disapproved' },
];

export default function InquiriesPage() {
  const { user } = useAuth();
  const [res, setRes] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [auditAction, setAuditAction] = useState(null);
  const [reason, setReason] = useState('');

  const isAuditor = ['WEBSITE_INQUIRY_AUDITOR', 'LINKEDIN_INQUIRY_AUDITOR'].includes(user?.role);

  const fetchInquiries = (signal) => {
    setLoading(true);
    const params = { page, limit };
    if (status) params.status = status;
    api.get('/api/inquiry', { params, signal })
      .then(({ data }) => setRes({ data: data.data || [], total: data.total ?? 0 }))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchInquiries(controller.signal);
    return () => controller.abort();
  }, [page, limit, status]);

  const toggleSelect = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const pending = res.data.filter((r) => r.status === 'PENDING');
    if (selected.size === pending.length) setSelected(new Set());
    else setSelected(new Set(pending.map((r) => r._id)));
  };

  const runAudit = () => {
    if (!auditAction || (auditAction === 'DISAPPROVED' && !reason.trim())) return;
    const ids = [...selected];
    setSelected(new Set());
    setAuditAction(null);
    setReason('');
    api.post('/api/audit/inquiry', { ids, action: auditAction, reason: reason.trim() || undefined })
      .then(() => fetchInquiries())
      .catch((err) => setError(err.response?.data?.message || 'Audit failed'));
  };

  const pendingIds = res.data.filter((r) => r.status === 'PENDING').map((r) => r._id);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Inquiries</h1>
        <p className="page-subtitle">Website & LinkedIn inquiry records.</p>
      </motion.div>

      {error && <div className="dashboard-error">{error}</div>}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
          <select className="select-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
          {isAuditor && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={selectAll}>
                {selected.size === pendingIds.length ? 'Deselect all' : 'Select all pending'}
              </button>
              {selected.size > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{selected.size} selected</span>
              )}
              {selected.size > 0 && !auditAction && (
                <>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setAuditAction('APPROVED')}>Approve selected</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAuditAction('DISAPPROVED')}>Disapprove selected</button>
                </>
              )}
              {auditAction && (
                <>
                  {auditAction === 'DISAPPROVED' && (
                    <input
                      className="text-input"
                      placeholder="Disapproval reason (required)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      style={{ width: '220px' }}
                    />
                  )}
                  <button type="button" className="btn btn-primary btn-sm" onClick={runAudit} disabled={auditAction === 'DISAPPROVED' && !reason.trim()}>
                    Confirm {auditAction === 'APPROVED' ? 'approve' : 'disapprove'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setAuditAction(null); setReason(''); }}>Cancel</button>
                </>
              )}
            </>
          )}
        </div>

        {loading ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}><div className="auth-loading-spinner" /></div>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {isAuditor && <th style={{ width: '40px' }}><input type="checkbox" checked={pendingIds.length > 0 && selected.size === pendingIds.length} onChange={selectAll} /></th>}
                    <th>Type</th>
                    <th>Research link</th>
                    <th>Inquirer</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {res.data.map((r) => (
                    <tr key={r._id}>
                      {isAuditor && (
                        <td>
                          {r.status === 'PENDING' && (
                            <input type="checkbox" checked={selected.has(r._id)} onChange={() => toggleSelect(r._id)} />
                          )}
                        </td>
                      )}
                      <td>{r.type === 'WEBSITE' ? 'Website' : 'LinkedIn'}</td>
                      <td>
                        {r.research && (
                          <a href={r.research.companyLink || r.research.linkedinLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                            Open
                          </a>
                        )}
                      </td>
                      <td>{r.inquirer?.name || '—'}</td>
                      <td><span className={`badge badge-${r.status === 'APPROVED' ? 'approved' : r.status === 'DISAPPROVED' ? 'disapproved' : 'pending'}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination-wrap">
              <span className="pagination-info">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, res.total)} of {res.total}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select className="select-input" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span style={{ fontSize: '0.875rem' }}>Page {page}</span>
                <button type="button" className="btn btn-sm btn-secondary" disabled={page * limit >= res.total} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}
