import React, { useState, useEffect } from 'react';
import axios from 'axios';

const StaffManagement = () => {
    // --- State Management ---
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        role: 'Detailer',
        password: '',
        confirmPassword: ''
    });

    // Load users on component mount
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
    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();

        // 1. Password Matching Validation
        if (formData.password !== formData.confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        // 2. Before created confirmation
        const confirmMsg = `Create ${formData.role} account for ${formData.firstName} ${formData.lastName}?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            await axios.post('http://127.0.0.1:5000/api/users/create', formData);
            alert("User created successfully!");
            setFormData({ firstName: '', lastName: '', role: 'Detailer', password: '', confirmPassword: '' });
            fetchUsers(); // Refresh the list on the right
        } catch (err) {
            alert("Error creating user. Username base might be full.");
        }
    };

    const toggleUserStatus = async (user) => {
        // Before status changed confirmation
        const action = user.is_active ? 'deactivate' : 'activate';
        if (!window.confirm(`Are you sure you want to ${action} ${user.full_name}?`)) return;

        try {
            await axios.post(`http://127.0.0.1:5000/api/users/toggle/${user.user_id}`);
            fetchUsers();
        } catch (err) {
            alert("Failed to update user status.");
        }
    };

    // --- Search Logic ---
    const filteredUsers = users.filter(u => 
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={containerStyle}>
            {/* LEFT SIDE: ADD NEW USER */}
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
                    <input type="password" name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleInputChange} required style={inputStyle} />
                    
                    <button type="submit" style={submitBtnStyle}>Create Account</button>
                </form>
            </div>

            {/* RIGHT SIDE: USER LIST */}
            <div style={rightPaneStyle}>
                <div style={listHeaderStyle}>
                    <h2>Staff Directory</h2>
                    <input 
                        type="text" 
                        placeholder="Search users..." 
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
                                    <td>{user.user_name}</td>
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

// --- STYLES ---
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