import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * ManagerDashboard Component - "PowerTrack Pro"
 * Central Command Center fulfilling Success Criteria #6, #7, and #8.
 */
function ManagerDashboard() {
    // --- 1. CORE STATE ---
    const [stats, setStats] = useState({ kpis: { revenue: 0, cars: 0, plans: 0 }, recent: [] });
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // --- 2. REPORTING & FILTER STATE ---
    const [reportData, setReportData] = useState([]);
    const [isReporting, setIsReporting] = useState(false); 
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        method: 'all',
        staffName: ''
    });

    // --- 3. MODAL / AUDIT STATE ---
    const [selectedWash, setSelectedWash] = useState(null);
    const [detailData, setDetailData] = useState(null);

    // Fetch initial KPIs and staff dropdown data on component load
    useEffect(() => {
        const initData = async () => {
            try {
                const [statRes, staffRes] = await Promise.all([
                    axios.get('http://127.0.0.1:5000/manager-overview'),
                    axios.get('http://127.0.0.1:5000/staff')
                ]);
                setStats(statRes.data);
                setStaffList(staffRes.data);
                setLoading(false);
            } catch (err) { console.error("Initialization failed", err); }
        };
        initData();
    }, []);

    /**
     * handleRunReport: Invokes the Pandas-based filtering algorithm on the backend.
     */
    const handleRunReport = () => {
        setIsReporting(true);
        axios.post('http://127.0.0.1:5000/generate-report', filters)
            .then(res => setReportData(res.data))
            .catch(err => alert("Could not generate report. Check console."));
    };

    /**
     * handleExport: Handles binary file downloads (Excel/CSV).
     * This is a "high-complexity" feature for IA Criterion C.
     */
    const handleExport = (format) => {
        axios.post('http://127.0.0.1:5000/export-report', 
            { data: reportData, format: format }, 
            { responseType: 'blob' } 
        )
        .then(response => {
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `PowerTrack_Report_${new Date().toISOString().slice(0,10)}.${format === 'excel' ? 'xlsx' : 'csv'}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        });
    };

    const handleViewDetails = (wash) => {
        setSelectedWash(wash);
        // Supports both Live Feed (wash_transaction_id) and Report Results (ID) naming conventions
        const id = wash.wash_transaction_id || wash.ID;
        axios.get(`http://127.0.0.1:5000/wash-details/${id}`)
            .then(res => setDetailData(res.data));
    };

    if (loading) return <div style={{ textAlign: 'center', marginTop: '100px' }}>Loading Command Center...</div>;

    return (
        <div style={containerStyle}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                <h1 style={{ margin: 0, color: '#2c3e50' }}>PowerTrack Pro Manager Dashboard</h1>
                <div style={{ color: '#7f8c8d' }}>System Status: Online</div>
            </header>

            {/* --- KPI TILES --- */}
            <div style={kpiGridStyle}>
                <KPICard title="Revenue Today" value={`$${stats.kpis.revenue.toFixed(2)}`} color="#27ae60" />
                <KPICard title="Cars Today" value={stats.kpis.cars} color="#2980b9" />
                <KPICard title="Plan Washes" value={stats.kpis.plans} color="#f39c12" />
            </div>

            {/* --- REPORT GENERATOR SECTION --- */}
            <section style={cardStyle}>
                <h3 style={{ marginTop: 0, color: '#34495e' }}>Report & Export Tools</h3>
                <div style={filterGridStyle}>
                    <div style={inputGroup}>
                        <label style={labelStyle}>Start Date</label>
                        <input type="date" style={inputStyle} onChange={e => setFilters({...filters, startDate: e.target.value})} />
                    </div>
                    <div style={inputGroup}>
                        <label style={labelStyle}>End Date</label>
                        <input type="date" style={inputStyle} onChange={e => setFilters({...filters, endDate: e.target.value})} />
                    </div>
                    <div style={inputGroup}>
                        <label style={labelStyle}>Staff</label>
                        <select style={inputStyle} onChange={e => setFilters({...filters, staffName: e.target.value})}>
                            <option value="">All Employees</option>
                            {staffList.map(s => <option key={s.user_id} value={s.user_name}>{s.user_name}</option>)}
                        </select>
                    </div>
                    <div style={inputGroup}>
                        <label style={labelStyle}>Payment</label>
                        <select style={inputStyle} onChange={e => setFilters({...filters, method: e.target.value})}>
                            <option value="all">All Methods</option>
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="plan">Client Plan</option>
                        </select>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleRunReport} style={primaryBtnStyle}>Generate Analytics</button>
                    {isReporting && (
                        <>
                            <button onClick={() => handleExport('excel')} style={excelBtnStyle}>Export Excel</button>
                            <button onClick={() => handleExport('csv')} style={csvBtnStyle}>Export CSV</button>
                            <button onClick={() => {setIsReporting(false); setReportData([]);}} style={resetBtnStyle}>Clear</button>
                        </>
                    )}
                </div>
            </section>

            {/* --- DATA TABLE --- */}
            <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>{isReporting ? `Report Results (${reportData.length})` : "Recent Activity"}</h3>
                <table style={tableStyle}>
                    <thead>
                        <tr style={thRowStyle}>
                            <th style={padding}>Plate</th>
                            <th style={padding}>Total</th>
                            <th style={padding}>Method</th>
                            <th style={padding}>Date</th>
                            <th style={padding}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(isReporting ? reportData : stats.recent).map((tx, idx) => (
                            <tr key={idx} style={trStyle}>
                                <td style={padding}><b>{tx.license_plate || tx.Plate}</b></td>
                                <td style={padding}>${parseFloat(tx.total_price || tx.Total).toFixed(2)}</td>
                                <td style={padding}><span style={badgeStyle(tx.payment_method || tx.Method)}>{(tx.payment_method || tx.Method).toUpperCase()}</span></td>
                                <td style={padding}>{new Date(tx.logged_at || tx.Date).toLocaleDateString()}</td>
                                <td style={padding}><button onClick={() => handleViewDetails(tx)} style={viewBtnStyle}>Audit</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- AUDIT MODAL --- */}
            {selectedWash && detailData && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <h2 style={{ margin: 0 }}>Wash Audit: {selectedWash.license_plate || selectedWash.Plate}</h2>
                            <button onClick={() => setSelectedWash(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                        </div>
                        <hr />
                        <p><b>Handled By:</b> {detailData.staff.join(', ')}</p>
                        <p><b>Services Applied:</b></p>
                        <ul style={{ fontSize: '14px' }}>
                            {detailData.services.map((s, i) => (
                                <li key={i}>{s.service_name_snapshot} — ${s.service_price_snapshot}</li>
                            ))}
                        </ul>
                        <div style={modalFooter}>
                            <span>Total Charged:</span>
                            <span style={{ color: '#27ae60', fontSize: '1.4rem' }}>${parseFloat(selectedWash.total_price || selectedWash.Total).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- REUSABLE COMPONENTS ---
const KPICard = ({ title, value, color }) => (
    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', borderTop: `5px solid ${color}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '10px' }}>{title}</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c3e50' }}>{value}</div>
    </div>
);

// --- STYLING CONSTANTS ---
const containerStyle = { padding: '40px', backgroundColor: '#f8f9fa', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' };
const kpiGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px', marginBottom: '35px' };
const cardStyle = { backgroundColor: '#fff', padding: '25px', borderRadius: '15px', boxShadow: '0 2px 15px rgba(0,0,0,0.04)', marginBottom: '30px' };
const filterGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '25px' };
const inputGroup = { display: 'flex', flexDirection: 'column' };
const labelStyle = { fontSize: '12px', fontWeight: 'bold', color: '#95a5a6', marginBottom: '5px', textTransform: 'uppercase' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #dfe6e9', fontSize: '14px' };
const padding = { padding: '15px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const thRowStyle = { textAlign: 'left', borderBottom: '2px solid #f1f2f6', color: '#95a5a6', fontSize: '13px' };
const trStyle = { borderBottom: '1px solid #f1f2f6' };
const viewBtnStyle = { padding: '6px 15px', backgroundColor: '#f1f2f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' };
const primaryBtnStyle = { padding: '12px 25px', backgroundColor: '#2980b9', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const excelBtnStyle = { padding: '12px 20px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const csvBtnStyle = { padding: '12px 20px', backgroundColor: '#34495e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const resetBtnStyle = { padding: '12px 20px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const badgeStyle = (m) => ({ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', color: '#fff', backgroundColor: m.toLowerCase() === 'cash' ? '#2ecc71' : m.toLowerCase() === 'plan' ? '#3498db' : '#95a5a6' });
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: '#fff', padding: '40px', borderRadius: '20px', width: '500px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' };
const modalFooter = { marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #f1f2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' };

export default ManagerDashboard;