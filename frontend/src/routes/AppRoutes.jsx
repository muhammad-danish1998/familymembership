import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/layout/Layout.jsx';
import { AdminGuard } from './AdminGuard.jsx';
import { FamilyGuard } from './FamilyGuard.jsx';

// Pages
import { FamilyPage } from '../pages/family/FamilyPage.jsx';
import { AdminLogin } from '../pages/admin/AdminLogin.jsx';
import { AdminDashboard } from '../pages/admin/AdminDashboard.jsx';
import { AdminMembers } from '../pages/admin/AdminMembers.jsx';
import { AdminPayments } from '../pages/admin/AdminPayments.jsx';
import { AdminDeathSupport } from '../pages/admin/AdminDeathSupport.jsx';
import { AdminSettings } from '../pages/admin/AdminSettings.jsx';

export function AppRoutes() {
  return (
    <Layout>
      <Routes>
        {/* Root redirect to family view */}
        <Route path="/" element={<Navigate to="/family" replace />} />

        {/* Family PIN Gate & Read-Only Pages */}
        <Route path="/family" element={<FamilyPage />} />
        <Route
          path="/family/member/:id"
          element={
            <FamilyGuard>
              <FamilyPage />
            </FamilyGuard>
          }
        />

        {/* Admin Login */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Admin Protected Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <AdminGuard>
              <AdminDashboard />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/members"
          element={
            <AdminGuard>
              <AdminMembers />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <AdminGuard>
              <AdminPayments />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/death-support"
          element={
            <AdminGuard>
              <AdminDeathSupport />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminGuard>
              <AdminSettings />
            </AdminGuard>
          }
        />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/family" replace />} />
      </Routes>
    </Layout>
  );
}
