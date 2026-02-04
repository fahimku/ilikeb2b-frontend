import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Logo({ compact = false, className = '' }) {
  return (
    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <NavLink
        to="/dashboard"
        className={`logo-ilikeb2b ${className}`}
        style={({ isActive }) => ({})}
      >
        <span className="logo-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.18" />
            <text x="16" y="21" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700" fontFamily="var(--font-sans), system-ui, sans-serif">B</text>
          </svg>
        </span>
        {!compact && <span className="logo-text">I Like B2B</span>}
      </NavLink>
    </motion.span>
  );
}
