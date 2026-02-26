import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Dialog from '../components/Dialog';
import { COUNTRIES } from '../config/countries';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DISAPPROVED', label: 'Disapproved' },
];

const getResearchTypeLabel = (r) => {
  if (r.type === 'WEBSITE') return 'Website';
  if (r.type === 'LINKEDIN') return 'LinkedIn';
  return r.companyName ? 'Website' : 'LinkedIn';
};

const isInquirer = (role) => ['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(role);

/** Cooldown for same research: next inquiry allowed after createdAt + cooldownDays. Returns { text, canSubmitAgain }. */
function getCooldownRemaining(inquiry) {
  const days = inquiry.category?.cooldownDays ?? 30;
  const end = new Date(inquiry.createdAt);
  end.setDate(end.getDate() + days);
  const now = new Date();
  if (now >= end) return { text: 'Can submit again', canSubmitAgain: true };
  const ms = end - now;
  const d = Math.floor(ms / (24 * 60 * 60 * 1000));
  const h = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (d > 0) return { text: `${d}d ${h}h left`, canSubmitAgain: false };
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return { text: `${h}h ${m}m left`, canSubmitAgain: false };
}

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
  const [disapprovalReasons, setDisapprovalReasons] = useState([]);
  const [reasonSelect, setReasonSelect] = useState('');
  const [reasonCustom, setReasonCustom] = useState('');

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
  const [country, setCountry] = useState('');
  const [editInquiry, setEditInquiry] = useState(null);
  const [editInquiryStatus, setEditInquiryStatus] = useState('');
  const [editInquiryLoading, setEditInquiryLoading] = useState(false);
  const [appealRejectItem, setAppealRejectItem] = useState(null);
  const [appealRejectReason, setAppealRejectReason] = useState('');
  const [reportItem, setReportItem] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitLoading, setReportSubmitLoading] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isCategoryAdmin = user?.role === 'CATEGORY_ADMIN';
  const canEditInquiry = isSuperAdmin || isCategoryAdmin;
  const isAuditor = ['WEBSITE_INQUIRY_AUDITOR', 'LINKEDIN_INQUIRY_AUDITOR'].includes(user?.role);
  const canCreate = isInquirer(user?.role);

  useEffect(() => {
    if (isSuperAdmin) api.get('/api/categories').then(({ data }) => setCategories(data || [])).catch(() => {});
  }, [isSuperAdmin]);

  const [listFilter, setListFilter] = useState('');

  // Inquirer: view "My Inquiries" vs "Assigned to me" (research to inquire)
  const [viewMode, setViewMode] = useState('inquiries');
  const [assignedRes, setAssignedRes] = useState({ data: [], total: 0 });
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [openIds, setOpenIds] = useState(new Set());
  const [uploadingForResearchId, setUploadingForResearchId] = useState(null);
  const [createOpenedFromAssigned, setCreateOpenedFromAssigned] = useState(false);
  // Pending screenshots per research (researchId -> File[]) for Assigned to me flow
  const [pendingScreenshotsByResearch, setPendingScreenshotsByResearch] = useState({});
  // Which row is in "Upload screenshot" dialog: { researchId, type }
  const [uploadScreenshotForResearch, setUploadScreenshotForResearch] = useState(null);
  const [uploadScreenshotFiles, setUploadScreenshotFiles] = useState([]);

  const fetchAssignedResearch = useCallback((signal) => {
    setAssignedLoading(true);
    api.get('/api/research', { params: { page, limit, myAssignments: '1' }, signal })
      .then(({ data }) => setAssignedRes({ data: data.data || [], total: data.total ?? 0 }))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load assigned research');
      })
      .finally(() => setAssignedLoading(false));
  }, [page, limit]);

  const fetchInquiries = useCallback((signal) => {
    setLoading(true);
    const params = { page, limit };
    if (status) params.status = status;
    if (listFilter) params.list = listFilter;
    if (country.trim()) params.country = country.trim();
    if (isSuperAdmin && categoryFilter) params.category = categoryFilter;
    if (isSuperAdmin && search.trim()) params.search = search.trim();
    api.get('/api/inquiry', { params, signal })
      .then(({ data }) => setRes({ data: data.data || [], total: data.total ?? 0 }))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [page, limit, status, listFilter, country, categoryFilter, searchSubmitted, isSuperAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    if (canCreate && viewMode === 'assigned') {
      fetchAssignedResearch(controller.signal);
    } else {
      fetchInquiries(controller.signal);
    }
    return () => controller.abort();
  }, [canCreate, viewMode, fetchInquiries, fetchAssignedResearch]);

  useEffect(() => {
    if (canCreate && showCreate) {
      api.get('/api/research', { params: { status: 'APPROVED', availableForInquiry: '1', limit: 500 } })
        .then(({ data }) => {
          const list = data?.data || [];
          setApprovedResearch(list.filter((r) => r.status === 'APPROVED'));
        })
        .catch(() => setApprovedResearch([]));
    }
  }, [canCreate, showCreate]);

  useEffect(() => {
    if (canCreate && showCreate) {
      if (isWebsiteInquirer) setCreateData((d) => ({ ...d, type: 'WEBSITE' }));
      if (isLinkedInInquirer) setCreateData((d) => ({ ...d, type: 'LINKEDIN' }));
    }
  }, [canCreate, showCreate, isWebsiteInquirer, isLinkedInInquirer]);

  useEffect(() => {
    if (isAuditor) {
      api.get('/api/settings/disapproval-reasons')
        .then(({ data }) => setDisapprovalReasons(Array.isArray(data) ? data : []))
        .catch(() => setDisapprovalReasons([]));
    }
  }, [isAuditor]);

  const getDisapprovalReasonText = () => {
    if (reasonSelect === 'other') return reasonCustom.trim();
    const r = disapprovalReasons.find((x) => x._id === reasonSelect);
    return r?.label?.trim() || reasonCustom.trim() || '';
  };

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
    const reasonText = auditAction === 'DISAPPROVED' ? getDisapprovalReasonText() : '';
    if (!auditAction || (auditAction === 'DISAPPROVED' && !reasonText)) return;
    const ids = [...selected];
    setSelected(new Set());
    setAuditAction(null);
    setReason('');
    setReasonSelect('');
    setReasonCustom('');
    api.post('/api/audit/inquiry', { ids, action: auditAction, reason: reasonText || undefined })
      .then(() => fetchInquiries())
      .catch((err) => setError(err.response?.data?.message || 'Audit failed'));
  };

  const handleCreateScreenshotsChange = (e) => {
    const files = Array.from(e.target.files || []);
    setScreenshotFiles(files.filter((f) => f.size <= MAX_IMAGE_SIZE));
  };

  const trustedInquirer = !!user?.trustedInquirer;

  const handleUploadScreenshotDone = () => {
    if (!uploadScreenshotForResearch || uploadScreenshotFiles.length === 0) return;
    const { researchId } = uploadScreenshotForResearch;
    setPendingScreenshotsByResearch((prev) => ({ ...prev, [researchId]: [...uploadScreenshotFiles] }));
    setUploadScreenshotForResearch(null);
    setUploadScreenshotFiles([]);
  };

  const handleSubmitInquiryForRow = async (r) => {
    const researchId = r._id;
    const type = (r.type === 'WEBSITE' || r.type === 'LINKEDIN')
      ? r.type
      : (r.companyName ? 'WEBSITE' : 'LINKEDIN');
    const files = pendingScreenshotsByResearch[researchId];
    const hasFiles = files && files.length > 0;
    if (!hasFiles && !trustedInquirer) {
      setError('Upload screenshot first, or ask Category Admin to mark you as Trusted Inquirer.');
      return;
    }
    setUploadingForResearchId(researchId);
    setError('');
    const fd = new FormData();
    fd.append('researchId', researchId);
    fd.append('type', type);
    if (hasFiles) files.forEach((f) => fd.append('screenshots', f));
    try {
      await api.post('/api/inquiry', fd);
      setPendingScreenshotsByResearch((prev) => {
        const next = { ...prev };
        delete next[researchId];
        return next;
      });
      fetchAssignedResearch();
      fetchInquiries();
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed');
    } finally {
      setUploadingForResearchId(null);
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!createData.researchId?.trim()) {
      setError('Please select a research record');
      return;
    }
    if (!screenshotFiles.length && !trustedInquirer) {
      setError('At least one screenshot is required (or you must be marked as Trusted Inquirer by Category Admin)');
      return;
    }
    const fromAssigned = createOpenedFromAssigned;
    setCreateLoading(true);
    setError('');
    if (fromAssigned) setUploadingForResearchId(createData.researchId);
    const fd = new FormData();
    fd.append('researchId', createData.researchId);
    fd.append('type', createData.type);
    screenshotFiles.forEach((f) => fd.append('screenshots', f));
    api.post('/api/inquiry', fd)
      .then(() => {
        setShowCreate(false);
        setCreateData({ researchId: '', type: isWebsiteInquirer ? 'WEBSITE' : 'LINKEDIN' });
        setScreenshotFiles([]);
        setCreateOpenedFromAssigned(false);
        if (fromAssigned) fetchAssignedResearch();
        setUploadingForResearchId(null);
        fetchInquiries();
      })
      .catch((err) => setError(err.response?.data?.message || 'Submission failed'))
      .finally(() => {
        setCreateLoading(false);
        setUploadingForResearchId(null);
      });
  };

  const handleResearchSelect = (researchId) => {
    const r = approvedResearch.find((x) => x._id === researchId);
    const type = r
      ? ((r.type === 'WEBSITE' || r.type === 'LINKEDIN')
        ? r.type
        : (r.companyName ? 'WEBSITE' : 'LINKEDIN'))
      : (isWebsiteInquirer ? 'WEBSITE' : 'LINKEDIN');
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
        <p className="page-subtitle">Inquiry records.</p>
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
          <select className="select-input" value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }} style={{ width: '140px' }}>
            <option value="">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="select-input" value={status} onChange={(e) => { setStatus(e.target.value); setListFilter(''); setPage(1); }}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
          {canEditInquiry && (
            <select className="select-input" value={listFilter} onChange={(e) => { setListFilter(e.target.value); setStatus(''); setPage(1); }} style={{ width: '160px' }}>
              <option value="">Lists</option>
              <option value="appealed">Appealed (review)</option>
            </select>
          )}
          {canCreate && (
            <>
              <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <button type="button" className={`btn btn-sm ${viewMode === 'inquiries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setViewMode('inquiries'); setOpenIds(new Set()); }}>My Inquiries</button>
                <button type="button" className={`btn btn-sm ${viewMode === 'assigned' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setViewMode('assigned'); setOpenIds(new Set()); }}>Assigned to me</button>
              </span>
            </>
          )}
          {canCreate && viewMode === 'inquiries' && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenIds((prev) => (prev.size === res.data.length ? new Set() : new Set(res.data.map((r) => r._id))))}>
                {openIds.size === res.data.length && res.data.length > 0 ? 'Deselect all' : 'Select all on page'}
              </button>
              {openIds.size > 0 && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                  const urls = [];
                  res.data.filter((r) => openIds.has(r._id)).forEach((r) => {
                    const main = r.research?.companyLink || r.research?.linkedinLink;
                    if (main) urls.push(main);
                    const shots = r.screenshots?.length ? r.screenshots : (r.screenshot ? [r.screenshot] : []);
                    shots.forEach((s) => urls.push(s));
                  });
                  urls.forEach((url, i) => setTimeout(() => window.open(url, '_blank'), i * 120));
                }}>Open selected in tabs ({openIds.size})</button>
              )}
            </>
          )}
          {canCreate && viewMode === 'assigned' && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenIds((prev) => (prev.size === assignedRes.data.length ? new Set() : new Set(assignedRes.data.map((r) => r._id))))}>
                {openIds.size === assignedRes.data.length && assignedRes.data.length > 0 ? 'Deselect all' : 'Select all on page'}
              </button>
              {openIds.size > 0 && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                  const urls = [];
                  assignedRes.data.filter((r) => openIds.has(r._id)).forEach((r) => {
                    const main = r.companyLink || r.linkedinLink;
                    if (main) urls.push(main);
                    const shots = r.screenshots?.length ? r.screenshots : (r.screenshot ? [r.screenshot] : []);
                    shots.forEach((s) => urls.push(s));
                  });
                  urls.forEach((url, i) => setTimeout(() => window.open(url, '_blank'), i * 120));
                }}>Open selected in tabs ({openIds.size})</button>
              )}
            </>
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        className="select-input"
                        value={reasonSelect}
                        onChange={(e) => setReasonSelect(e.target.value)}
                        style={{ minWidth: '180px' }}
                      >
                        <option value="">Select reason (required)</option>
                        {disapprovalReasons.map((r) => (
                          <option key={r._id} value={r._id}>{r.label}</option>
                        ))}
                        <option value="other">Other</option>
                      </select>
                      {reasonSelect === 'other' && (
                        <input
                          className="text-input"
                          placeholder="Enter reason"
                          value={reasonCustom}
                          onChange={(e) => setReasonCustom(e.target.value)}
                          style={{ width: '200px' }}
                        />
                      )}
                    </div>
                  )}
                  <button type="button" className="btn btn-primary btn-sm" onClick={runAudit} disabled={auditAction === 'DISAPPROVED' && !getDisapprovalReasonText()}>
                    Confirm {auditAction === 'APPROVED' ? 'approve' : 'disapprove'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setAuditAction(null); setReason(''); setReasonSelect(''); setReasonCustom(''); }}>Cancel</button>
                </>
              )}
            </>
          )}
        </div>

        {(viewMode === 'assigned' && canCreate ? assignedLoading : loading) ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}><div className="auth-loading-spinner" /></div>
        ) : canCreate && viewMode === 'assigned' ? (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}><input type="checkbox" checked={assignedRes.data.length > 0 && openIds.size === assignedRes.data.length} onChange={() => setOpenIds((prev) => (prev.size === assignedRes.data.length ? new Set() : new Set(assignedRes.data.map((r) => r._id))))} /></th>
                    <th>Ref No</th>
                    <th>Type</th>
                    <th>Company / Person</th>
                    <th>Link</th>
                    <th>Country</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedRes.data.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <input type="checkbox" checked={openIds.has(r._id)} onChange={() => setOpenIds((prev) => { const next = new Set(prev); if (next.has(r._id)) next.delete(r._id); else next.add(r._id); return next; })} />
                      </td>
                      <td><strong>{r.referenceNo || '—'}</strong></td>
                      <td>{getResearchTypeLabel(r)}</td>
                      <td>{r.companyName || r.personName || '—'}</td>
                      <td>
                        {(r.companyLink || r.linkedinLink) ? (
                          <a href={r.companyLink || r.linkedinLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Open</a>
                        ) : '—'}
                      </td>
                      <td>{r.country || '—'}</td>
                      <td>
                        {uploadingForResearchId === r._id ? (
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Submitting…</span>
                        ) : (
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setUploadScreenshotForResearch({ researchId: r._id, type: r.type === 'WEBSITE' || r.companyName ? 'WEBSITE' : 'LINKEDIN' });
                                setUploadScreenshotFiles([]);
                              }}
                            >
                              Upload screenshot
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => handleSubmitInquiryForRow(r)}
                              disabled={!pendingScreenshotsByResearch[r._id]?.length && !trustedInquirer}
                              title={!pendingScreenshotsByResearch[r._id]?.length && !trustedInquirer ? 'Upload screenshot first or be marked as Trusted Inquirer' : ''}
                            >
                              Submit inquiry
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => { setReportItem(r); setReportReason(''); }}
                            >
                              Report
                            </button>
                            {pendingScreenshotsByResearch[r._id]?.length > 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pendingScreenshotsByResearch[r._id].length} image(s) ready</span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination-wrap">
              <span className="pagination-info">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, assignedRes.total)} of {assignedRes.total}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select className="select-input" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span style={{ fontSize: '0.875rem' }}>Page {page}</span>
                <button type="button" className="btn btn-sm btn-secondary" disabled={page * limit >= assignedRes.total} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {isAuditor && <th style={{ width: '40px' }}><input type="checkbox" checked={pendingIds.length > 0 && selected.size === pendingIds.length} onChange={selectAll} /></th>}
                    {canCreate && <th style={{ width: '40px' }}>Open</th>}
                    <th>Ref No</th>
                    <th>Type</th>
                    <th>Company / Person</th>
                    <th>Link</th>
                    <th>Country</th>
                    <th>Inquirer</th>
                    <th>Category</th>
                    <th>Screenshots</th>
                    <th>Status</th>
                    {canCreate && <th>Cooldown (resubmit)</th>}
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
                      {canCreate && (
                        <td>
                          <input type="checkbox" checked={openIds.has(r._id)} onChange={() => setOpenIds((prev) => { const next = new Set(prev); if (next.has(r._id)) next.delete(r._id); else next.add(r._id); return next; })} />
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
                      {canCreate && (
                        <td style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                          {(() => {
                            const { text, canSubmitAgain } = getCooldownRemaining(r);
                            return canSubmitAgain ? <span style={{ color: 'var(--success)' }}>{text}</span> : <span style={{ color: 'var(--text-muted)' }}>{text}</span>;
                          })()}
                        </td>
                      )}
                      <td>
                        {canCreate && r.status === 'DISAPPROVED' && isOwn(r) && !r.resubmitted && !r.appealed && (
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => openResubmit(r)}>Resubmit</button>
                        )}
                        {canCreate && r.status === 'DISAPPROVED' && isOwn(r) && !r.appealed && (
                          <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: '0.25rem' }} onClick={async () => {
                            try {
                              await api.post(`/api/inquiry/${r._id}/appeal`);
                              fetchInquiries();
                            } catch (err) { setError(err.response?.data?.message || 'Appeal failed'); }
                          }}>Appeal</button>
                        )}
                        {canEditInquiry && listFilter === 'appealed' && r.appealed && !r.appealDecidedBy && (
                          <span style={{ display: 'flex', gap: '0.25rem' }}>
                            <button type="button" className="btn btn-sm btn-primary" onClick={async () => {
                              try {
                                await api.put(`/api/inquiry/${r._id}/appeal-decision`, { decision: 'APPROVED' });
                                setAppealRejectItem(null);
                                fetchInquiries();
                              } catch (err) { setError(err.response?.data?.message || 'Failed'); }
                            }}>Approve</button>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setAppealRejectItem(r)}>Reject</button>
                          </span>
                        )}
                        {canEditInquiry && !listFilter && (
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

      {/* Upload screenshot only (for Assigned to me row) */}
      <Dialog open={!!uploadScreenshotForResearch} onClose={() => { setUploadScreenshotForResearch(null); setUploadScreenshotFiles([]); }} title="Upload screenshot" subtitle="Select image(s) for this research. Click Done to save. Then use Submit inquiry on the row. Trusted Inquirers can submit without screenshots.">
        {uploadScreenshotForResearch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Screenshots (multiple allowed). Max 500KB per image.</label>
              <input type="file" accept="image/*" multiple onChange={(e) => setUploadScreenshotFiles(Array.from(e.target.files || []).filter((f) => f.size <= MAX_IMAGE_SIZE))} />
              {uploadScreenshotFiles.length > 0 && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{uploadScreenshotFiles.length} image(s) selected</span>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setUploadScreenshotForResearch(null); setUploadScreenshotFiles([]); }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleUploadScreenshotDone} disabled={uploadScreenshotFiles.length === 0}>Done</button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Inquirer Report Dialog (Assigned to me) */}
      <Dialog
        open={!!reportItem}
        onClose={() => { if (!reportSubmitLoading) { setReportItem(null); setReportReason(''); } }}
        title="Report problem"
        subtitle="Report this target (no online form, inaccessible website, invalid link)."
      >
        {reportItem && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setReportSubmitLoading(true);
              try {
                await api.post(`/api/research/${reportItem._id}/report`, {
                  reason: reportReason.trim() || 'Reported by inquirer',
                });
                setReportItem(null);
                setReportReason('');
                fetchAssignedResearch();
              } catch (err) {
                setError(err.response?.data?.message || 'Report failed');
              } finally {
                setReportSubmitLoading(false);
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div>
              <label className="form-label">Reason (optional)</label>
              <textarea
                className="text-input"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={2}
                placeholder="e.g. No online form, website inaccessible"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { if (!reportSubmitLoading) { setReportItem(null); setReportReason(''); } }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={reportSubmitLoading}>
                {reportSubmitLoading ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Create Inquiry Dialog */}
      <Dialog open={showCreate} onClose={() => { setShowCreate(false); setCreateOpenedFromAssigned(false); }} title="Add Inquiry" subtitle={createOpenedFromAssigned ? 'Upload screenshot(s) and submit. The list will update without refreshing the page.' : 'Submit an inquiry for research approved by the auditor that no inquirer has submitted yet. Only such research is listed.'}>
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label">Select Research (approved, assigned to you) *</label>
            <select
              className="select-input"
              value={createData.researchId}
              onChange={(e) => handleResearchSelect(e.target.value)}
              style={{ width: '100%' }}
              required
              disabled={createOpenedFromAssigned}
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
            <label className="form-label">Screenshots {trustedInquirer ? '(optional for Trusted Inquirers)' : '(required)'}, multiple allowed. Max 500KB per image.</label>
            <input type="file" accept="image/*" multiple onChange={handleCreateScreenshotsChange} />
            {screenshotFiles.length > 0 && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{screenshotFiles.length} image(s) selected</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createLoading || (!screenshotFiles.length && !trustedInquirer)}>{createLoading ? 'Submitting…' : 'Submit inquiry'}</button>
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

      {/* Appeal Reject Dialog */}
      <Dialog open={!!appealRejectItem} onClose={() => { setAppealRejectItem(null); setAppealRejectReason(''); }} title="Reject Appeal" subtitle="Enter rejection reason. Will be sent via internal message.">
        {appealRejectItem && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const reason = appealRejectReason?.trim() || '';
            if (!reason) return;
            try {
              await api.put(`/api/inquiry/${appealRejectItem._id}/appeal-decision`, { decision: 'DISAPPROVED', rejectionReason: reason });
              setAppealRejectItem(null);
              setAppealRejectReason('');
              fetchInquiries();
            } catch (err) { setError(err.response?.data?.message || 'Failed'); }
          }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Rejection reason *</label>
              <textarea className="text-input" value={appealRejectReason} onChange={(e) => setAppealRejectReason(e.target.value)} rows={3} placeholder="Why does this not meet criteria?" required style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setAppealRejectItem(null); setAppealRejectReason(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!appealRejectReason.trim()}>Reject appeal</button>
            </div>
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
