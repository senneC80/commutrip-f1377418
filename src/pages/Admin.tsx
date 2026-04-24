import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { ShieldCheck, History, BarChart3 } from 'lucide-react';
import VerificationQueue from '@/pages/admin/VerificationQueue';
import VerificationReview from '@/pages/admin/VerificationReview';
import VerificationHistory from '@/pages/admin/VerificationHistory';
import AdminStats from '@/pages/admin/AdminStats';

const adminNav = [
  { title: 'Verification Queue', url: '/admin', icon: ShieldCheck },
  { title: 'Verification History', url: '/admin/history', icon: History },
  { title: 'Stats', url: '/admin/stats', icon: BarChart3 },
];

export default function Admin() {
  const { role, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout navItems={adminNav}>
      <Routes>
        <Route path="/" element={<VerificationQueue />} />
        <Route path="/review/:id" element={<VerificationReview />} />
        <Route path="/history" element={<VerificationHistory />} />
        <Route path="/stats" element={<AdminStats />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
