import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { SIDEBAR_NAV, ROLE_LABELS } from '../config/sidebarNav';
import Logo from '../components/Logo';
import NavIcon from '../components/NavIcon';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [headerDropdownOpen, setHeaderDropdownOpen] = useState(false);
  const headerDropdownRef = useRef(null);
  const navItems = SIDEBAR_NAV.filter((item) => item.roles.includes(user?.role));

  useEffect(() => {
    function handleClickOutside(e) {
      if (headerDropdownRef.current && !headerDropdownRef.current.contains(e.target)) {
        setHeaderDropdownOpen(false);
      }
    }
    if (headerDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [headerDropdownOpen]);

  const handleLogout = () => {
    setHeaderDropdownOpen(false);
    logout();
    navigate('/');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo />
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              end={item.path === '/dashboard'}
            >
              {({ isActive }) => (
                <motion.span
                  className="sidebar-link-inner"
                  initial={false}
                  animate={{ backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent' }}
                  transition={{ duration: 0.2 }}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="sidebar-link sidebar-link-logout" onClick={handleLogout}>
            <span className="sidebar-link-inner">
              <NavIcon name="logout" />
              <span>Logout</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="layout-main">
        <header className="top-header">
          <div className="top-header-left">
            <span className="role-pill">{ROLE_LABELS[user?.role] || user?.role}</span>
          </div>
          <div className="top-header-right">
            <button
              type="button"
              className="header-icon-btn"
              title="Messages"
              aria-label="Messages"
            >
              <svg className="header-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </button>
            <button
              type="button"
              className="header-icon-btn"
              title="Notifications"
              aria-label="Notifications"
            >
              <svg className="header-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13 21a1 1 0 0 1-2 0" />
              </svg>
            </button>
            <div className="header-user-dropdown" ref={headerDropdownRef}>
              <button
                type="button"
                className="header-user-trigger"
                onClick={() => setHeaderDropdownOpen((o) => !o)}
                aria-expanded={headerDropdownOpen}
                aria-haspopup="true"
              >
                <span className="header-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                <span className="header-username">{user?.name || user?.email}</span>
              </button>
              {headerDropdownOpen && (
                <motion.div
                  className="header-dropdown-menu"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="header-dropdown-user">
                    <div className="header-dropdown-name">{user?.name || 'User'}</div>
                    <div className="header-dropdown-email">{user?.email || ''}</div>
                  </div>
                  <div className="header-dropdown-divider" />
                  <NavLink
                    to="/dashboard/profile"
                    className="header-dropdown-item"
                    onClick={() => setHeaderDropdownOpen(false)}
                  >
                    <span className="header-dropdown-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    Profile
                  </NavLink>
                  <NavLink
                    to="/dashboard/settings"
                    className="header-dropdown-item"
                    onClick={() => setHeaderDropdownOpen(false)}
                  >
                    <span className="header-dropdown-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </span>
                    Settings
                  </NavLink>
                  <div className="header-dropdown-divider" />
                  <button type="button" className="header-dropdown-item header-dropdown-logout" onClick={handleLogout}>
                    <span className="header-dropdown-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    </span>
                    Logout
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </header>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
