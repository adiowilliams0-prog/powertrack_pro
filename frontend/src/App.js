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
 */
function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://127.0.0.1:5000/login', {
        username: username,
        password: password
      });
      
      if (response.data.status === 'success') {
        const role = response.data.role;
        // Logic to redirect based on the user's role in the database
        if (role === 'Manager') {
          navigate('/dashboard');
        } else {
          navigate('/worksheet');
        }
      }
    } catch (error) {
      setMessage('Login Failed: Check your credentials.');
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const isLoginPage = location.pathname === '/';

  return (
    <div style={{ display: 'flex' }}>
      {/* We only render the Sidebar if we aren't on the login page.
          We pass the state and setter as props to Sidebar.js 
      */}
      {!isLoginPage && (
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      )}
      
      <main style={{ 
        flex: 1, 
        // Dynamic margin calculation: 240px when open, 70px when collapsed, 0 on login
        marginLeft: isLoginPage ? '0' : (isSidebarOpen ? '240px' : '70px'), 
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
  return (
    <Router>
      <LayoutWrapper>
        <Routes>
          {/* Auth Route */}
          <Route path="/" element={<Login />} />
          
          {/* Manager Specific Routes */}
          <Route path="/dashboard" element={<ManagerDashboard />} />
          <Route path="/plans" element={<ClientPlans />} />
          <Route path="/staff" element={<StaffManagement />} />
          
          {/* Detailer Specific Routes */}
          <Route path="/worksheet" element={<DailyWorksheet />} />
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