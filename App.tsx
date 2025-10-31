
import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import ClientListPage from './pages/ClientListPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import KpiMeasurePage from './pages/KpiMeasurePage';
import KpiMeasureRowDetailPage from './pages/KpiMeasureRowDetailPage';
import LandingPage from './pages/LandingPage';


export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
};

const AppLayout: React.FC = () => {
  const location = useLocation();

  if (location.pathname === '/') {
    return <LandingPage />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow p-4 md:p-6 lg:p-8">
        <AppRoutes />
      </main>
      <footer className="text-center p-4 text-xs text-slate-600 bg-slate-200 mt-auto">
        © {new Date().getFullYear()} プロジェクトマネージャーPro. All rights reserved.
      </footer>
    </div>
  );
}

const AppRoutes: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (currentUser && (location.pathname === '/login' || location.pathname === '/signup')) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      
      <Route path="/dashboard" element={<ProtectedRoute><ClientListPage /></ProtectedRoute>} />
      <Route path="/clients/:clientId/projects" element={<ProtectedRoute><ProjectListPage /></ProtectedRoute>} />
      <Route path="/clients/:clientId/projects/:projectId/*" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
      <Route path="/clients/:clientId/projects/:projectId/kpi/:recordId" element={<ProtectedRoute><KpiMeasurePage /></ProtectedRoute>} />
      <Route path="/clients/:clientId/projects/:projectId/kpi/:recordId/measure/:measureId/row/:rowId" element={<ProtectedRoute><KpiMeasureRowDetailPage /></ProtectedRoute>} />

      <Route path="*" element={
        <ProtectedRoute>
          <Navigate to="/dashboard" replace />
        </ProtectedRoute>
      } />
    </Routes>
  );
};