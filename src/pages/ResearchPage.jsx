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

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isCategoryAdmin = user?.role === 'CATEGORY_ADMIN';
  const canEditResearch = isSuperAdmin || isCategoryAdmin;
  const isAuditor = ['WEBSITE_RESEARCH_AUDITOR', 'LINKEDIN_RESEARCH_AUDITOR'].includes(user?.role);
  const canCreate = isResearcher(user?.role);
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
    if (status) params.status = status;
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
  }, [page, limit, status, country, categoryFilter, searchSubmitted, isSuperAdmin]);

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

  const runAudit = () => {
    if (!auditAction || (auditAction === 'DISAPPROVED' && !reason.trim())) return;
    const ids = [...selected];
    setSelected(new Set());
    setAuditAction(null);
    setReason('');
    api.post('/api/audit/research', { ids, action: auditAction, reason: reason.trim() || undefined })
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
    }
  }, [canCreate, showCreate, isWebsiteResearcher, isLinkedInResearcher]);

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

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Research</h1>
        <p className="page-subtitle">Website & LinkedIn research records.</p>
      </motion.div>

      {error && <div className="dashboard-error">{error}</div>}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
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
          {isSuperAdmin && (
            <select className="select-input" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} style={{ width: '160px' }}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          )}
          <select className="select-input" value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }} style={{ width: '140px' }}>
            <option value="">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="select-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
          {canCreate && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreate(true)}>+ New</button>
          )}
          {isAuditor && (
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
                      <td><strong>{r.referenceNo || '—'}</strong></td>
                      <td>{r.type === 'WEBSITE' || r.companyName ? 'Website' : 'LinkedIn'}</td>
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
                        {canCreate && r.status === 'DISAPPROVED' && isOwn(r) && !r.resubmitted && (
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => openResubmit(r)}>Resubmit</button>
                        )}
                        {canEditResearch && (
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
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                <input className="text-input" value={createData.companyName} onChange={(e) => setCreateData((d) => ({ ...d, companyName: e.target.value }))} placeholder="Company name" required />
              </div>
              <div>
                <label className="form-label">Company Link *</label>
                <input className="text-input" value={createData.companyLink} onChange={(e) => setCreateData((d) => ({ ...d, companyLink: e.target.value }))} placeholder="https://..." type="url" required />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="form-label">Person Name *</label>
                <input className="text-input" value={createData.personName} onChange={(e) => setCreateData((d) => ({ ...d, personName: e.target.value }))} placeholder="Person name" required />
              </div>
              <div>
                <label className="form-label">LinkedIn Profile Link *</label>
                <input className="text-input" value={createData.linkedinLink} onChange={(e) => setCreateData((d) => ({ ...d, linkedinLink: e.target.value }))} placeholder="https://linkedin.com/..." type="url" required />
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
          <div>
            <label className="form-label">Screenshots (optional for Website, recommended for LinkedIn). Max 500KB per image.</label>
            <input type="file" accept="image/*" multiple onChange={handleCreateScreenshotsChange} />
            {screenshotFiles.length > 0 && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{screenshotFiles.length} image(s) selected</span>}
            {screenshotError && <span className="form-error" style={{ display: 'block', marginTop: '0.25rem' }}>{screenshotError}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createLoading}>{createLoading ? 'Submitting…' : 'Submit'}</button>
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
          }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(editResearch.type === 'WEBSITE' || editResearch.companyName) ? (
              <>
                <div><label className="form-label">Company Name</label><input className="text-input" value={editResearchData.companyName} onChange={(e) => setEditResearchData((d) => ({ ...d, companyName: e.target.value }))} style={{ width: '100%' }} /></div>
                <div><label className="form-label">Company Link</label><input className="text-input" value={editResearchData.companyLink} onChange={(e) => setEditResearchData((d) => ({ ...d, companyLink: e.target.value }))} style={{ width: '100%' }} /></div>
              </>
            ) : (
              <>
                <div><label className="form-label">Person Name</label><input className="text-input" value={editResearchData.personName} onChange={(e) => setEditResearchData((d) => ({ ...d, personName: e.target.value }))} style={{ width: '100%' }} /></div>
                <div><label className="form-label">LinkedIn Link</label><input className="text-input" value={editResearchData.linkedinLink} onChange={(e) => setEditResearchData((d) => ({ ...d, linkedinLink: e.target.value }))} style={{ width: '100%' }} /></div>
              </>
            )}
            <div><label className="form-label">Country</label><select className="select-input" value={editResearchData.country} onChange={(e) => setEditResearchData((d) => ({ ...d, country: e.target.value }))} style={{ width: '100%' }}><option value="">Select</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="form-label">Status</label><select className="select-input" value={editResearchData.status} onChange={(e) => setEditResearchData((d) => ({ ...d, status: e.target.value }))} style={{ width: '100%' }}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="DISAPPROVED">Disapproved</option></select></div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}><button type="button" className="btn btn-secondary" onClick={() => setEditResearch(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={editResearchLoading}>{editResearchLoading ? 'Updating…' : 'Update'}</button></div>
          </form>
        )}
      </Dialog>

      {/* Resubmit Dialog */}
      <Dialog open={!!resubmitItem} onClose={() => setResubmitItem(null)} title="Resubmit Research" subtitle="Correct and resubmit for re-review. You can only resubmit once.">
        {resubmitItem && (
          <form onSubmit={handleResubmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {resubmitItem.companyName || resubmitItem.companyLink ? (
              <>
                <div>
                  <label className="form-label">Company Name *</label>
                  <input className="text-input" value={resubmitData.companyName} onChange={(e) => setResubmitData((d) => ({ ...d, companyName: e.target.value }))} required />
                </div>
                <div>
                  <label className="form-label">Company Link *</label>
                  <input className="text-input" value={resubmitData.companyLink} onChange={(e) => setResubmitData((d) => ({ ...d, companyLink: e.target.value }))} type="url" required />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="form-label">Person Name *</label>
                  <input className="text-input" value={resubmitData.personName} onChange={(e) => setResubmitData((d) => ({ ...d, personName: e.target.value }))} required />
                </div>
                <div>
                  <label className="form-label">LinkedIn Profile Link *</label>
                  <input className="text-input" value={resubmitData.linkedinLink} onChange={(e) => setResubmitData((d) => ({ ...d, linkedinLink: e.target.value }))} type="url" required />
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
            <div>
              <label className="form-label">New Screenshots (optional). Max 500KB per image.</label>
              <input type="file" accept="image/*" multiple onChange={handleResubmitScreenshotsChange} />
              {resubmitScreenshots.length > 0 && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{resubmitScreenshots.length} image(s) selected</span>}
              {resubmitScreenshotError && <span className="form-error" style={{ display: 'block', marginTop: '0.25rem' }}>{resubmitScreenshotError}</span>}
            </div>
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
