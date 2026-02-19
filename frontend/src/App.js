import React, { useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';

// Importing Components and Pages
import Sidebar from './components/Sidebar';
import ManagerDashboard from './pages/ManagerDashboard';
import DailyWorksheet from './pages/DailyWorksheet';
import ClientPlans from './pages/ClientPlans';
import StaffManagement from './pages/StaffManagement';

/**
 * 1. PROTECTED ROUTE COMPONENT
 * Fulfills Success Criterion #2: Role-Based Access Control (RBAC).
 * This component acts as a "Gatekeeper" to prevent unauthorized URL access.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('user_role');

  // If no token exists, the user is not logged in. Redirect to Login page.
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // If roles are specified, check if the current user's role has permission.
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // If unauthorized, redirect them to their specific "Home" page.
    return <Navigate to={userRole === 'Manager' ? '/dashboard' : '/worksheet'} replace />;
  }

  // Otherwise, render the page.
  return children;
};

/**
 * 2. LOGIN COMPONENT
 * Handles authentication and session persistence (Success Criterion #2 & #5).
 */
function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Send credentials to Flask API
      const response = await axios.post('http://127.0.0.1:5000/login', {
        username: username,
        password: password
      });
      
      if (response.data.status === 'success') {
        // STATE PERSISTENCE: Save session data for route guarding and API calls
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user_id', response.data.user_id);
        localStorage.setItem('user_role', response.data.role);

        // RBAC NAVIGATION: Immediate redirect based on role
        const role = response.data.role;
        if (role === 'Manager') {
          navigate('/dashboard');
        } else {
          navigate('/worksheet');
        }
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Login Failed: Check credentials.';
      setMessage(errorMsg);
    }
  };

  return (
    <div style={loginPageStyle}>
      <div style={loginCardStyle}>
        <h1 style={{ color: '#2c3e50', margin: 0 }}>PowerTrack Pro</h1>
        <p style={{ color: '#7f8c8d', marginBottom: '20px' }}>Management System</p>
        <form onSubmit={handleLogin}>
          <input 
            type="text" 
            placeholder="Username" 
            style={loginInputStyle}
            onChange={(e) => setUsername(e.target.value)} 
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            style={loginInputStyle}
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          <button type="submit" style={loginBtnStyle}>Sign In</button>
        </form>
        {message && <p style={{ color: '#e74c3c', marginTop: '15px', fontSize: '14px' }}>{message}</p>}
      </div>
    </div>
  );
}

/**
 * 3. LAYOUT WRAPPER COMPONENT
 * Manages UI layout consistency and global navigation state.
 */
function LayoutWrapper({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // LOGOUT LOGIC: Clears storage to "Lock" the protected routes again
  const handleLogout = () => {
    localStorage.clear(); 
    navigate('/'); 
  };

  const isLoginPage = location.pathname === '/';
  const userRole = localStorage.getItem('user_role');
  const token = localStorage.getItem('token');

  // VISIBILITY LOGIC: Sidebar only shows for Managers when logged in.
  // Detailers use the Logout button inside the DailyWorksheet.js header.
  const shouldShowSidebar = token && !isLoginPage && userRole === 'Manager';

  return (
    <div style={{ display: 'flex' }}>
      {shouldShowSidebar && (
        <Sidebar 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
          onLogout={handleLogout} 
        />
      )}
      
      <main style={{ 
        flex: 1, 
        marginLeft: !shouldShowSidebar ? '0' : (isSidebarOpen ? '240px' : '70px'), 
        transition: 'margin-left 0.3s ease', 
        minHeight: '100vh',
        backgroundColor: '#f8f9fa' 
      }}>
        <div style={{ padding: '20px' }}>
            {children}
        </div>
      </main>
    </div>
  );
}

/**
 * 4. MAIN APP COMPONENT
 * The core routing engine using ProtectedRoute wrappers.
 */
function App() {
  return (
    <Router>
      <LayoutWrapper>
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<Login />} />
          
          {/* Protected Manager Routes - Success Criterion #1, #6, #9 */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['Manager']}>
                <ManagerDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/plans" 
            element={
              <ProtectedRoute allowedRoles={['Manager']}>
                <ClientPlans />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/staff" 
            element={
              <ProtectedRoute allowedRoles={['Manager']}>
                <StaffManagement />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected Worksheet Route - Success Criterion #10 */}
          <Route 
            path="/worksheet" 
            element={
              <ProtectedRoute allowedRoles={['Manager', 'Detailer']}>
                <DailyWorksheet />
              </ProtectedRoute>
            } 
          />

          {/* Catch-all: Redirect unknown paths back to Login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LayoutWrapper>
    </Router>
  );
}

// --- CSS Styles ---
const loginPageStyle = { height: '100vh', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f4f6' };
const loginCardStyle = { backgroundColor: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', textAlign: 'center', width: '360px' };
const loginInputStyle = { width: '100%', padding: '12px', margin: '8px 0', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '16px' };
const loginBtnStyle = { width: '100%', padding: '12px', backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '15px', fontSize: '16px' };

export default App;