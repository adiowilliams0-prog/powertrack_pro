import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Collapsible Sidebar Component
 * Fulfills Success Criterion #10: Optimizing screen real estate for touch/mobile.
 * Receives 'onLogout' prop from App.js to handle session termination.
 */
function Sidebar({ isOpen, setIsOpen, onLogout }) {
    const location = useLocation();

    // Navigation configuration array
    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: '📊' },
        { name: 'Daily Worksheet', path: '/worksheet', icon: '📝' },
        { name: 'Client Plans', path: '/plans', icon: '🏢' },
        { name: 'Staff Management', path: '/staff', icon: '👥' },
    ];

    const toggleSidebar = () => setIsOpen(!isOpen);

    return (
        <div style={sidebarStyle(isOpen)}>
            {/* Toggle Button */}
            <button onClick={toggleSidebar} style={toggleBtnStyle}>
                {isOpen ? '◀' : '▶'}
            </button>

            {/* Logo/Branding */}
            <div style={logoStyle(isOpen)}>
                {isOpen ? 'PowerTrack Pro' : 'PTP'}
            </div>

            {/* Main Navigation */}
            <nav style={{ flex: 1 }}>
                {navItems.map((item) => (
                    <Link 
                        key={item.path} 
                        to={item.path} 
                        style={linkStyle(location.pathname === item.path, isOpen)}
                        title={!isOpen ? item.name : ""}
                    >
                        <span style={{ fontSize: '20px', minWidth: '30px', textAlign: 'center' }}>
                            {item.icon}
                        </span>
                        {isOpen && <span style={{ marginLeft: '10px' }}>{item.name}</span>}
                    </Link>
                ))}
            </nav>

            {/* --- LOGOUT SECTION --- */}
            {/* This div pushes itself to the bottom of the flex container */}
            <div style={logoutSectionStyle}>
                <hr style={{ borderColor: '#34495e', marginBottom: '15px' }} />
                
                <div 
                    onClick={onLogout} 
                    style={logoutButtonStyle(isOpen)}
                    title={!isOpen ? "Logout" : ""}
                >
                    <span style={{ fontSize: '20px', minWidth: '30px', textAlign: 'center' }}>
                        🚪
                    </span>
                    {isOpen && <span style={{ marginLeft: '10px' }}>Logout</span>}
                </div>

                {/* Footer labels */}
                {isOpen && (
                    <div style={footerTextStyle}>
                        <p>Manager Access</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Dynamic and Static Styles ---

const sidebarStyle = (isOpen) => ({
    width: isOpen ? '240px' : '70px',
    height: '100vh',
    backgroundColor: '#2c3e50',
    color: '#fff',
    position: 'fixed',
    left: 0,
    top: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 10px',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 1001,
    boxSizing: 'border-box',
    boxShadow: '2px 0 5px rgba(0,0,0,0.1)'
});

const toggleBtnStyle = {
    position: 'absolute',
    right: '-15px',
    top: '30px',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    zIndex: 1002
};

const logoStyle = (isOpen) => ({
    fontSize: isOpen ? '20px' : '14px',
    fontWeight: 'bold',
    marginBottom: '30px',
    color: '#3498db',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden'
});

const linkStyle = (isActive, isOpen) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    marginBottom: '10px',
    backgroundColor: isActive ? '#3498db' : 'transparent',
    transition: 'background-color 0.2s',
    justifyContent: isOpen ? 'flex-start' : 'center',
    overflow: 'hidden'
});

// Logout specific styles
const logoutSectionStyle = {
    marginTop: 'auto', // Pushes section to the bottom
    paddingBottom: '10px'
};

const logoutButtonStyle = (isOpen) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    color: '#e74c3c', // Red color for logout
    cursor: 'pointer',
    borderRadius: '8px',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
    justifyContent: isOpen ? 'flex-start' : 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.1)', // Subtle red background
});

const footerTextStyle = {
    marginTop: '10px',
    fontSize: '10px',
    color: '#bdc3c7',
    textAlign: 'center',
    whiteSpace: 'nowrap'
};

export default Sidebar;