import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// Assuming LoadingSpinner is now in App.tsx or a shared components directory
// For simplicity, if App.tsx is the only one exporting it non-default, we might need to adjust imports.
// Let's assume it's moved or exported properly. For now, a simple text loader.

const LoadingSpinnerPlaceholder: React.FC<{ text?: string }> = ({ text = "読み込み中..." }) => (
  <div className="flex flex-col items-center justify-center h-screen">
    <svg className="animate-spin h-10 w-10 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <p className="mt-3 text-slate-700 font-medium">{text}</p>
  </div>
);


interface ProtectedRouteProps {
  // FIX: Cannot find namespace 'JSX'. Changed to React.ReactElement.
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Using the local LoadingSpinnerPlaceholder or ideally a shared one
    return <LoadingSpinnerPlaceholder text="認証情報を確認中..." />;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;