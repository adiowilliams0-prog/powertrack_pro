import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * StaffManagement Component
 * Handles Success Criterion #1 (User Registration) and #6 (Staff Activation/Deactivation).
 * Features: Role-based creation, Password length validation, and Searchable directory.
 */
const StaffManagement = () => {
    // --- State Management ---
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Form state matches the 'users' table schema + confirmation field for UX
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        role: 'Detailer',
        password: '',
        confirmPassword: ''
    });

    // Load users from MySQL via Flask API on component mount
    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:5000/api/users');
            setUsers(response.data);
        } catch (err) {
            console.error("Error fetching users", err);
        }
    };

    // --- Form Actions ---
    
    // Updates local state as user types, utilizing computed property names [e.target.name]
    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();

        // 1. FRONTEND VALIDATION: Password Length (Success Criterion #2 - Security)
        // Ensures complexity before reaching the server
        if (formData.password.length < 8) {
            alert("Security Requirement: Password must be at least 8 characters long.");
            return;
        }

        // 2. FRONTEND VALIDATION: Password Matching
        if (formData.password !== formData.confirmPassword) {
            alert("Validation Error: Passwords do not match!");
            return;
        }

        // 3. User Confirmation Dialog for critical actions
        const confirmMsg = `Create ${formData.role} account for ${formData.firstName} ${formData.lastName}?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            // POST to backend where password will be hashed using PBKDF2
            await axios.post('http://127.0.0.1:5000/api/users/create', formData);
            alert("User created successfully!");
            
            // Reset form and refresh list
            setFormData({ firstName: '', lastName: '', role: 'Detailer', password: '', confirmPassword: '' });
            fetchUsers(); 
        } catch (err) {
            // Error handling for unique username constraints or server issues
            alert("Error creating user. The auto-generated username base might be full or server is offline.");
        }
    };

    /**
     * Toggles 'is_active' status in the DB.
     * Prevents system lockout by checking if the user is the last active Manager (logic handled in backend).
     */
    const toggleUserStatus = async (user) => {
        const action = user.is_active ? 'deactivate' : 'activate';
        if (!window.confirm(`Are you sure you want to ${action} ${user.full_name}?`)) return;

        try {
            await axios.post(`http://127.0.0.1:5000/api/users/toggle/${user.user_id}`);
            fetchUsers();
        } catch (err) {
            // Displays specific error messages (e.g., "Cannot deactivate last Manager")
            const errorMsg = err.response?.data?.message || "Failed to update user status.";
            alert(errorMsg);
        }
    };

    // --- Search Logic (Case-insensitive filtering) ---
    const filteredUsers = users.filter(u => 
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={containerStyle}>
            {/* LEFT SIDE: ADD NEW USER (INPUT AREA) */}
            <div style={leftPaneStyle}>
                <h2 style={titleStyle}>Add New User</h2>
                <form onSubmit={handleCreateUser} style={formStyle}>
                    <input type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleInputChange} required style={inputStyle} />
                    <input type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleInputChange} required style={inputStyle} />
                    
                    <label style={labelStyle}>System Role</label>
                    <select name="role" value={formData.role} onChange={handleInputChange} style={inputStyle}>
                        <option value="Detailer">Detailer</option>
                        <option value="Manager">Manager</option>
                    </select>

                    <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleInputChange} required style={inputStyle} />
                    
                    {/* DYNAMIC VISUAL FEEDBACK: Strength Indicator */}
                    <p style={{ 
                        fontSize: '12px', 
                        color: formData.password.length >= 8 ? '#2ecc71' : '#e74c3c',
                        marginTop: '-10px',
                        marginBottom: '5px'
                    }}>
                        {formData.password.length >= 8 
                            ? "✔ Password length requirement met" 
                            : "✖ Password must be at least 8 characters"}
                    </p>

                    <input type="password" name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleInputChange} required style={inputStyle} />
                    
                    <button type="submit" style={submitBtnStyle}>Create Account</button>
                </form>
            </div>

            {/* RIGHT SIDE: USER LIST (DIRECTORY AREA) */}
            <div style={rightPaneStyle}>
                <div style={listHeaderStyle}>
                    <h2>Staff Directory</h2>
                    <input 
                        type="text" 
                        placeholder="Search by name or username..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        style={searchBarStyle}
                    />
                </div>

                <div style={tableContainerStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={headerRowStyle}>
                                <th>Role</th>
                                <th>Full Name</th>
                                <th>Username</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user.user_id} style={rowStyle}>
                                    <td style={roleBadgeStyle(user.role)}>
                                        {user.role === 'Manager' ? 'M' : 'D'}
                                    </td>
                                    <td>{user.full_name}</td>
                                    <td style={usernameStyle}>{user.username}</td>
                                    <td>
                                        <button 
                                            onClick={() => toggleUserStatus(user)}
                                            style={toggleBtnStyle(user.is_active)}
                                        >
                                            {user.is_active ? 'Active' : 'Deactivated'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- STYLES (Modular Internal CSS) ---
const containerStyle = { display: 'flex', height: '100vh', backgroundColor: '#f4f7f6' };
const leftPaneStyle = { width: '350px', padding: '40px', backgroundColor: '#fff', boxShadow: '2px 0 10px rgba(0,0,0,0.05)', zIndex: 1 };
const rightPaneStyle = { flex: 1, padding: '40px', overflowY: 'auto' };
const titleStyle = { color: '#2c3e50', marginBottom: '30px' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const labelStyle = { fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d', marginBottom: '-10px' };
const inputStyle = { padding: '12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' };
const submitBtnStyle = { padding: '14px', backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' };
const listHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const searchBarStyle = { padding: '10px', width: '250px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' };
const tableContainerStyle = { backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const headerRowStyle = { borderBottom: '2px solid #f4f7f6', color: '#7f8c8d', fontSize: '13px' };
const rowStyle = { borderBottom: '1px solid #f4f7f6' };
const usernameStyle = { fontFamily: 'monospace', color: '#e67e22' };

const roleBadgeStyle = (role) => ({
    fontWeight: 'bold',
    color: role === 'Manager' ? '#e74c3c' : '#2ecc71',
    textAlign: 'center',
    width: '40px'
});

const toggleBtnStyle = (isActive) => ({
    padding: '6px 12px',
    borderRadius: '20px',
    border: 'none',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    backgroundColor: isActive ? '#d4edda' : '#f8d7da',
    color: isActive ? '#155724' : '#721c24',
    transition: '0.2s'
});

export default StaffManagement;