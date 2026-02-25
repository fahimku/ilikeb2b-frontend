import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layout/DashboardLayout';
import Login from './pages/Login';
import DashboardHome from './pages/DashboardHome';
import CategoriesPage from './pages/CategoriesPage';
import UsersPage from './pages/UsersPage';
import ResearchPage from './pages/ResearchPage';
import AssignResearchPage from './pages/AssignResearchPage';
import InquiriesPage from './pages/InquiriesPage';
import PaymentsPage from './pages/PaymentsPage';
import NoticesPage from './pages/NoticesPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="research" element={<ResearchPage />} />
            <Route path="assign-research" element={<AssignResearchPage />} />
            <Route path="inquiries" element={<InquiriesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="notices" element={<NoticesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
