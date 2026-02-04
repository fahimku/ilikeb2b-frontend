import { motion } from 'framer-motion';

export default function NoticesPage() {
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Notices</h1>
        <p className="page-subtitle">Category notices for your role (API coming soon).</p>
      </motion.div>
      <motion.div
        className="content-card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>No notices backend yet. When the API is ready, notices can be listed here.</p>
      </motion.div>
    </>
  );
}
