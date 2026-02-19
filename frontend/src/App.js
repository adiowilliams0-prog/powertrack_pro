import React, { useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// Importing Components and Pages
// Ensure these paths match your new folder structure
import Sidebar from './components/Sidebar';
import ManagerDashboard from './pages/ManagerDashboard';
import DailyWorksheet from './pages/DailyWorksheet';
import ClientPlans from './pages/ClientPlans';
import StaffManagement from './pages/StaffManagement';

/**
 * Login Component
 * Handles the authentication logic and Role-Based Access Control (RBAC).
 * Now updated with JWT persistence to satisfy session tracking requirements.
 */
function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // 1. Send credentials to the updated Flask /login route
      const response = await axios.post('http://127.0.0.1:5000/login', {
        username: username,
        password: password
      });
      
      if (response.data.status === 'success') {
        // 2. STATE PERSISTENCE: Save the JWT token and user_id to LocalStorage
        // The token will be used for future authorized API calls
        // The user_id will be used to fill 'created_by_user_id' in wash transactions
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user_id', response.data.user_id);
        localStorage.setItem('user_role', response.data.role);

        // 3. RBAC NAVIGATION: Redirect based on the role returned by the server
        const role = response.data.role;
        if (role === 'Manager') {
          navigate('/dashboard');
        } else {
          navigate('/worksheet');
        }
      }
    } catch (error) {
      // Handle 401 Unauthorized or 500 Server Errors
      const errorMsg = error.response?.data?.message || 'Login Failed: Check your credentials.';
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
 * LayoutWrapper Component
 * This is the "Master Layout". It manages the shared Sidebar state 
 * and adjusts the page margin dynamically.
 */
function LayoutWrapper({ children }) {
  const location = useLocation();
  const navigate = useNavigate(); // Add this to use navigate if preferred over window.location
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // --- 1. INSERT THE LOGOUT FUNCTION HERE ---
  const handleLogout = () => {
    // Clear session data
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_role');
    
    // Redirect to login
    navigate('/'); 
    // Or use: window.location.href = "/";
  };

  const isLoginPage = location.pathname === '/';
  // Check role for Sidebar visibility
  const userRole = localStorage.getItem('user_role');
  const shouldShowSidebar = !isLoginPage && userRole === 'Manager';

  return (
    <div style={{ display: 'flex' }}>
      {/* --- 2. PASS THE FUNCTION TO SIDEBAR AS A PROP --- */}
      {shouldShowSidebar && (
        <Sidebar 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
          onLogout={handleLogout} 
        />
      )}
      
      <main style={{ 
        flex: 1, 
        marginLeft: isLoginPage || !shouldShowSidebar ? '0' : (isSidebarOpen ? '240px' : '70px'), 
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
 * Main App Component
 * Fulfills Success Criterion #2: Role-based navigation and protected routes.
 */
function App() {
  // 1. Retrieve the role from storage to determine access
  const userRole = localStorage.getItem('user_role');

  return (
    <Router>
      <LayoutWrapper>
        <Routes>
          {/* Auth Route - Always accessible */}
          <Route path="/" element={<Login />} />
          
          {/* 2. PROTECTED MANAGER ROUTES */}
          {/* Using a ternary or logical AND ensures these routes 
              literally do not exist in the router for a Detailer. */}
          {userRole === 'Manager' && (
            <>
              <Route path="/dashboard" element={<ManagerDashboard />} />
              <Route path="/plans" element={<ClientPlans />} />
              <Route path="/staff" element={<StaffManagement />} />
            </>
          )}
          
          {/* 3. DETAILER ROUTE */}
          <Route path="/worksheet" element={<DailyWorksheet />} />

          {/* 4. CATCH-ALL REDIRECT */}
          {/* If a Detailer tries to type /dashboard, they will fall 
              through to this route and be sent back to Login. */}
          <Route path="*" element={<Login />} />
        </Routes>
      </LayoutWrapper>
    </Router>
  );
}

// --- CSS Styles for the Login Page ---
const loginPageStyle = {
  height: '100vh', width: '100%', display: 'flex', justifyContent: 'center', 
  alignItems: 'center', backgroundColor: '#f1f4f6'
};

const loginCardStyle = {
  backgroundColor: '#fff', padding: '40px', borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.1)', textAlign: 'center', width: '360px'
};

const loginInputStyle = {
  width: '100%', padding: '12px', margin: '8px 0', borderRadius: '6px',
  border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '16px'
};

const loginBtnStyle = {
  width: '100%', padding: '12px', backgroundColor: '#3498db', color: '#fff',
  border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
  marginTop: '15px', fontSize: '16px'
};

export default App;