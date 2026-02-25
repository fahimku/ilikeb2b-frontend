import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
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
const LIST_OPTIONS = [
  { value: '', label: 'Status filter' },
  { value: 'appealed', label: 'Appealed (review)' },
  { value: 'reported', label: 'Reported (review)' },
];

const getResearchTypeLabel = (r) => {
  if (r.type === 'WEBSITE') return 'Website';
  if (r.type === 'LINKEDIN') return 'LinkedIn';
  return r.companyName ? 'Website' : 'LinkedIn';
};

const isResearcher = (role) => ['WEBSITE_RESEARCHER', 'LINKEDIN_RESEARCHER'].includes(role);
const MAX_IMAGE_SIZE = 500 * 1024; // 500KB per image

export default function ResearchPage() {
  const { user } = useAuth();
  const [res, setRes] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [auditAction, setAuditAction] = useState(null);
  const [reason, setReason] = useState('');
  const [disapprovalReasons, setDisapprovalReasons] = useState([]);
  const [reasonSelect, setReasonSelect] = useState('');
  const [reasonCustom, setReasonCustom] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState(0);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState('WEBSITE');
  const [createData, setCreateData] = useState({
    companyName: '',
    companyLink: '',
    personName: '',
    linkedinLink: '',
    country: ''
  });
  const [screenshotFiles, setScreenshotFiles] = useState([]);
  const [screenshotError, setScreenshotError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState({ duplicate: false, existing: null });

  // Resubmit
  const [resubmitItem, setResubmitItem] = useState(null);
  const [resubmitData, setResubmitData] = useState({});
  const [resubmitScreenshots, setResubmitScreenshots] = useState([]);
  const [resubmitScreenshotError, setResubmitScreenshotError] = useState('');
  const [resubmitLoading, setResubmitLoading] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [editResearch, setEditResearch] = useState(null);
  const [editResearchData, setEditResearchData] = useState({});
  const [editResearchLoading, setEditResearchLoading] = useState(false);
  const [listFilter, setListFilter] = useState('');
  const [assignIds, setAssignIds] = useState(new Set());
  const [assignInquirer, setAssignInquirer] = useState('');
  const [inquirers, setInquirers] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [appealItem, setAppealItem] = useState(null);
  const [appealLoading, setAppealLoading] = useState(false);
  const [reportReviewItem, setReportReviewItem] = useState(null);
  const [reportAction, setReportAction] = useState('');
  const [reportClarification, setReportClarification] = useState('');
  const [reportReviewLoading, setReportReviewLoading] = useState(false);
  const [reportItem, setReportItem] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitLoading, setReportSubmitLoading] = useState(false);
  const [openIds, setOpenIds] = useState(new Set());

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isCategoryAdmin = user?.role === 'CATEGORY_ADMIN';
  const canEditResearch = isSuperAdmin || isCategoryAdmin;
  const isAuditor = ['WEBSITE_RESEARCH_AUDITOR', 'LINKEDIN_RESEARCH_AUDITOR'].includes(user?.role);
  const canCreate = isResearcher(user?.role);
  const isInquirer = ['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(user?.role);
  const isWebsiteResearcher = user?.role === 'WEBSITE_RESEARCHER';
  const isLinkedInResearcher = user?.role === 'LINKEDIN_RESEARCHER';

  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/api/categories').then(({ data }) => setCategories(data || [])).catch(() => {});
    }
  }, [isSuperAdmin]);

  const fetchResearch = useCallback((signal) => {
    setLoading(true);
    const params = { page, limit };
    if (isInquirer) {
      params.myAssignments = '1';
    } else {
      if (status) params.status = status;
      if (listFilter) params.list = listFilter;
    }
    if (country.trim()) params.country = country.trim();
    if (search.trim()) params.search = search.trim();
    if (isSuperAdmin && categoryFilter) params.category = categoryFilter;
    api.get('/api/research', { params, signal })
      .then(({ data }) => setRes({ data: data.data || [], total: data.total ?? 0 }))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [page, limit, status, listFilter, country, categoryFilter, searchSubmitted, isSuperAdmin, isInquirer]);

  useEffect(() => {
    if (canEditResearch) {
      api.get('/api/users')
        .then(({ data }) => {
          const list = Array.isArray(data) ? data : data?.data || [];
          setInquirers(list.filter((u) => ['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(u.role)));
        })
        .catch(() => setInquirers([]));
    }
  }, [canEditResearch]);

  useEffect(() => {
    if (isAuditor) {
      api.get('/api/settings/disapproval-reasons')
        .then(({ data }) => setDisapprovalReasons(Array.isArray(data) ? data : []))
        .catch(() => setDisapprovalReasons([]));
    }
  }, [isAuditor]);

  useEffect(() => {
    const controller = new AbortController();
    fetchResearch(controller.signal);
    return () => controller.abort();
  }, [fetchResearch]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchSubmitted((s) => s + 1);
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

  const getDisapprovalReasonText = () => {
    if (reasonSelect === 'other') return reasonCustom.trim();
    const r = disapprovalReasons.find((x) => x._id === reasonSelect);
    return r?.label?.trim() || reasonCustom.trim() || '';
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
    api.post('/api/audit/research', { ids, action: auditAction, reason: reasonText || undefined })
      .then(() => fetchResearch())
      .catch((err) => setError(err.response?.data?.message || 'Audit failed'));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const { companyName, companyLink, personName, linkedinLink, country: c } = createData;
    if (!c?.trim()) {
      setError('Country is required');
      return;
    }
    if (createType === 'WEBSITE') {
      if (!companyName?.trim() || !companyLink?.trim()) {
        setError('Company name and link are required');
        return;
      }
    } else {
      if (!personName?.trim() || !linkedinLink?.trim()) {
        setError('Person name and LinkedIn link are required');
        return;
      }
    }
    setCreateLoading(true);
    setError('');
    setScreenshotError('');
    const fd = new FormData();
    fd.append('type', createType);
    fd.append('country', c.trim());
    if (createType === 'WEBSITE') {
      fd.append('companyName', companyName.trim());
      fd.append('companyLink', companyLink.trim());
    } else {
      fd.append('personName', personName.trim());
      fd.append('linkedinLink', linkedinLink.trim());
    }
    screenshotFiles.forEach((file) => fd.append('screenshots', file));
    api.post('/api/research', fd)
      .then(() => {
        setShowCreate(false);
        setCreateData({ companyName: '', companyLink: '', personName: '', linkedinLink: '', country: '' });
        setScreenshotFiles([]);
        setScreenshotError('');
        fetchResearch();
      })
      .catch((err) => setError(err.response?.data?.message || 'Submission failed'))
      .finally(() => setCreateLoading(false));
  };

  useEffect(() => {
    if (canCreate && showCreate) {
      if (isWebsiteResearcher) setCreateType('WEBSITE');
      if (isLinkedInResearcher) setCreateType('LINKEDIN');
    } else if (!showCreate) {
      setDuplicateCheck({ duplicate: false, existing: null });
    }
  }, [canCreate, showCreate, isWebsiteResearcher, isLinkedInResearcher]);

  // Real-time duplicate detection during data entry
  useEffect(() => {
    if (!canCreate || !showCreate) return;
    const link = createType === 'WEBSITE' ? createData.companyLink?.trim() : createData.linkedinLink?.trim();
    if (!link || link.length < 10) {
      setDuplicateCheck({ duplicate: false, existing: null });
      return;
    }
    const t = setTimeout(() => {
      const params = createType === 'WEBSITE' ? { companyLink: link } : { linkedinLink: link };
      api.get('/api/research/check-duplicate', { params })
        .then(({ data }) => setDuplicateCheck({ duplicate: data.duplicate, existing: data.existing || null }))
        .catch(() => setDuplicateCheck({ duplicate: false, existing: null }));
    }, 400);
    return () => clearTimeout(t);
  }, [canCreate, showCreate, createType, createData.companyLink, createData.linkedinLink]);

  const openResubmit = (r) => {
    setResubmitItem(r);
    setResubmitData({
      companyName: r.companyName || '',
      companyLink: r.companyLink || '',
      personName: r.personName || '',
      linkedinLink: r.linkedinLink || '',
      country: r.country || ''
    });
    setResubmitScreenshots([]);
    setResubmitScreenshotError('');
  };

  const handleCreateScreenshotsChange = (e) => {
    const files = Array.from(e.target.files || []);
    const oversized = files.filter((f) => f.size > MAX_IMAGE_SIZE);
    if (oversized.length) {
      setScreenshotError(`Each image must be ≤ 500KB. ${oversized.length} file(s) exceeded the limit.`);
      setScreenshotFiles(files.filter((f) => f.size <= MAX_IMAGE_SIZE));
    } else {
      setScreenshotError('');
      setScreenshotFiles(files);
    }
  };

  const handleResubmitScreenshotsChange = (e) => {
    const files = Array.from(e.target.files || []);
    const oversized = files.filter((f) => f.size > MAX_IMAGE_SIZE);
    if (oversized.length) {
      setResubmitScreenshotError(`Each image must be ≤ 500KB. ${oversized.length} file(s) exceeded the limit.`);
      setResubmitScreenshots(files.filter((f) => f.size <= MAX_IMAGE_SIZE));
    } else {
      setResubmitScreenshotError('');
      setResubmitScreenshots(files);
    }
  };

  const handleResubmitSubmit = (e) => {
    e.preventDefault();
    if (!resubmitItem || !resubmitData.country?.trim()) return;
    const isWebsite = !!resubmitData.companyName || !!resubmitData.companyLink;
    if (isWebsite && (!resubmitData.companyName?.trim() || !resubmitData.companyLink?.trim())) {
      setError('Company name and link required');
      return;
    }
    if (!isWebsite && (!resubmitData.personName?.trim() || !resubmitData.linkedinLink?.trim())) {
      setError('Person name and LinkedIn link required');
      return;
    }
    setResubmitLoading(true);
    setError('');
    setResubmitScreenshotError('');
    const fd = new FormData();
    fd.append('country', resubmitData.country.trim());
    if (isWebsite) {
      fd.append('companyName', resubmitData.companyName.trim());
      fd.append('companyLink', resubmitData.companyLink.trim());
    } else {
      fd.append('personName', resubmitData.personName.trim());
      fd.append('linkedinLink', resubmitData.linkedinLink.trim());
    }
    resubmitScreenshots.forEach((file) => fd.append('screenshots', file));
    api.put(`/api/research/${resubmitItem._id}/resubmit`, fd)
      .then(() => {
        setResubmitItem(null);
        fetchResearch();
      })
      .catch((err) => setError(err.response?.data?.message || 'Resubmit failed'))
      .finally(() => setResubmitLoading(false));
  };

  const pendingIds = res.data.filter((r) => r.status === 'PENDING').map((r) => r._id);
  const isOwn = (r) => String(r.researcher?._id || r.researcher) === String(user?.id);

  if (isInquirer) return <Navigate to="/dashboard/inquiries" replace />;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Research</h1>
        <p className="page-subtitle">Research records.</p>
      </motion.div>

      {error && <div className="dashboard-error">{error}</div>}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
          {!isInquirer && (
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="text-input"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '200px' }}
            />
            <button type="submit" className="btn btn-secondary">Search</button>
          </form>
          )}
          {!isInquirer && isSuperAdmin && (
            <select className="select-input" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} style={{ width: '160px' }}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          )}
          {!isInquirer && (
          <select className="select-input" value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }} style={{ width: '140px' }}>
            <option value="">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          )}
          {!isInquirer && (
          <select className="select-input" value={status} onChange={(e) => { setStatus(e.target.value); setListFilter(''); setPage(1); }}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
          )}
          {!isInquirer && canEditResearch && (
            <select className="select-input" value={listFilter} onChange={(e) => { setListFilter(e.target.value); setStatus(''); setPage(1); }} style={{ width: '160px' }}>
              {LIST_OPTIONS.map((o) => (
                <option key={o.value || 'list'} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {isInquirer && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenIds((prev) => (prev.size === res.data.length ? new Set() : new Set(res.data.map((r) => r._id))))}>
                {openIds.size === res.data.length ? 'Deselect all' : 'Select all on page'}
              </button>
              {openIds.size > 0 && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                  const urls = [];
                  res.data.filter((r) => openIds.has(r._id)).forEach((r) => {
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
          {!isInquirer && canCreate && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreate(true)}>+ New</button>
          )}
          {!isInquirer && canEditResearch && (status === 'APPROVED' || listFilter === '') && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAssignIds((prev) => {
                const approvedOnPage = res.data.filter((r) => r.status === 'APPROVED');
                if (prev.size === approvedOnPage.length) return new Set();
                return new Set(approvedOnPage.map((r) => r._id));
              })}>
                {assignIds.size === res.data.filter((r) => r.status === 'APPROVED').length && res.data.some((r) => r.status === 'APPROVED') ? 'Deselect all' : 'Select all approved on page'}
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={assignIds.size === 0} onClick={() => setAssignIds(new Set())}>Clear selection</button>
              {assignIds.size > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{assignIds.size} selected</span>
                  <select className="select-input" value={assignInquirer} onChange={(e) => setAssignInquirer(e.target.value)} style={{ width: '180px' }}>
                    <option value="">Assign to...</option>
                    {inquirers.map((u) => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role?.includes('WEBSITE') ? 'Website' : 'LinkedIn'} Inquirer)</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-primary btn-sm" disabled={!assignInquirer} onClick={async () => {
                    if (!assignInquirer || assignIds.size === 0) return;
                    setAssignLoading(true);
                    try {
                      await api.post('/api/research/assign', { researchIds: [...assignIds], inquirerId: assignInquirer });
                      setAssignIds(new Set());
                      setAssignInquirer('');
                      fetchResearch();
                    } catch (err) { setError(err.response?.data?.message || 'Assign failed'); }
                    finally { setAssignLoading(false); }
                  }}>{assignLoading ? 'Assigning…' : 'Assign'}</button>
                </span>
              )}
            </>
          )}
          {!isInquirer && isAuditor && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={selectAll}>
                {selected.size === res.data.filter((r) => r.status === 'PENDING').length ? 'Deselect all' : 'Select all pending'}
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

        {loading ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}><div className="auth-loading-spinner" /></div>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {isAuditor && <th style={{ width: '40px' }}><input type="checkbox" checked={pendingIds.length > 0 && selected.size === pendingIds.length} onChange={selectAll} /></th>}
                    {isInquirer && <th style={{ width: '40px' }}>Open</th>}
                    {canEditResearch && (status === 'APPROVED' || listFilter === '') && !isInquirer && <th style={{ width: '40px' }}>Assign</th>}
                    <th>Ref No</th>
                    <th>Type</th>
                    <th>Company / Person</th>
                    <th>Link</th>
                    <th>Country</th>
                    <th>Researcher</th>
                    <th>Category</th>
                    <th>Screenshot</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {res.data.map((r) => (
                    <tr key={r._id}>
                      {isAuditor && (
                        <td>
                          {r.status === 'PENDING' && (
                            <input
                              type="checkbox"
                              checked={selected.has(r._id)}
                              onChange={() => toggleSelect(r._id)}
                            />
                          )}
                        </td>
                      )}
                      {canEditResearch && (status === 'APPROVED' || listFilter === '') && !isInquirer && (
                        <td>
                          {r.status === 'APPROVED' && (
                            <input
                              type="checkbox"
                              checked={assignIds.has(r._id)}
                              onChange={() => {
                                setAssignIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(r._id)) next.delete(r._id);
                                  else next.add(r._id);
                                  return next;
                                });
                              }}
                            />
                          )}
                        </td>
                      )}
                      {isInquirer && (
                        <td>
                          <input
                            type="checkbox"
                            checked={openIds.has(r._id)}
                            onChange={() => {
                              setOpenIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(r._id)) next.delete(r._id);
                                else next.add(r._id);
                                return next;
                              });
                            }}
                          />
                        </td>
                      )}
                      <td><strong>{r.referenceNo || '—'}</strong></td>
                      <td>{getResearchTypeLabel(r)}</td>
                      <td>{r.companyName || r.personName || '—'}</td>
                      <td>
                        {(r.companyLink || r.linkedinLink) ? (
                          <a href={r.companyLink || r.linkedinLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                            {r.companyLink ? 'Link' : 'Profile'}
                          </a>
                        ) : '—'}
                      </td>
                      <td>{r.country || '—'}</td>
                      <td>{r.researcher?.name || '—'}</td>
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
                        {canCreate && r.status === 'DISAPPROVED' && isOwn(r) && !r.resubmitted && !r.appealed && (
                          <>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => openResubmit(r)}>Resubmit</button>
                            <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: '0.25rem' }} onClick={async () => {
                              setAppealLoading(true);
                              try {
                                await api.post(`/api/research/${r._id}/appeal`);
                                fetchResearch();
                              } catch (err) { setError(err.response?.data?.message || 'Appeal failed'); }
                              finally { setAppealLoading(false); }
                            }} disabled={appealLoading}>Appeal</button>
                          </>
                        )}
                        {canEditResearch && listFilter === 'appealed' && r.appealed && !r.appealDecidedBy && (
                          <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-sm btn-primary" onClick={async () => {
                              try {
                                await api.put(`/api/research/${r._id}/appeal-decision`, { decision: 'APPROVED' });
                                setAppealItem(null);
                                fetchResearch();
                              } catch (err) { setError(err.response?.data?.message || 'Failed'); }
                            }}>Approve</button>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setAppealItem(r)}>Reject</button>
                          </span>
                        )}
                        {canEditResearch && listFilter === 'reported' && r.reported && !r.reportReviewed && (
                          <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => setReportReviewItem(r)}>Review</button>
                          </span>
                        )}
                        {isInquirer && !r.reported && (
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setReportItem(r); setReportReason(''); }}>Report</button>
                        )}
                        {canEditResearch && !listFilter && (
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setEditResearch(r); setEditResearchData({ companyName: r.companyName || '', companyLink: r.companyLink || '', personName: r.personName || '', linkedinLink: r.linkedinLink || '', country: r.country || '', status: r.status }); }} style={{ marginLeft: '0.25rem' }}>Edit</button>
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

      {/* Create Research Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Add Research" subtitle={isWebsiteResearcher ? "Submit company website data." : isLinkedInResearcher ? "Submit LinkedIn profile data." : "Submit a new research record."}>
        <form onSubmit={handleCreateSubmit} className="research-dialog-form">
          {!isWebsiteResearcher && !isLinkedInResearcher && (
            <div>
              <label className="form-label">Type</label>
              <select className="select-input" value={createType} onChange={(e) => setCreateType(e.target.value)} style={{ width: '100%' }}>
                <option value="WEBSITE">Website (Company)</option>
                <option value="LINKEDIN">LinkedIn (Person)</option>
              </select>
            </div>
          )}
          {createType === 'WEBSITE' ? (
            <>
              <div>
                <label className="form-label">Company Name *</label>
                <input className="text-input" value={createData.companyName} onChange={(e) => setCreateData((d) => ({ ...d, companyName: e.target.value }))} placeholder="Company name" required style={{ width: '100%' }} />
              </div>
              <div style={{ width: '100%' }}>
                <label className="form-label">Company Link *</label>
                <input className="text-input" value={createData.companyLink} onChange={(e) => setCreateData((d) => ({ ...d, companyLink: e.target.value }))} placeholder="https://..." type="url" required style={{ width: '100%' }} />
                {duplicateCheck.duplicate && (
                  <div className="form-error" style={{ marginTop: '0.35rem', padding: '0.5rem', background: 'rgba(248,113,113,0.12)', borderRadius: '6px' }}>
                    Duplicate detected. This website already exists (Ref: {duplicateCheck.existing?.referenceNo || '—'}).
                    <br />
                    <small>Do not submit. Edit the link or choose a different target.</small>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="form-label">Person Name *</label>
                <input className="text-input" value={createData.personName} onChange={(e) => setCreateData((d) => ({ ...d, personName: e.target.value }))} placeholder="Person name" required style={{ width: '100%' }} />
              </div>
              <div style={{ width: '100%' }}>
                <label className="form-label">LinkedIn Profile Link *</label>
                <input className="text-input" value={createData.linkedinLink} onChange={(e) => setCreateData((d) => ({ ...d, linkedinLink: e.target.value }))} placeholder="https://linkedin.com/..." type="url" required style={{ width: '100%' }} />
                {duplicateCheck.duplicate && (
                  <div className="form-error" style={{ marginTop: '0.35rem', padding: '0.5rem', background: 'rgba(248,113,113,0.12)', borderRadius: '6px' }}>
                    Duplicate detected. This LinkedIn profile already exists (Ref: {duplicateCheck.existing?.referenceNo || '—'}).
                    <br />
                    <small>Do not submit. Edit the link or choose a different target.</small>
                  </div>
                )}
              </div>
            </>
          )}
          <div>
            <label className="form-label">Country *</label>
            <select className="select-input" value={createData.country} onChange={(e) => setCreateData((d) => ({ ...d, country: e.target.value }))} style={{ width: '100%' }} required>
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {!(isWebsiteResearcher || isLinkedInResearcher) && (
            <div>
              <label className="form-label">Screenshots (optional for Website, recommended for LinkedIn). Max 500KB per image.</label>
              <input type="file" accept="image/*" multiple onChange={handleCreateScreenshotsChange} />
              {screenshotFiles.length > 0 && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{screenshotFiles.length} image(s) selected</span>}
              {screenshotError && <span className="form-error" style={{ display: 'block', marginTop: '0.25rem' }}>{screenshotError}</span>}
            </div>
          )}
          {duplicateCheck.duplicate && (
            <div className="form-error" style={{ padding: '0.5rem', background: 'rgba(248,113,113,0.12)', borderRadius: '6px' }}>
              Submission blocked: duplicate record detected. Change the link before submitting.
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createLoading || duplicateCheck.duplicate}>{createLoading ? 'Submitting…' : 'Submit'}</button>
          </div>
        </form>
      </Dialog>

      {/* Edit Research Dialog (Super Admin) */}
      <Dialog open={!!editResearch} onClose={() => setEditResearch(null)} title="Edit Research" subtitle="Super Admin can update research records.">
        {editResearch && (
          <form onSubmit={(e) => {
            e.preventDefault();
            setEditResearchLoading(true);
            const fd = new FormData();
            fd.append('companyName', editResearchData.companyName || '');
            fd.append('companyLink', editResearchData.companyLink || '');
            fd.append('personName', editResearchData.personName || '');
            fd.append('linkedinLink', editResearchData.linkedinLink || '');
            fd.append('country', editResearchData.country);
            fd.append('status', editResearchData.status);
            api.put(`/api/research/${editResearch._id}`, fd)
              .then(() => { setEditResearch(null); fetchResearch(); })
              .catch((err) => setError(err.response?.data?.message || 'Update failed'))
              .finally(() => setEditResearchLoading(false));
          }} className="research-dialog-form">
            {(editResearch.type === 'WEBSITE' || editResearch.companyName) ? (
              <>
                <div><label className="form-label">Company Name</label><input className="text-input" value={editResearchData.companyName} onChange={(e) => setEditResearchData((d) => ({ ...d, companyName: e.target.value }))} style={{ width: '100%' }} /></div>
                <div style={{ width: '100%' }}><label className="form-label">Company Link</label><input className="text-input" value={editResearchData.companyLink} onChange={(e) => setEditResearchData((d) => ({ ...d, companyLink: e.target.value }))} style={{ width: '100%' }} /></div>
              </>
            ) : (
              <>
                <div><label className="form-label">Person Name</label><input className="text-input" value={editResearchData.personName} onChange={(e) => setEditResearchData((d) => ({ ...d, personName: e.target.value }))} style={{ width: '100%' }} /></div>
                <div style={{ width: '100%' }}><label className="form-label">LinkedIn Link</label><input className="text-input" value={editResearchData.linkedinLink} onChange={(e) => setEditResearchData((d) => ({ ...d, linkedinLink: e.target.value }))} style={{ width: '100%' }} /></div>
              </>
            )}
            <div><label className="form-label">Country</label><select className="select-input" value={editResearchData.country} onChange={(e) => setEditResearchData((d) => ({ ...d, country: e.target.value }))} style={{ width: '100%' }}><option value="">Select</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="form-label">Status</label><select className="select-input" value={editResearchData.status} onChange={(e) => setEditResearchData((d) => ({ ...d, status: e.target.value }))} style={{ width: '100%' }}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="DISAPPROVED">Disapproved</option></select></div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}><button type="button" className="btn btn-secondary" onClick={() => setEditResearch(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={editResearchLoading}>{editResearchLoading ? 'Updating…' : 'Update'}</button></div>
          </form>
        )}
      </Dialog>

      {/* Appeal Reject Dialog */}
      <Dialog open={!!appealItem} onClose={() => setAppealItem(null)} title="Reject Appeal" subtitle="Enter rejection reason. Will be sent via internal message.">
        {appealItem && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const reason = e.target.rejectionReason?.value?.trim() || '';
            if (!reason) return;
            try {
              await api.put(`/api/research/${appealItem._id}/appeal-decision`, { decision: 'DISAPPROVED', rejectionReason: reason });
              setAppealItem(null);
              fetchResearch();
            } catch (err) { setError(err.response?.data?.message || 'Failed'); }
          }} className="research-dialog-form">
            <div>
              <label className="form-label">Rejection reason *</label>
              <textarea className="text-input" name="rejectionReason" rows={3} placeholder="Why does this not meet targeting criteria?" required style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAppealItem(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Reject appeal</button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Report Review Dialog */}
      <Dialog open={!!reportReviewItem} onClose={() => { setReportReviewItem(null); setReportAction(''); setReportClarification(''); }} title="Review Report" subtitle="Website reported as problematic. Add to blacklist or send clarification if valid.">
        {reportReviewItem && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!reportAction) return;
            setReportReviewLoading(true);
            try {
              await api.put(`/api/research/${reportReviewItem._id}/report-review`, {
                action: reportAction,
                clarification: reportAction === 'valid' ? reportClarification : undefined
              });
              setReportReviewItem(null);
              setReportAction('');
              setReportClarification('');
              fetchResearch();
            } catch (err) { setError(err.response?.data?.message || 'Failed'); }
            finally { setReportReviewLoading(false); }
          }} className="research-dialog-form">
            <p style={{ fontSize: '0.9rem', margin: '0 0 0.5rem' }}>Report reason: {reportReviewItem.reportReason || '—'}</p>
            <div>
              <label className="form-label">Action *</label>
              <select className="select-input" value={reportAction} onChange={(e) => setReportAction(e.target.value)} style={{ width: '100%' }} required>
                <option value="">Select</option>
                <option value="blacklist">Add to blacklist (invalid)</option>
                <option value="valid">Valid – send clarification to inquirer</option>
              </select>
            </div>
            {reportAction === 'valid' && (
              <div>
                <label className="form-label">Clarification message *</label>
                <textarea className="text-input" value={reportClarification} onChange={(e) => setReportClarification(e.target.value)} rows={3} placeholder="Message to inquirer" required style={{ width: '100%' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setReportReviewItem(null); setReportAction(''); setReportClarification(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={reportReviewLoading}>Submit</button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Inquirer Report Dialog */}
      <Dialog open={!!reportItem} onClose={() => { setReportItem(null); setReportReason(''); }} title="Report problem" subtitle="Report this target (no online form, inaccessible, invalid link).">
        {reportItem && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setReportSubmitLoading(true);
            try {
              await api.post(`/api/research/${reportItem._id}/report`, { reason: reportReason.trim() || 'Reported by inquirer' });
              setReportItem(null);
              setReportReason('');
              fetchResearch();
            } catch (err) { setError(err.response?.data?.message || 'Report failed'); }
            finally { setReportSubmitLoading(false); }
          }} className="research-dialog-form">
            <div>
              <label className="form-label">Reason (optional)</label>
              <textarea className="text-input" value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={2} placeholder="e.g. No online form, website inaccessible" style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setReportItem(null); setReportReason(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={reportSubmitLoading}>Submit report</button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Resubmit Dialog */}
      <Dialog open={!!resubmitItem} onClose={() => setResubmitItem(null)} title="Resubmit Research" subtitle="Correct and resubmit for re-review. You can only resubmit once.">
        {resubmitItem && (
          <form onSubmit={handleResubmitSubmit} className="research-dialog-form">
            {resubmitItem.companyName || resubmitItem.companyLink ? (
              <>
                <div>
                  <label className="form-label">Company Name *</label>
                  <input className="text-input" value={resubmitData.companyName} onChange={(e) => setResubmitData((d) => ({ ...d, companyName: e.target.value }))} required style={{ width: '100%' }} />
                </div>
                <div style={{ width: '100%' }}>
                  <label className="form-label">Company Link *</label>
                  <input className="text-input" value={resubmitData.companyLink} onChange={(e) => setResubmitData((d) => ({ ...d, companyLink: e.target.value }))} type="url" required style={{ width: '100%' }} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="form-label">Person Name *</label>
                  <input className="text-input" value={resubmitData.personName} onChange={(e) => setResubmitData((d) => ({ ...d, personName: e.target.value }))} required style={{ width: '100%' }} />
                </div>
                <div style={{ width: '100%' }}>
                  <label className="form-label">LinkedIn Profile Link *</label>
                  <input className="text-input" value={resubmitData.linkedinLink} onChange={(e) => setResubmitData((d) => ({ ...d, linkedinLink: e.target.value }))} type="url" required style={{ width: '100%' }} />
                </div>
              </>
            )}
            <div>
              <label className="form-label">Country *</label>
              <select className="select-input" value={resubmitData.country} onChange={(e) => setResubmitData((d) => ({ ...d, country: e.target.value }))} style={{ width: '100%' }} required>
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {!(isWebsiteResearcher || isLinkedInResearcher) && (
              <div>
                <label className="form-label">New Screenshots (optional). Max 500KB per image.</label>
                <input type="file" accept="image/*" multiple onChange={handleResubmitScreenshotsChange} />
                {resubmitScreenshots.length > 0 && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{resubmitScreenshots.length} image(s) selected</span>}
                {resubmitScreenshotError && <span className="form-error" style={{ display: 'block', marginTop: '0.25rem' }}>{resubmitScreenshotError}</span>}
              </div>
            )}
            {resubmitItem.disapprovalReason && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}><strong>Reason:</strong> {resubmitItem.disapprovalReason}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setResubmitItem(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={resubmitLoading}>{resubmitLoading ? 'Submitting…' : 'Resubmit'}</button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
