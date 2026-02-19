import React, { useState, useEffect } from 'react';
import axios from 'axios';

function DailyWorksheet() {
    // --- Data Lists (Fetched from DB) ---
    const [staffList, setStaffList] = useState([]); 
    const [categories, setCategories] = useState([]);
    const [services, setServices] = useState([]);
    
    // --- Form State ---
    const [selectedStaff, setSelectedStaff] = useState([]); 
    const [selectedCategory, setSelectedCategory] = useState(''); 
    const [selectedServices, setSelectedServices] = useState([]); 
    const [totalPrice, setTotalPrice] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [notes, setNotes] = useState('');

    // --- Financial Adjustments State ---
    const [discount, setDiscount] = useState(0);
    const [discountReason, setDiscountReason] = useState('');
    const [fee, setFee] = useState(0);
    const [feeReason, setFeeReason] = useState('');

    // --- License Plate & Plan Logic State ---
    const [plate, setPlate] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [planDetails, setPlanDetails] = useState(null); 
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Initial data fetch
    useEffect(() => {
        axios.get('http://127.0.0.1:5000/staff').then(res => setStaffList(res.data));
        axios.get('http://127.0.0.1:5000/categories').then(res => setCategories(res.data));
        axios.get('http://127.0.0.1:5000/services').then(res => setServices(res.data));
    }, []);

    // --- ALGORITHM: License Plate Lookup ---
    const handlePlateInput = async (e) => {
        const input = typeof e === 'string' ? e : e.target.value;
        const normalizedPlate = input.toUpperCase().replace(/\s/g, '');
        setPlate(normalizedPlate);

        if (normalizedPlate.length >= 2) {
            try {
                const suggestRes = await axios.get(`http://127.0.0.1:5000/plate-suggestions?q=${normalizedPlate}`);
                setSuggestions(suggestRes.data);
                setShowSuggestions(true);

                const lookupRes = await axios.get(`http://127.0.0.1:5000/lookup-plate?plate=${normalizedPlate}`);
                if (lookupRes.data) {
                    setSelectedCategory(lookupRes.data.vehicle_category_id);
                    if (lookupRes.data.client_plan_id) {
                        setPlanDetails(lookupRes.data);
                        setPaymentMethod('Plan');
                    } else {
                        setPlanDetails(null);
                        setPaymentMethod('Cash');
                    }
                } else {
                    setPlanDetails(null);
                }
            } catch (err) { console.error("Lookup error", err); }
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    // --- ALGORITHM: Pricing Logic ---
    useEffect(() => {
        const calculateTotal = async () => {
            if (!selectedCategory || selectedServices.length === 0) {
                setTotalPrice(0);
                return;
            }
            let baseTotal = 0;
            for (const serviceId of selectedServices) {
                const res = await axios.post('http://127.0.0.1:5000/calculate-price', {
                    service_id: serviceId,
                    category_id: selectedCategory
                });
                baseTotal += res.data.price;
            }
            const finalTotal = (baseTotal + parseFloat(fee || 0)) - parseFloat(discount || 0);
            setTotalPrice(finalTotal > 0 ? finalTotal : 0);
        };
        calculateTotal();
    }, [selectedCategory, selectedServices, discount, fee]);

    // --- FINAL SUBMISSION LOGIC ---
    // Fulfills Success Criterion #3, #4, and #5
   const handleSubmit = async () => {
    // 1. SESSION RETRIEVAL
    // Fetch the token and user_id we saved in localStorage during handleLogin
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');

    // Safety check: If no token exists, the user shouldn't be submitting data
    if (!token || !userId) {
        alert("Session expired. Please log in again.");
        return;
    }

    // 2. Prepare Service Snapshots
    // We send the name and price as they are NOW to prevent historical data loss
    const serviceSnapshots = await Promise.all(selectedServices.map(async (sId) => {
        const serviceObj = services.find(s => s.service_id === sId);
        const priceRes = await axios.post('http://127.0.0.1:5000/calculate-price', {
            service_id: sId,
            category_id: selectedCategory
        });
        return {
            id: sId,
            name: serviceObj.service_name,
            price: priceRes.data.price
        };
    }));

    // 3. Bundle the payload
    // Replaced hardcoded creator_id with the dynamic userId from localStorage
    const payload = {
        plate: plate,
        category_id: selectedCategory,
        client_plan_id: planDetails ? planDetails.client_plan_id : null,
        staff_ids: selectedStaff,
        services: serviceSnapshots,
        total_price: totalPrice,
        payment_method: paymentMethod,
        discount: discount,
        discount_reason: discountReason,
        fee: fee,
        fee_reason: feeReason,
        notes: notes,
        creator_id: userId // DYNAMIC SESSION ID: Fulfills Criterion #5 & #8
    };

    try {
        // 4. AUTHORIZED REQUEST
        // We include the JWT in the Authorization header as a 'Bearer' token
        const response = await axios.post('http://127.0.0.1:5000/submit-wash', payload, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.data.status === 'success') {
            alert("Wash Record Submitted Successfully!");
            resetForm();
        }
    } catch (error) {
        // Handle unauthorized (401) or connection errors
        if (error.response && error.response.status === 401) {
            alert("Session invalid. Please log in again.");
        } else {
            console.error("Submission failed", error);
            alert("Error submitting record. Please check database connection.");
        }
    }
};
    // --- Form Reset Logic (Success Criterion #10) ---
    const resetForm = () => {
        setPlate('');
        setSelectedStaff([]);
        setSelectedCategory('');
        setSelectedServices([]);
        setTotalPrice(0);
        setPaymentMethod('Cash');
        setDiscount(0);
        setDiscountReason('');
        setFee(0);
        setFeeReason('');
        setNotes('');
        setPlanDetails(null);
    };

    const toggleSelection = (list, setList, id) => {
        setList(list.includes(id) ? list.filter(item => item !== id) : [...list, id]);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto', fontFamily: 'Arial, sans-serif' }}>
            <h2 style={{ borderBottom: '2px solid #0056b3', paddingBottom: '10px' }}>Daily Worksheet</h2>

            {/* SECTION 1: STAFF */}
            <section style={sectionStyle}>
                <h4 style={headerStyle}>1. Staff Assignment</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {staffList.map(user => (
                        <div key={user.user_id}>
                            <input type="checkbox" checked={selectedStaff.includes(user.user_id)} onChange={() => toggleSelection(selectedStaff, setSelectedStaff, user.user_id)} />
                            <label style={{ marginLeft: '5px' }}>{user.user_name}</label>
                        </div>
                    ))}
                </div>
            </section>

            {/* SECTION 2: VEHICLE */}
            <section style={sectionStyle}>
                <h4 style={headerStyle}>2. Vehicle Details</h4>
                <label>License Plate:</label>
                <div style={{ position: 'relative' }}>
                    <input type="text" value={plate} onChange={handlePlateInput} style={inputStyle} placeholder="Type Plate..." />
                    {showSuggestions && suggestions.length > 0 && (
                        <div style={suggestionBoxStyle}>
                            {suggestions.map(s => <div key={s} style={suggestionItemStyle} onClick={() => { handlePlateInput(s); setShowSuggestions(false); }}>{s}</div>)}
                        </div>
                    )}
                </div>
                <label style={{ display: 'block', marginTop: '15px' }}>Vehicle Category:</label>
                <select style={inputStyle} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                    <option value="">-- Select Category --</option>
                    {categories.map(cat => <option key={cat.vehicle_category_id} value={cat.vehicle_category_id}>{cat.category_name}</option>)}
                </select>
                {planDetails && (
                    <div style={planAlertStyle}>
                        <span>⭐ <b>PLAN ACTIVE:</b> {planDetails.client_name}</span>
                        <button style={detailBtnStyle} onClick={() => alert(`Plan: ${planDetails.client_name}\nCycle: ${planDetails.billing_cycle_type}`)}>View Details</button>
                    </div>
                )}
            </section>

            {/* SECTION 3: SERVICES */}
            <section style={sectionStyle}>
                <h4 style={headerStyle}>3. Services</h4>
                {services.map(ser => (
                    <div key={ser.service_id} style={{ marginBottom: '5px' }}>
                        <input type="checkbox" checked={selectedServices.includes(ser.service_id)} onChange={() => toggleSelection(selectedServices, setSelectedServices, ser.service_id)} />
                        <label style={{ marginLeft: '10px' }}>{ser.service_name}</label>
                    </div>
                ))}
            </section>

            {/* SECTION 4: ADJUSTMENTS */}
            <section style={sectionStyle}>
                <h4 style={headerStyle}>4. Financial Adjustments</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                        <label>Discount ($)</label>
                        <input type="number" style={inputStyle} value={discount} onChange={e => setDiscount(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label>Fee ($)</label>
                        <input type="number" style={inputStyle} value={fee} onChange={e => setFee(e.target.value)} />
                    </div>
                </div>
                {discount > 0 && <input type="text" placeholder="Discount Reason" style={{...inputStyle, marginTop: '10px'}} value={discountReason} onChange={e => setDiscountReason(e.target.value)} />}
                {fee > 0 && <input type="text" placeholder="Fee Reason" style={{...inputStyle, marginTop: '10px'}} value={feeReason} onChange={e => setFeeReason(e.target.value)} />}
            </section>

            {/* SECTION 5: FINALIZATION */}
            <section style={sectionStyle}>
                <h4 style={headerStyle}>5. Finalization</h4>
                <label>Payment Method:</label>
                <select style={inputStyle} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Plan">Plan</option>
                </select>
                <textarea placeholder="Notes (Optional)" style={{...inputStyle, marginTop: '15px', height: '60px'}} value={notes} onChange={e => setNotes(e.target.value)} />

                <div style={totalContainerStyle}>
                    <span style={{ fontSize: '1.1rem' }}>Total:</span>
                    <h2 style={{ margin: 0, color: '#28a745' }}>${totalPrice.toFixed(2)}</h2>
                </div>

                <button 
                    onClick={handleSubmit}
                    disabled={selectedStaff.length === 0 || !selectedCategory || selectedServices.length === 0 || !plate}
                    style={submitBtnStyle(selectedStaff.length > 0 && selectedCategory && selectedServices.length > 0 && plate)}
                >
                    Submit Wash Record
                </button>
            </section>
        </div>
    );
}

// --- Styles ---
const sectionStyle = { marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff' };
const headerStyle = { margin: '0 0 10px 0', color: '#0056b3' };
const inputStyle = { width: '100%', padding: '12px', marginTop: '5px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' };
const suggestionBoxStyle = { position: 'absolute', width: '100%', backgroundColor: 'white', border: '1px solid #ccc', zIndex: 100 };
const suggestionItemStyle = { padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' };
const planAlertStyle = { marginTop: '15px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const detailBtnStyle = { padding: '5px 10px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' };
const totalContainerStyle = { marginTop: '20px', padding: '15px', backgroundColor: '#f1f1f1', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const submitBtnStyle = (active) => ({
    marginTop: '15px', width: '100%', padding: '15px', fontSize: '18px', fontWeight: 'bold', border: 'none', borderRadius: '5px', color: 'white',
    backgroundColor: active ? '#28a745' : '#ccc', cursor: active ? 'pointer' : 'not-allowed'
});

export default DailyWorksheet;