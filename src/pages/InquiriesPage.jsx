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
  const [screenshotFiles, setScreenshotFiles] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);

  const isWebsiteInquirer = user?.role === 'WEBSITE_INQUIRER';
  const isLinkedInInquirer = user?.role === 'LINKEDIN_INQUIRER';
  const MAX_IMAGE_SIZE = 500 * 1024;

  // Resubmit
  const [resubmitItem, setResubmitItem] = useState(null);
  const [resubmitLoading, setResubmitLoading] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState(0);
  const [categories, setCategories] = useState([]);
  const [editInquiry, setEditInquiry] = useState(null);
  const [editInquiryStatus, setEditInquiryStatus] = useState('');
  const [editInquiryLoading, setEditInquiryLoading] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isCategoryAdmin = user?.role === 'CATEGORY_ADMIN';
  const canEditInquiry = isSuperAdmin || isCategoryAdmin;
  const isAuditor = ['WEBSITE_INQUIRY_AUDITOR', 'LINKEDIN_INQUIRY_AUDITOR'].includes(user?.role);
  const canCreate = isInquirer(user?.role);

  useEffect(() => {
    if (isSuperAdmin) api.get('/api/categories').then(({ data }) => setCategories(data || [])).catch(() => {});
  }, [isSuperAdmin]);

  const fetchInquiries = useCallback((signal) => {
    setLoading(true);
    const params = { page, limit };
    if (status) params.status = status;
    if (isSuperAdmin && categoryFilter) params.category = categoryFilter;
    if (isSuperAdmin && search.trim()) params.search = search.trim();
    api.get('/api/inquiry', { params, signal })
      .then(({ data }) => setRes({ data: data.data || [], total: data.total ?? 0 }))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [page, limit, status, categoryFilter, searchSubmitted, isSuperAdmin]);

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

  useEffect(() => {
    if (canCreate && showCreate) {
      if (isWebsiteInquirer) setCreateData((d) => ({ ...d, type: 'WEBSITE' }));
      if (isLinkedInInquirer) setCreateData((d) => ({ ...d, type: 'LINKEDIN' }));
    }
  }, [canCreate, showCreate, isWebsiteInquirer, isLinkedInInquirer]);

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

  const handleCreateScreenshotsChange = (e) => {
    const files = Array.from(e.target.files || []);
    setScreenshotFiles(files.filter((f) => f.size <= MAX_IMAGE_SIZE));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!createData.researchId?.trim()) {
      setError('Please select a research record');
      return;
    }
    if (!screenshotFiles.length) {
      setError('At least one screenshot is required');
      return;
    }
    setCreateLoading(true);
    setError('');
    const fd = new FormData();
    fd.append('researchId', createData.researchId);
    fd.append('type', createData.type);
    screenshotFiles.forEach((f) => fd.append('screenshots', f));
    api.post('/api/inquiry', fd)
      .then(() => {
        setShowCreate(false);
        setCreateData({ researchId: '', type: isWebsiteInquirer ? 'WEBSITE' : 'LINKEDIN' });
        setScreenshotFiles([]);
        fetchInquiries();
      })
      .catch((err) => setError(err.response?.data?.message || 'Submission failed'))
      .finally(() => setCreateLoading(false));
  };

  const handleResearchSelect = (researchId) => {
    const r = approvedResearch.find((x) => x._id === researchId);
    const type = r ? (r.type === 'WEBSITE' || r.companyName ? 'WEBSITE' : 'LINKEDIN') : (isWebsiteInquirer ? 'WEBSITE' : 'LINKEDIN');
    setCreateData({ researchId: researchId || '', type });
  };

  const [resubmitScreenshots, setResubmitScreenshots] = useState([]);

  const openResubmit = (item) => {
    setResubmitItem(item);
    setResubmitScreenshots([]);
  };

  const handleResubmitScreenshotsChange = (e) => {
    const files = Array.from(e.target.files || []);
    setResubmitScreenshots(files.filter((f) => f.size <= MAX_IMAGE_SIZE));
  };

  const handleResubmitSubmit = (e) => {
    e.preventDefault();
    if (!resubmitItem || !resubmitScreenshots.length) {
      setError('At least one screenshot is required for resubmission');
      return;
    }
    setResubmitLoading(true);
    setError('');
    const fd = new FormData();
    resubmitScreenshots.forEach((f) => fd.append('screenshots', f));
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
          {isSuperAdmin && (
            <>
              <select className="select-input" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearchSubmitted((s) => s + 1); }} style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="text-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '180px' }} />
                <button type="submit" className="btn btn-secondary">Search</button>
              </form>
            </>
          )}
          <select className="select-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
          {canCreate && (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Inquiry</button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const links = [...new Set(res.data.map((r) => r.research?.companyLink || r.research?.linkedinLink).filter(Boolean))];
                  links.forEach((url) => window.open(url, '_blank'));
                }}
              >
                Open links in bulk
              </button>
            </>
          )}
          {isAuditor && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const links = [...new Set(res.data.map((r) => r.research?.companyLink || r.research?.linkedinLink).filter(Boolean))];
                  links.forEach((url) => window.open(url, '_blank'));
                }}
              >
                Open links in bulk
              </button>
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
                    <th>Ref No</th>
                    <th>Type</th>
                    <th>Company / Person</th>
                    <th>Link</th>
                    <th>Country</th>
                    <th>Inquirer</th>
                    <th>Category</th>
                    <th>Screenshots</th>
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
                      <td><strong>{r.referenceNo || '—'}</strong></td>
                      <td>{r.type === 'WEBSITE' ? 'Website' : 'LinkedIn'}</td>
                      <td>{r.research ? (r.research.companyName || r.research.personName || '—') : '—'}</td>
                      <td>
                        {r.research && (r.research.companyLink || r.research.linkedinLink) ? (
                          <a href={r.research.companyLink || r.research.linkedinLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                            Open
                          </a>
                        ) : '—'}
                      </td>
                      <td>{r.research?.country || '—'}</td>
                      <td>{r.inquirer?.name || '—'}</td>
                      <td>{r.category?.name || '—'}</td>
                      <td>
                        {(() => {
                          const urls = r.screenshots?.length ? r.screenshots : (r.screenshot ? [r.screenshot] : []);
                          if (!urls.length) return '—';
                          return (
                            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {urls.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}>View {urls.length > 1 ? i + 1 : ''}</a>
                              ))}
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        <span className={`badge badge-${r.status === 'APPROVED' ? 'approved' : r.status === 'DISAPPROVED' ? 'disapproved' : 'pending'}`}>{r.status}</span>
                        {r.status === 'DISAPPROVED' && r.disapprovalReason && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }} title={r.disapprovalReason}>{r.disapprovalReason.slice(0, 30)}{r.disapprovalReason.length > 30 ? '…' : ''}</span>
                        )}
                      </td>
                      <td>
                        {canCreate && r.status === 'DISAPPROVED' && isOwn(r) && !r.resubmitted && (
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => openResubmit(r)}>Resubmit</button>
                        )}
                        {canEditInquiry && (
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setEditInquiry(r); setEditInquiryStatus(r.status); }} style={{ marginLeft: '0.25rem' }}>Edit</button>
                        )}
                      </td>
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
            <input className="text-input" value={createData.type === 'WEBSITE' ? 'Website' : 'LinkedIn'} readOnly style={{  opacity: 0.9 }} />
          </div>
          {createData.researchId && (() => {
            const sel = approvedResearch.find((x) => x._id === createData.researchId);
            const link = sel?.companyLink || sel?.linkedinLink;
            return link ? (
              <div>
                <label className="form-label">Target link</label>
                <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                  Open link ↗
                </a>
              </div>
            ) : null;
          })()}
          <div>
            <label className="form-label">Screenshots (required, multiple allowed). Max 500KB per image.</label>
            <input type="file" accept="image/*" multiple onChange={handleCreateScreenshotsChange} />
            {screenshotFiles.length > 0 && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{screenshotFiles.length} image(s) selected</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createLoading || !screenshotFiles.length}>{createLoading ? 'Submitting…' : 'Submit'}</button>
          </div>
        </form>
      </Dialog>

      {/* Resubmit Dialog */}
      <Dialog open={!!editInquiry} onClose={() => setEditInquiry(null)} title="Edit Inquiry" subtitle="Super Admin can update inquiry status.">
        {editInquiry && (
          <form onSubmit={(e) => {
            e.preventDefault();
            setEditInquiryLoading(true);
            api.put(`/api/inquiry/${editInquiry._id}`, { status: editInquiryStatus })
              .then(() => { setEditInquiry(null); fetchInquiries(); })
              .catch((err) => setError(err.response?.data?.message || 'Update failed'))
              .finally(() => setEditInquiryLoading(false));
          }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div><label className="form-label">Status</label><select className="select-input" value={editInquiryStatus} onChange={(e) => setEditInquiryStatus(e.target.value)} style={{ width: '100%' }}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="DISAPPROVED">Disapproved</option></select></div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}><button type="button" className="btn btn-secondary" onClick={() => setEditInquiry(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={editInquiryLoading}>{editInquiryLoading ? 'Updating…' : 'Update'}</button></div>
          </form>
        )}
      </Dialog>

      <Dialog open={!!resubmitItem} onClose={() => setResubmitItem(null)} title="Resubmit Inquiry" subtitle="Upload a new screenshot and resubmit for re-review. You can only resubmit once.">
        {resubmitItem && (
          <form onSubmit={handleResubmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">New Screenshots (required, multiple allowed) *</label>
              <input type="file" accept="image/*" multiple onChange={handleResubmitScreenshotsChange} />
              {resubmitScreenshots.length > 0 && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{resubmitScreenshots.length} image(s) selected</span>}
            </div>
            {resubmitItem.disapprovalReason && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}><strong>Reason:</strong> {resubmitItem.disapprovalReason}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setResubmitItem(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={resubmitLoading || !resubmitScreenshots.length}>{resubmitLoading ? 'Submitting…' : 'Resubmit'}</button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
