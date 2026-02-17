import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Collapsible Sidebar Component
 * Fulfills Success Criterion #10: Optimizing screen real estate for touch/mobile.
 * Receives 'isOpen' and 'setIsOpen' as props from App.js (Lifting State Up).
 */
function Sidebar({ isOpen, setIsOpen }) {
    const location = useLocation();

    // Navigation configuration array - makes it easy to add new pages
    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: '📊' },
        { name: 'Daily Worksheet', path: '/worksheet', icon: '📝' },
        { name: 'Client Plans', path: '/plans', icon: '🏢' },
        { name: 'Staff Management', path: '/staff', icon: '👥' },
    ];

    // Toggle function uses the setter passed from the parent (App.js)
    const toggleSidebar = () => setIsOpen(!isOpen);

    return (
        <div style={sidebarStyle(isOpen)}>
            {/* Toggle Button: Positioned on the edge of the sidebar */}
            <button onClick={toggleSidebar} style={toggleBtnStyle}>
                {isOpen ? '◀' : '▶'}
            </button>

            {/* Logo/Branding: Shrinks to initials when collapsed */}
            <div style={logoStyle(isOpen)}>
                {isOpen ? 'PowerTrack Pro' : 'PTP'}
            </div>

            <nav style={{ marginTop: '20px' }}>
                {navItems.map((item) => (
                    <Link 
                        key={item.path} 
                        to={item.path} 
                        style={linkStyle(location.pathname === item.path, isOpen)}
                        title={!isOpen ? item.name : ""} // Browser tooltip for collapsed mode
                    >
                        {/* Icon is always visible */}
                        <span style={{ fontSize: '20px', minWidth: '30px', textAlign: 'center' }}>
                            {item.icon}
                        </span>
                        
                        {/* Text label is conditionally rendered based on state */}
                        {isOpen && <span style={{ marginLeft: '10px' }}>{item.name}</span>}
                    </Link>
                ))}
            </nav>

            {/* Footer info only appears in expanded mode to prevent overflow issues */}
            {isOpen && (
                <div style={footerStyle}>
                    <hr style={{ borderColor: '#34495e', margin: '20px 0' }} />
                    <p>Manager Access</p>
                </div>
            )}
        </div>
    );
}

// --- Dynamic and Static Styles ---

/**
 * Sidebar container style
 * Uses the isOpen boolean to toggle width and applies a CSS transition.
 */
const sidebarStyle = (isOpen) => ({
    width: isOpen ? '240px' : '70px',
    height: '100vh',
    backgroundColor: '#2c3e50',
    color: '#fff',
    position: 'fixed', // Keeps navigation accessible while scrolling content
    left: 0,
    top: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 10px',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // Smooth "sliding" animation
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

/**
 * Link styling
 * Changes background color if the link's path matches the current URL.
 */
const linkStyle = (isActive, isOpen) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    marginBottom: '10px',
    backgroundColor: isActive ? '#3498db' : 'transparent', // Highlight active page
    transition: 'background-color 0.2s',
    justifyContent: isOpen ? 'flex-start' : 'center',
    overflow: 'hidden'
});

const footerStyle = {
    marginTop: 'auto',
    fontSize: '10px',
    color: '#bdc3c7',
    textAlign: 'center',
    whiteSpace: 'nowrap'
};

export default Sidebar;