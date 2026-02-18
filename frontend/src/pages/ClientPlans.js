import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SignaturePad from 'react-signature-canvas';

function ClientPlans() {
    // --- 1. State Management ---
    const [plans, setPlans] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [selectedPlanVehicles, setSelectedPlanVehicles] = useState([]);
    
    // Form State for New Plan
    const [newPlan, setNewPlan] = useState({
        client_name: '',
        billing_cycle: 'Monthly', // Matches ENUM
        contact_email: '',
        contact_phone: '',
        vehicles: []
    });

    // Temporary state for the vehicle being added to the list
    const [tempVehicle, setTempVehicle] = useState({
        category_id: '',
        make_model: '',
        license_plate: ''
    });

    const sigPad = useRef({});

    // --- 2. Data Fetching ---
    useEffect(() => {
        fetchPlans();
        fetchCategories();
    }, []);

    const fetchPlans = () => {
        axios.get('http://127.0.0.1:5000/api/plans')
            .then(res => setPlans(res.data))
            .catch(err => console.error("Error fetching plans:", err));
    };

    const fetchCategories = () => {
        axios.get('http://127.0.0.1:5000/api/categories')
            .then(res => setCategories(res.data));
    };

    // --- 3. Logic Handlers ---
    const addVehicleToTempList = () => {
        if (!tempVehicle.category_id || !tempVehicle.license_plate) {
            alert("Please select a category and enter a license plate.");
            return;
        }
        setNewPlan({
            ...newPlan,
            vehicles: [...newPlan.vehicles, tempVehicle]
        });
        setTempVehicle({ category_id: '', make_model: '', license_plate: '' });
    };

    const submitPlan = () => {
        if (sigPad.current.isEmpty()) {
            alert("Please provide a signature to authorize the agreement.");
            return;
        }

        if (newPlan.vehicles.length === 0) {
            alert("A plan must have at least one vehicle.");
            return;
        }

        // Prepare data (Handling Nullables for Email/Phone)
        const payload = {
            ...newPlan,
            contact_email: newPlan.contact_email || null,
            contact_phone: newPlan.contact_phone || null,
            signature: sigPad.current.getTrimmedCanvas().toDataURL('image/png')
        };

        axios.post('http://127.0.0.1:5000/api/plans/create', payload)
            .then(() => {
                alert("Client Plan Activated Successfully!");
                setShowCreateModal(false);
                fetchPlans();
                // Reset Form
                setNewPlan({ client_name: '', billing_cycle: 'Monthly', contact_email: '', contact_phone: '', vehicles: [] });
            })
            .catch(err => alert("Error saving plan. Check console."));
    };

    const togglePlanStatus = (planId, currentStatus) => {
        const newStatus = currentStatus === 1 ? 0 : 1;
        axios.post('http://127.0.0.1:5000/api/update-plan-status', { plan_id: planId, status: newStatus })
            .then(() => fetchPlans());
    };

    // --- 4. Render ---
    return (
        <div style={{ padding: '30px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2>Client Plan Management</h2>
                <button onClick={() => setShowCreateModal(true)} style={addBtnStyle}>+ New Agreement</button>
            </div>

            {/* Plans Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <thead style={{ backgroundColor: '#2c3e50', color: '#fff' }}>
                    <tr>
                        <th style={thStyle}>Client Name</th>
                        <th style={thStyle}>Billing</th>
                        <th style={thStyle}>Email</th>
                        <th style={thStyle}>Vehicles</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {plans.map(plan => (
                        <tr key={plan.client_plan_id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{plan.client_name}</td>
                            <td style={tdStyle}>{plan.billing_cycle_type}</td>
                            <td style={tdStyle}>{plan.contact_email || 'N/A'}</td>
                            <td style={tdStyle}>{plan.vehicle_count} Cars</td>
                            <td style={tdStyle}>
                                <span style={plan.is_active ? activeLabel : inactiveLabel}>
                                    {plan.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td style={tdStyle}>
                                <button onClick={() => togglePlanStatus(plan.client_plan_id, plan.is_active)} style={statusBtnStyle}>
                                    Toggle Status
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Create Plan Modal */}
            {showCreateModal && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <h3>New Service Agreement</h3>
                        
                        <div style={formGrid}>
                            <input 
                                placeholder="Client/Company Name" 
                                style={inputStyle} 
                                onChange={e => setNewPlan({...newPlan, client_name: e.target.value})}
                            />
                            <select 
                                style={inputStyle} 
                                onChange={e => setNewPlan({...newPlan, billing_cycle: e.target.value})}
                            >
                                <option value="Monthly">Monthly Billing</option>
                                <option value="Weekly">Weekly Billing</option>
                            </select>
                            <input 
                                placeholder="Email (Optional)" 
                                style={inputStyle} 
                                onChange={e => setNewPlan({...newPlan, contact_email: e.target.value})}
                            />
                            <input 
                                placeholder="Phone (Optional)" 
                                style={inputStyle} 
                                onChange={e => setNewPlan({...newPlan, contact_phone: e.target.value})}
                            />
                        </div>

                        <div style={vehicleSection}>
                            <h4>Add Vehicles to Plan</h4>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <select 
                                    style={{ flex: 1, padding: '8px' }}
                                    value={tempVehicle.category_id}
                                    onChange={e => setTempVehicle({...tempVehicle, category_id: e.target.value})}
                                >
                                    <option value="">Select Category</option>
                                    {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                                </select>
                                <input 
                                    placeholder="Make/Model" 
                                    style={{ flex: 1, padding: '8px' }} 
                                    value={tempVehicle.make_model}
                                    onChange={e => setTempVehicle({...tempVehicle, make_model: e.target.value})}
                                />
                                <input 
                                    placeholder="Plate #" 
                                    style={{ flex: 1, padding: '8px' }} 
                                    value={tempVehicle.license_plate}
                                    onChange={e => setTempVehicle({...tempVehicle, license_plate: e.target.value})}
                                />
                                <button onClick={addVehicleToTempList} style={addVehBtn}>Add</button>
                            </div>
                            
                            <div style={chipContainer}>
                                {newPlan.vehicles.map((v, i) => (
                                    <span key={i} style={chip}>{v.license_plate} ({v.make_model})</span>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginTop: '20px' }}>
                            <label>Authorized Signature:</label>
                            <div style={{ border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px' }}>
                                <SignaturePad ref={sigPad} canvasProps={{ width: 640, height: 150, className: 'sigCanvas' }} />
                            </div>
                            <button onClick={() => sigPad.current.clear()} style={{ fontSize: '12px', marginTop: '5px' }}>Clear Signature</button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setShowCreateModal(false)} style={cancelBtn}>Cancel</button>
                            <button onClick={submitPlan} style={saveBtn}>Activate Agreement</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Styles ---
const thStyle = { padding: '15px', textAlign: 'left', borderBottom: '2px solid #ddd' };
const tdStyle = { padding: '15px' };
const inputStyle = { padding: '10px', borderRadius: '4px', border: '1px solid #ddd' };
const formGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: '#fff', padding: '30px', borderRadius: '12px', width: '700px', maxHeight: '90vh', overflowY: 'auto' };
const vehicleSection = { backgroundColor: '#f1f2f6', padding: '15px', borderRadius: '8px' };
const chipContainer = { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' };
const chip = { backgroundColor: '#3498db', color: '#fff', padding: '5px 10px', borderRadius: '15px', fontSize: '12px' };

const addBtnStyle = { padding: '10px 20px', backgroundColor: '#2ecc71', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const statusBtnStyle = { padding: '5px 10px', backgroundColor: '#95a5a6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' };
const addVehBtn = { padding: '8px 15px', backgroundColor: '#34495e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const saveBtn = { padding: '12px 25px', backgroundColor: '#2ecc71', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const cancelBtn = { padding: '12px 25px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' };

const activeLabel = { backgroundColor: '#d4edda', color: '#155724', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' };
const inactiveLabel = { backgroundColor: '#f8d7da', color: '#721c24', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' };

export default ClientPlans;