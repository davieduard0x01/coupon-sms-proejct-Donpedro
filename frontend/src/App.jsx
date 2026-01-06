// ARQUIVO: frontend/src/App.jsx (VERSÃO FINAL: LOGO PADRÃO)

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react'; 
import './App.css'; 

// --- PRODUCTION URL ---
const API_BASE_URL = 'https://coupon-sms-proejct-donpedro.onrender.com';
const API_SEND_OTP = `${API_BASE_URL}/api/send-otp`;
const API_CHECK_OTP = `${API_BASE_URL}/api/check-otp`;
// -----------------------

// Component to display existing coupons (Duplicate Handling)
const UserCuponsList = ({ cupons, onViewQR }) => ( 
    <div className="coupon-list-wrapper">
        <h2>My Coupons</h2>
        <p className="list-intro">You are already registered. Here are your coupons:</p>
        <div className="coupon-grid">
            {cupons.map((coupon) => (
                <div 
                    key={coupon.coupon_uuid} 
                    className={`coupon-card status-${coupon.status_uso.toLowerCase().replace('_', '-')}`}
                    onClick={() => coupon.status_uso === 'NAO_UTILIZADO' && onViewQR(coupon.coupon_uuid)} 
                    style={{ cursor: coupon.status_uso === 'NAO_UTILIZADO' ? 'pointer' : 'default' }}
                >
                    <p className="status-label">
                        {coupon.status_uso === 'NAO_UTILIZADO' ? 'ACTIVE' : coupon.status_uso.replace('_', ' ')}
                    </p>
                    <p className="coupon-code-display">{coupon.coupon_code} ({coupon.coupon_uuid.substring(0, 8)}...)</p>
                    {coupon.status_uso === 'NAO_UTILIZADO' ? (
                        <p className="print-info">Click to view valid QR Code again.</p>
                    ) : (
                        <p className="print-info">This coupon has been {coupon.status_uso.toLowerCase()}.</p>
                    )}
                </div>
            ))}
        </div>
        <p className="note">If you lost your valid QR Code, please contact support.</p>
    </div>
);


function App() {
  // --- FORM DATA ---
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // --- CONTROL STATES ---
  const [currentPhase, setCurrentPhase] = useState('cadastro'); // 'cadastro', 'validacao', 'qrcode'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState(''); 
  
  // --- RESULT STATES ---
  const [couponUUID, setCouponUUID] = useState(null);
  const [couponCode, setCouponCode] = useState(null); 
  const [existingUserCupons, setExistingUserCupons] = useState(null);
  const [duplicityMessage, setDuplicityMessage] = useState('');


  // Function to view QR Code of an existing coupon
  const handleViewQR = (uuid) => {
    const validCoupon = existingUserCupons.find(c => c.coupon_uuid === uuid);

    setCouponUUID(uuid);
    setCouponCode(validCoupon ? validCoupon.coupon_code : 'D0nP3dro20');
    setMessage("Your valid coupon has been retrieved.");
    setCurrentPhase('qrcode');
    setExistingUserCupons(null); 
  };


  // ----------------------------------------------------------------------
  // --- PHASE 1: SEND DATA AND REQUEST OTP ---
  // ----------------------------------------------------------------------
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setDuplicityMessage('');
    setExistingUserCupons(null); 

    try {
      const response = await fetch(API_SEND_OTP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, address }), 
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(data.message || 'Verification code sent!');
        setCurrentPhase('validacao');
        
      } else if (response.status === 409) {
        setDuplicityMessage(data.message || 'User already registered.'); 
        setExistingUserCupons(data.cupons); 
        
      } else {
        setMessage(`Failed to send code: ${data.message}.`);
      }
    } catch (error) {
      console.error('Request Error (Send OTP):', error);
      setMessage('Connection error with the server.');
    } finally {
      setLoading(false);
    }
  };


  // ----------------------------------------------------------------------
  // --- PHASE 2: VALIDATE OTP AND FINISH REGISTRATION ---
  // ----------------------------------------------------------------------
  const handleCheckOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (otpCode.length !== 6) {
        setMessage('Code must be 6 digits.');
        setLoading(false);
        return;
    }
    
    const finalData = { name, phone, address, code: otpCode };

    try {
      const response = await fetch(API_CHECK_OTP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData), 
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(data.message || 'Success!'); 
        setCouponUUID(data.couponUUID); 
        setCouponCode(data.couponCode); 
        setCurrentPhase('qrcode'); 
        
      } else {
        setMessage(data.message || 'Invalid code. Please try again.');
      }
    } catch (error) {
      console.error('Request Error (Check OTP):', error);
      setMessage('Connection error during validation.');
    } finally {
      setLoading(false);
    }
  };


  // ----------------------------------------------------------------------
  // --- SCREEN RENDERING LOGIC ---
  // ----------------------------------------------------------------------

  // --- SCREEN 1.1: DUPLICATE DETECTED ---
  if (existingUserCupons) {
      return (
        <div className="container duplication-container">
            {/* LOGO VOLTOU AO NORMAL (SEM STYLE FIXO) */}
            <img 
                src="/logo.svg" 
                alt="DONPEDRO" 
                className="brand-logo" 
            /> 
            
            <h1 className="main-title-error">Attention!</h1>
            <span className="brand-name">{duplicityMessage}</span>
            
            <UserCuponsList cupons={existingUserCupons} onViewQR={handleViewQR} />
            
            <button 
                className="reset-button" 
                onClick={() => {
                    setExistingUserCupons(null); 
                    setDuplicityMessage('');
                    setMessage('');
                }}
                style={{ marginTop: '20px' }}
            >
                TRY NEW REGISTRATION
            </button>
        </div>
      );
  }

  // --- SCREEN 2: OTP VALIDATION ---
  if (currentPhase === 'validacao') {
    return (
        <div className="container validation-container">
            {/* LOGO VOLTOU AO NORMAL (SEM STYLE FIXO) */}
            <img 
                src="/logo.svg" 
                alt="DONPEDRO" 
                className="brand-logo" 
            />
            <h1 className="main-title">Verification</h1>
            <span className="brand-name">DONPEDRO Security</span>

            <p className="instruction-text">{message}</p>
            
            <form onSubmit={handleCheckOtp}>
                <input
                    type="number" 
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit Code"
                    required
                    disabled={loading}
                    maxLength={6}
                    style={{ textAlign: 'center', fontSize: '1.2em' }}
                />
                <button type="submit" disabled={loading} style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}>
                    {loading ? 'Verifying...' : 'VALIDATE & FINISH'}
                </button>
            </form>
            
            <button className="reset-button" onClick={() => setCurrentPhase('cadastro')} style={{ marginTop: '15px' }}>
                Go Back
            </button>
        </div>
    );
  }

  // --- SCREEN 3: QR CODE (SUCCESS) ---
  if (currentPhase === 'qrcode') {
      return (
        <div className="container qr-display-container">
            <div className="success-icon-container">
                <span className="success-check-mark">✔</span>
            </div>
            <h1 className="main-title-qr">Coupon Generated!</h1>
            <span className="brand-name">DONPEDRO</span>
            <p className="success-message">{message}</p>

            <div className="qrcode-box">
                <QRCodeSVG
                    value={couponUUID} 
                    size={256}
                    level="H"
                    includeMargin={false} 
                />
            </div>
            
            <p className="instruction-small">Show this QR Code to the cashier. Valid for 1 use.</p>
            
            <button className="reset-button" onClick={() => setCurrentPhase('cadastro')}>
                BACK TO START
            </button>
        </div>
      );
  }


  // --- SCREEN 1: REGISTRATION (DEFAULT) ---
  return (
    <div className="container">
      {/* LOGO VOLTOU AO NORMAL (SEM STYLE FIXO) */}
      <img 
        src="/logo.svg" 
        alt="DONPEDRO" 
        className="brand-logo" 
      />
      
      <h1 className="main-title">GET EXCLUSIVE ACCESS</h1>
      
      <p style={{ marginTop: '10px', marginBottom: '20px' }}>
        Enter your information below to receive a security code via SMS.
      </p>
      
      <form onSubmit={handleSendOtp}> 
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
          required
          disabled={loading}
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone Number" 
          required
          disabled={loading}
        />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Your Address [Required]" 
          required
          disabled={loading}
        />
        {/* BOTÃO VERDE */}
        <button type="submit" disabled={loading} style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}>
          {loading ? 'Processing...' : 'GET MY CODE'}
        </button>
      </form>

      {message && <p className={`result-message ${couponUUID ? 'success' : 'error'}`}>{message}</p>}
      
      <p className="note">
        *Valid for U.S. phone numbers only (+1 country code).
      </p>
    </div>
  );
}

export default App;