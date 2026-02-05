import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Dialog from '../components/Dialog';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DISAPPROVED', label: 'Disapproved' },
];

const isInquirer = (role) => ['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(role);

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

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [approvedResearch, setApprovedResearch] = useState([]);
  const [createData, setCreateData] = useState({ researchId: '', type: 'WEBSITE' });
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Resubmit
  const [resubmitItem, setResubmitItem] = useState(null);
  const [resubmitScreenshot, setResubmitScreenshot] = useState(null);
  const [resubmitLoading, setResubmitLoading] = useState(false);

  const isAuditor = ['WEBSITE_INQUIRY_AUDITOR', 'LINKEDIN_INQUIRY_AUDITOR'].includes(user?.role);
  const canCreate = isInquirer(user?.role);

  const fetchInquiries = useCallback((signal) => {
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
  }, [page, limit, status]);

  useEffect(() => {
    const controller = new AbortController();
    fetchInquiries(controller.signal);
    return () => controller.abort();
  }, [fetchInquiries]);

  useEffect(() => {
    if (canCreate && showCreate) {
      api.get('/api/research', { params: { status: 'APPROVED', limit: 100 } })
        .then(({ data }) => setApprovedResearch(data.data || []))
        .catch(() => setApprovedResearch([]));
    }
  }, [canCreate, showCreate]);

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

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!createData.researchId?.trim()) {
      setError('Please select a research record');
      return;
    }
    if (!screenshotFile) {
      setError('Screenshot is required');
      return;
    }
    setCreateLoading(true);
    setError('');
    const fd = new FormData();
    fd.append('researchId', createData.researchId);
    fd.append('type', createData.type);
    fd.append('screenshot', screenshotFile);
    api.post('/api/inquiry', fd)
      .then(() => {
        setShowCreate(false);
        setCreateData({ researchId: '', type: 'WEBSITE' });
        setScreenshotFile(null);
        fetchInquiries();
      })
      .catch((err) => setError(err.response?.data?.message || 'Submission failed'))
      .finally(() => setCreateLoading(false));
  };

  const handleResearchSelect = (researchId) => {
    const r = approvedResearch.find((x) => x._id === researchId);
    const type = r ? (r.type === 'WEBSITE' || r.companyName ? 'WEBSITE' : 'LINKEDIN') : 'WEBSITE';
    setCreateData({ researchId: researchId || '', type });
  };

  const openResubmit = (item) => {
    setResubmitItem(item);
    setResubmitScreenshot(null);
  };

  const handleResubmitSubmit = (e) => {
    e.preventDefault();
    if (!resubmitItem || !resubmitScreenshot) {
      setError('Screenshot is required for resubmission');
      return;
    }
    setResubmitLoading(true);
    setError('');
    const fd = new FormData();
    fd.append('screenshot', resubmitScreenshot);
    api.put(`/api/inquiry/${resubmitItem._id}/resubmit`, fd)
      .then(() => {
        setResubmitItem(null);
        fetchInquiries();
      })
      .catch((err) => setError(err.response?.data?.message || 'Resubmit failed'))
      .finally(() => setResubmitLoading(false));
  };

  const pendingIds = res.data.filter((r) => r.status === 'PENDING').map((r) => r._id);
  const isOwn = (r) => String(r.inquirer?._id || r.inquirer) === String(user?.id);

  const researchLabel = (r) => r.companyName || r.personName || r.companyLink || r.linkedinLink || r._id;

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
          {canCreate && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Inquiry</button>
          )}
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
                    <th>Target</th>
                    <th>Link</th>
                    <th>Inquirer</th>
                    <th>Screenshot</th>
                    <th>Status</th>
                    {canCreate && <th>Actions</th>}
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
                      <td>{r.research ? (r.research.companyName || r.research.personName || '—') : '—'}</td>
                      <td>
                        {r.research && (r.research.companyLink || r.research.linkedinLink) ? (
                          <a href={r.research.companyLink || r.research.linkedinLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                            Open
                          </a>
                        ) : '—'}
                      </td>
                      <td>{r.inquirer?.name || '—'}</td>
                      <td>
                        {r.screenshot ? (
                          <a href={r.screenshot} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}>View</a>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`badge badge-${r.status === 'APPROVED' ? 'approved' : r.status === 'DISAPPROVED' ? 'disapproved' : 'pending'}`}>{r.status}</span>
                        {r.status === 'DISAPPROVED' && r.disapprovalReason && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }} title={r.disapprovalReason}>{r.disapprovalReason.slice(0, 30)}{r.disapprovalReason.length > 30 ? '…' : ''}</span>
                        )}
                      </td>
                      {canCreate && (
                        <td>
                          {r.status === 'DISAPPROVED' && isOwn(r) && !r.resubmitted && (
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => openResubmit(r)}>Resubmit</button>
                          )}
                        </td>
                      )}
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

      {/* Create Inquiry Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Add Inquiry" subtitle="Submit an inquiry for an approved research record.">
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label">Select Research (Approved) *</label>
            <select
              className="select-input"
              value={createData.researchId}
              onChange={(e) => handleResearchSelect(e.target.value)}
              style={{ width: '100%' }}
              required
            >
              <option value="">— Select —</option>
              {approvedResearch.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.type === 'WEBSITE' || r.companyName ? 'Website' : 'LinkedIn'}: {researchLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Type</label>
            <input className="text-input" value={createData.type === 'WEBSITE' ? 'Website' : 'LinkedIn'} readOnly style={{ background: 'var(--bg-elevated)', opacity: 0.9 }} />
          </div>
          <div>
            <label className="form-label">Screenshot (required) *</label>
            <input type="file" accept="image/*" onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)} required />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createLoading}>{createLoading ? 'Submitting…' : 'Submit'}</button>
          </div>
        </form>
      </Dialog>

      {/* Resubmit Dialog */}
      <Dialog open={!!resubmitItem} onClose={() => setResubmitItem(null)} title="Resubmit Inquiry" subtitle="Upload a new screenshot and resubmit for re-review. You can only resubmit once.">
        {resubmitItem && (
          <form onSubmit={handleResubmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">New Screenshot (required) *</label>
              <input type="file" accept="image/*" onChange={(e) => setResubmitScreenshot(e.target.files?.[0] || null)} required />
            </div>
            {resubmitItem.disapprovalReason && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}><strong>Reason:</strong> {resubmitItem.disapprovalReason}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setResubmitItem(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={resubmitLoading || !resubmitScreenshot}>{resubmitLoading ? 'Submitting…' : 'Resubmit'}</button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
