import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Dialog from '../components/Dialog';
import { ROLE_LABELS } from '../config/sidebarNav';

const ALL_ROLES = [
  { value: '', label: 'All roles in category' },
  ...Object.entries(ROLE_LABELS).filter(([k]) => k !== 'SUPER_ADMIN').map(([k, v]) => ({ value: k, label: v })),
];

export default function NoticesPage() {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('notices');
  const [noticeCategoryFilter, setNoticeCategoryFilter] = useState('');
  const [messageCategoryFilter, setMessageCategoryFilter] = useState('');

  const [showNoticeDialog, setShowNoticeDialog] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [noticeForm, setNoticeForm] = useState({ category: '', role: '', title: '', body: '' });
  const [categories, setCategories] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);

  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [messageForm, setMessageForm] = useState({ recipientId: '', subject: '', body: '' });
  const [messageSubmitting, setMessageSubmitting] = useState(false);

  const [selectedMessage, setSelectedMessage] = useState(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = ['SUPER_ADMIN', 'CATEGORY_ADMIN'].includes(user?.role);
  const userCategory = user?.category?._id ?? user?.category;

  const fetchData = () => {
    setLoading(true);
    const noticeParams = isSuperAdmin && noticeCategoryFilter ? { category: noticeCategoryFilter } : {};
    const messageParams = isSuperAdmin ? { all: 'true' } : {};
    if (isSuperAdmin && messageCategoryFilter) messageParams.category = messageCategoryFilter;

    Promise.all([
      api.get('/api/notices', { params: noticeParams }),
      api.get('/api/notices/messages', { params: messageParams }),
    ])
      .then(([n, m]) => {
        setNotices(n.data || []);
        setMessages(m.data || []);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [noticeCategoryFilter, messageCategoryFilter, isSuperAdmin]);

  useEffect(() => {
    api.get('/api/categories').then(({ data }) => setCategories(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (showNoticeDialog || showMessageDialog) {
      api.get('/api/notices/recipients').then(({ data }) => setRecipients(data || [])).catch(() => setRecipients([]));
      if (showNoticeDialog) {
        setNoticeForm((f) => ({ ...f, category: f.category || userCategory || categories[0]?._id || '' }));
      }
    }
  }, [showNoticeDialog, showMessageDialog, userCategory, categories]);

  const openNoticeDialog = (edit = null) => {
    if (edit) {
      setEditingNotice(edit);
      setNoticeForm({
        category: edit.category?._id || edit.category || '',
        role: edit.role || '',
        title: edit.title || '',
        body: edit.body || '',
      });
    } else {
      setEditingNotice(null);
      setNoticeForm({ category: userCategory || categories[0]?._id || '', role: '', title: '', body: '' });
    }
    setShowNoticeDialog(true);
  };

  const openMessageDialog = (replyMsg = null) => {
    if (replyMsg) {
      setReplyTo(replyMsg);
      setMessageForm({
        recipientId: replyMsg.sender?._id || replyMsg.sender || '',
        subject: `Re: ${replyMsg.subject || ''}`,
        body: '',
      });
    } else {
      setReplyTo(null);
      setMessageForm({ recipientId: '', subject: '', body: '' });
    }
    setShowMessageDialog(true);
  };

  const handleNoticeSubmit = (e) => {
    e.preventDefault();
    if (!noticeForm.title?.trim() || !noticeForm.body?.trim()) {
      setError('Title and body are required');
      return;
    }
    if (!noticeForm.category && isAdmin) {
      setError('Category is required');
      return;
    }
    setNoticeSubmitting(true);
    setError('');
    const promise = editingNotice
      ? api.put(`/api/notices/${editingNotice._id}`, noticeForm)
      : api.post('/api/notices', noticeForm);
    promise
      .then(() => {
        setShowNoticeDialog(false);
        setEditingNotice(null);
        fetchData();
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed'))
      .finally(() => setNoticeSubmitting(false));
  };

  const handleMessageSubmit = (e) => {
    e.preventDefault();
    if (!messageForm.recipientId || !messageForm.subject?.trim() || !messageForm.body?.trim()) {
      setError('Recipient, subject and body are required');
      return;
    }
    setMessageSubmitting(true);
    setError('');
    api.post('/api/notices/messages', messageForm)
      .then(() => {
        setShowMessageDialog(false);
        setReplyTo(null);
        fetchData();
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to send'))
      .finally(() => setMessageSubmitting(false));
  };

  const openMessage = (msg) => {
    setSelectedMessage(msg);
    if (!msg.read) {
      api.patch(`/api/notices/messages/${msg._id}/read`).then(() => fetchData());
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Notices & Messages</h1>
        <p className="page-subtitle">Category notices and inner messages.</p>
      </motion.div>

      {error && <div className="dashboard-error">{error}</div>}

      <motion.div className="content-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-sm ${tab === 'notices' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('notices')}
          >
            Notices
          </button>
          <button
            type="button"
            className={`btn btn-sm ${tab === 'messages' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('messages')}
          >
            Inner Messages {messages.filter((m) => !m.read).length > 0 && `(${messages.filter((m) => !m.read).length})`}
          </button>
          {isSuperAdmin && tab === 'notices' && (
            <select className="select-input" value={noticeCategoryFilter} onChange={(e) => setNoticeCategoryFilter(e.target.value)} style={{ marginLeft: '0.5rem' }}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          )}
          {isSuperAdmin && tab === 'messages' && (
            <select className="select-input" value={messageCategoryFilter} onChange={(e) => setMessageCategoryFilter(e.target.value)} style={{ marginLeft: '0.5rem' }}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openNoticeDialog()} style={{ marginLeft: 'auto' }}>
              + New Notice
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openMessageDialog()}>
            + Send Message
          </button>
        </div>

        {loading ? (
          <div className="dashboard-loading" style={{ padding: '2rem' }}><div className="auth-loading-spinner" /></div>
        ) : tab === 'notices' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {notices.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No notices.</p>
            ) : (
              notices.map((n) => (
                <div key={n._id} style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <strong>{n.title}</strong>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {n.category?.name || '—'} · {n.role ? ROLE_LABELS[n.role] : 'All roles'} · {n.createdBy?.name || '—'} · {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                      {isAdmin && (
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => openNoticeDialog(n)}>Edit</button>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{n.body}</p>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {messages.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No inner messages.</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m._id}
                  onClick={() => openMessage(m)}
                  style={{
                    padding: '0.75rem 1rem',
                    background: m.read ? 'transparent' : 'var(--accent-dim)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <strong>{m.subject}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {isSuperAdmin && (m.recipient?.name || m.recipient) && `To: ${m.recipient?.name || '—'} · `}
                      From {m.sender?.name || '—'} · {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{m.body?.slice(0, 80)}{m.body?.length > 80 ? '…' : ''}</p>
                </div>
              ))
            )}
          </div>
        )}
      </motion.div>

      <Dialog open={showNoticeDialog} onClose={() => { setShowNoticeDialog(false); setEditingNotice(null); }} title={editingNotice ? 'Edit Notice' : 'Create Notice'} subtitle={editingNotice ? 'Update the notice.' : 'All users in the selected role/category will see this notice.'}>
        <form onSubmit={handleNoticeSubmit} className="dialog-form">
          <div className="form-field">
            <label>Category *</label>
            <select
              className="form-input"
              value={noticeForm.category}
              onChange={(e) => setNoticeForm((f) => ({ ...f, category: e.target.value }))}
              required
              disabled={user?.role === 'CATEGORY_ADMIN'}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Target Role</label>
            <select className="form-input" value={noticeForm.role} onChange={(e) => setNoticeForm((f) => ({ ...f, role: e.target.value }))}>
              {ALL_ROLES.map((r) => (
                <option key={r.value || 'all'} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Title *</label>
            <input className="form-input" value={noticeForm.title} onChange={(e) => setNoticeForm((f) => ({ ...f, title: e.target.value }))} required placeholder="Notice title" />
          </div>
          <div className="form-field">
            <label>Body *</label>
            <textarea className="form-input" value={noticeForm.body} onChange={(e) => setNoticeForm((f) => ({ ...f, body: e.target.value }))} required rows={4} placeholder="Notice content" />
          </div>
          <div className="dialog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setShowNoticeDialog(false); setEditingNotice(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={noticeSubmitting}>{noticeSubmitting ? 'Saving…' : (editingNotice ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={showMessageDialog} onClose={() => { setShowMessageDialog(false); setReplyTo(null); }} title={replyTo ? 'Reply' : 'Send Inner Message'} subtitle={replyTo ? `Reply to ${replyTo.sender?.name || '—'}` : 'Send a message to a user in your category.'}>
        <form onSubmit={handleMessageSubmit} className="dialog-form">
          <div className="form-field">
            <label>Recipient *</label>
            <select
              className="form-input"
              value={messageForm.recipientId}
              onChange={(e) => setMessageForm((f) => ({ ...f, recipientId: e.target.value }))}
              required
            >
              <option value="">Select user</option>
              {recipients.map((u) => (
                <option key={u._id} value={u._id}>{u.name} ({u.email}) - {ROLE_LABELS[u.role] || u.role}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Subject *</label>
            <input className="form-input" value={messageForm.subject} onChange={(e) => setMessageForm((f) => ({ ...f, subject: e.target.value }))} required placeholder="Message subject" />
          </div>
          <div className="form-field">
            <label>Body *</label>
            <textarea className="form-input" value={messageForm.body} onChange={(e) => setMessageForm((f) => ({ ...f, body: e.target.value }))} required rows={4} placeholder="Message content" />
          </div>
          <div className="dialog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setShowMessageDialog(false); setReplyTo(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={messageSubmitting}>{messageSubmitting ? 'Sending…' : 'Send'}</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!selectedMessage} onClose={() => setSelectedMessage(null)} title={selectedMessage?.subject || 'Message'} subtitle={selectedMessage ? `From ${selectedMessage.sender?.name || '—'}` : ''}>
        {selectedMessage && (
          <div>
            {isSuperAdmin && selectedMessage.recipient && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>To: {selectedMessage.recipient?.name || selectedMessage.recipient}</p>
            )}
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selectedMessage.body}</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1rem' }}>{new Date(selectedMessage.createdAt).toLocaleString()}</p>
            {isSuperAdmin && (
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }} onClick={() => { setSelectedMessage(null); openMessageDialog(selectedMessage); }}>Reply</button>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
