import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';

// Components
import ClockIn from './components/ClockIn';
import EnrollmentForm from './components/EnrollmentForm';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import Layout from './components/Layout';

// Protected Route Component - WITH LAYOUT HERE
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className="spinner spinner-lg"></div>
          <p className="mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  // Wrap children in Layout here
  return <Layout>{children}</Layout>;
};

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
        <Routes>
          {/* Public Routes - NO LAYOUT */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ClockIn />} />
          
          {/* Protected Routes - Layout is inside ProtectedRoute */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['admin', 'team_leader', 'agent']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/enroll" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <EnrollmentForm />
            </ProtectedRoute>
          } />
          
          <Route path="/employees" element={
            <ProtectedRoute allowedRoles={['admin', 'team_leader']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/reports" element={
            <ProtectedRoute allowedRoles={['admin', 'team_leader']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;