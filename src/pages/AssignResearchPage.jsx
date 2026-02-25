import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../config/sidebarNav';
import { COUNTRIES } from '../config/countries';

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
];
const ASSIGNMENT_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' },
];

const getResearchTypeLabel = (r) => {
  if (r.type === 'WEBSITE') return 'Website';
  if (r.type === 'LINKEDIN') return 'LinkedIn';
  return r.companyName ? 'Website' : 'LinkedIn';
};

export default function AssignResearchPage() {
  const { user } = useAuth();
  const [res, setRes] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [inquirers, setInquirers] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState(0);
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [assignInquirer, setAssignInquirer] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [deassignLoading, setDeassignLoading] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isCategoryAdmin = user?.role === 'CATEGORY_ADMIN';

  const fetchResearch = useCallback((signal) => {
    setLoading(true);
    const params = { page, limit, status: 'APPROVED' };
    if (categoryFilter) params.category = categoryFilter;
    if (typeFilter) params.type = typeFilter;
    if (countryFilter.trim()) params.country = countryFilter.trim();
    if (search.trim()) params.search = search.trim();
    if (assignmentFilter) params.assignment = assignmentFilter;
    if (assignedToFilter) params.assignedTo = assignedToFilter;
    api.get('/api/research', { params, signal })
      .then(({ data }) => setRes({ data: data.data || [], total: data.total ?? 0 }))
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [page, limit, categoryFilter, typeFilter, countryFilter, searchSubmitted, assignmentFilter, assignedToFilter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchResearch(controller.signal);
    return () => controller.abort();
  }, [fetchResearch]);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/api/categories').then(({ data }) => setCategories(data || [])).catch(() => {});
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    api.get('/api/users')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.data || [];
        setInquirers(list.filter((u) => ['WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER'].includes(u.role)));
      })
      .catch(() => setInquirers([]));
  }, []);

  const handleAssign = async () => {
    if (!assignInquirer || selectedIds.size === 0) return;
    setAssignLoading(true);
    setError('');
    try {
      await api.post('/api/research/assign', { researchIds: [...selectedIds], inquirerId: assignInquirer });
      setSelectedIds(new Set());
      setAssignInquirer('');
      fetchResearch();
    } catch (err) {
      setError(err.response?.data?.message || 'Assign failed');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleDeassign = async (ids) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (!idList.length) return;
    setDeassignLoading(true);
    setError('');
    try {
      await api.post('/api/research/deassign', { researchIds: idList });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        idList.forEach((id) => next.delete(id));
        return next;
      });
      fetchResearch();
    } catch (err) {
      setError(err.response?.data?.message || 'Deassign failed');
    } finally {
      setDeassignLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    if (selectedIds.size === res.data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(res.data.map((r) => r._id)));
    }
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'short' }) : '—');

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Assign research to inquirers</h1>
        <p className="page-subtitle">
          View approved research, see who it’s assigned to, and assign or deassign inquirers. Use filters to find specific records.
        </p>
      </motion.div>

      {error && (
        <div className="dashboard-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          {isSuperAdmin && (
            <div style={{ minWidth: '160px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Category</label>
              <select className="select-input" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} style={{ width: '100%' }}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ minWidth: '120px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Type</label>
            <select className="select-input" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} style={{ width: '100%' }}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Country</label>
            <select className="select-input" value={countryFilter} onChange={(e) => { setCountryFilter(e.target.value); setPage(1); }} style={{ width: '100%' }}>
              <option value="">All countries</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Assignment</label>
            <select className="select-input" value={assignmentFilter} onChange={(e) => { setAssignmentFilter(e.target.value); setAssignedToFilter(''); setPage(1); }} style={{ width: '100%' }}>
              {ASSIGNMENT_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {assignmentFilter === 'assigned' && inquirers.length > 0 && (
            <div style={{ minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Assigned to</label>
              <select className="select-input" value={assignedToFilter} onChange={(e) => { setAssignedToFilter(e.target.value); setPage(1); }} style={{ width: '100%' }}>
                <option value="">All inquirers</option>
                {inquirers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name} ({ROLE_LABELS[u.role] || u.role})</option>
                ))}
              </select>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearchSubmitted((s) => s + 1); }} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flex: '1', minWidth: '200px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Search</label>
              <input className="text-input" placeholder="Ref, company, link…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%' }} />
            </div>
            <button type="submit" className="btn btn-secondary">Search</button>
          </form>
        </div>

        {/* Actions bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllOnPage}>
            {selectedIds.size === res.data.length && res.data.length > 0 ? 'Deselect all' : 'Select all on page'}
          </button>
          {selectedIds.size > 0 && (
            <>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{selectedIds.size} selected</span>
              <select className="select-input" value={assignInquirer} onChange={(e) => setAssignInquirer(e.target.value)} style={{ width: '200px' }}>
                <option value="">Assign to…</option>
                {inquirers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.role?.includes('WEBSITE') ? 'Website' : 'LinkedIn'})</option>
                ))}
              </select>
              <button type="button" className="btn btn-primary btn-sm" disabled={!assignInquirer || assignLoading} onClick={handleAssign}>
                {assignLoading ? 'Assigning…' : 'Assign'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={deassignLoading} onClick={() => handleDeassign([...selectedIds])}>
                {deassignLoading ? 'Deassigning…' : 'Deassign selected'}
              </button>
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
                    <th style={{ width: '44px' }}>
                      <input type="checkbox" checked={res.data.length > 0 && selectedIds.size === res.data.length} onChange={selectAllOnPage} />
                    </th>
                    <th>Ref No</th>
                    <th>Type</th>
                    <th>Company / Person</th>
                    <th>Link</th>
                    <th>Country</th>
                    <th>Researcher</th>
                    <th>Category</th>
                    <th>Assigned to</th>
                    <th>Assigned at</th>
                    <th style={{ width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {res.data.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <input type="checkbox" checked={selectedIds.has(r._id)} onChange={() => toggleSelect(r._id)} />
                      </td>
                      <td><strong>{r.referenceNo || '—'}</strong></td>
                      <td>{getResearchTypeLabel(r)}</td>
                      <td>{r.companyName || r.personName || '—'}</td>
                      <td>
                        {(r.companyLink || r.linkedinLink) ? (
                          <a href={r.companyLink || r.linkedinLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}>Open</a>
                        ) : '—'}
                      </td>
                      <td>{r.country || '—'}</td>
                      <td>{r.researcher?.name || '—'}</td>
                      <td>{r.category?.name || '—'}</td>
                      <td>
                        {r.assignedTo ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {r.assignedTo.name}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              ({r.assignedTo.role?.includes('WEBSITE') ? 'Web' : 'LI'})
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>— Unassigned</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{formatDate(r.assignedAt)}</td>
                      <td>
                        {r.assignedTo && (
                          <button type="button" className="btn btn-sm btn-secondary" disabled={deassignLoading} onClick={() => handleDeassign([r._id])} title="Remove assignment">
                            Deassign
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {res.data.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No approved research found. Adjust filters or add approved research first.</p>
            )}
            <div className="pagination-wrap" style={{ marginTop: '1rem' }}>
              <span className="pagination-info">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, res.total)} of {res.total}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select className="select-input" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span style={{ fontSize: '0.875rem' }}>per page</span>
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
