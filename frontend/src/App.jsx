import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react'; 
import './App.css'; 

// --- URL DE PRODUÇÃO ---
const API_BASE_URL = 'https://coupon-sms-proejct-donpedro.onrender.com';
const API_SEND_OTP = `${API_BASE_URL}/api/send-otp`;
const API_CHECK_OTP = `${API_BASE_URL}/api/check-otp`;
// -----------------------

// Componente para exibir a lista de cupons existentes (Tratamento de Duplicidade)
const UserCuponsList = ({ cupons, onViewQR }) => ( 
    <div className="coupon-list-wrapper">
        <h2>Meus Cupons Cadastrados</h2>
        <p className="list-intro">Você já possui cadastro. Abaixo estão seus cupons:</p>
        <div className="coupon-grid">
            {cupons.map((coupon) => (
                <div 
                    key={coupon.coupon_uuid} 
                    className={`coupon-card status-${coupon.status_uso.toLowerCase().replace('_', '-')}`}
                    onClick={() => coupon.status_uso === 'NAO_UTILIZADO' && onViewQR(coupon.coupon_uuid)} 
                    style={{ cursor: coupon.status_uso === 'NAO_UTILIZADO' ? 'pointer' : 'default' }}
                >
                    <p className="status-label">{coupon.status_uso.replace('_', ' ')}</p>
                    <p className="coupon-code-display">{coupon.coupon_code} ({coupon.coupon_uuid.substring(0, 8)}...)</p>
                    {coupon.status_uso === 'NAO_UTILIZADO' ? (
                        <p className="print-info">Clique para ver o QR Code válido novamente.</p>
                    ) : (
                        <p className="print-info">Este cupom foi {coupon.status_uso.toLowerCase()}.</p>
                    )}
                </div>
            ))}
        </div>
        <p className="note">Se você perdeu seu QR Code válido, contate o suporte.</p>
    </div>
);


function App() {
  // --- DADOS DE CADASTRO (PERSISTEM ENTRE TELAS) ---
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // --- ESTADOS DE CONTROLE ---
  const [currentPhase, setCurrentPhase] = useState('cadastro'); // 'cadastro', 'validacao', 'qrcode'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState(''); // Código que o usuário digita
  
  // --- ESTADOS DE RESULTADO ---
  const [couponUUID, setCouponUUID] = useState(null);
  const [couponCode, setCouponCode] = useState(null); 
  const [existingUserCupons, setExistingUserCupons] = useState(null);
  const [duplicityMessage, setDuplicityMessage] = useState('');


  // Função para acionar a visualização do QR Code de um cupom já existente
  const handleViewQR = (uuid) => {
    const validCoupon = existingUserCupons.find(c => c.coupon_uuid === uuid);

    setCouponUUID(uuid);
    setCouponCode(validCoupon ? validCoupon.coupon_code : 'D0nP3dro20');
    setMessage("Seu cupom válido foi recuperado.");
    setCurrentPhase('qrcode');
    setExistingUserCupons(null); 
  };


  // ----------------------------------------------------------------------
  // --- FASE 1: ENVIAR DADOS E SOLICITAR OTP ---
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
        // SUCESSO: O código foi enviado. Mude para a tela de validação.
        setMessage(data.message);
        setCurrentPhase('validacao');
        
      } else if (response.status === 409) {
        // DUPLICIDADE: O usuário já está no DB
        setDuplicityMessage(data.message); 
        setExistingUserCupons(data.cupons); 
        
      } else {
        // Erro Twilio/Validação de campo
        setMessage(`Falha no envio do código: ${data.message}.`);
      }
    } catch (error) {
      console.error('Erro na requisição de envio OTP:', error);
      setMessage('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };


  // ----------------------------------------------------------------------
  // --- FASE 2: VALIDAR OTP E FINALIZAR CADASTRO ---
  // ----------------------------------------------------------------------
  const handleCheckOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (otpCode.length !== 6) {
        setMessage('O código deve ter 6 dígitos.');
        setLoading(false);
        return;
    }
    
    // Dados de cadastro são enviados novamente para que o backend salve/verifique
    const finalData = { name, phone, address, code: otpCode };

    try {
      const response = await fetch(API_CHECK_OTP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData), 
      });

      const data = await response.json();
      
      if (response.ok) {
        // SUCESSO: Código aprovado e lead salvo ou recuperado.
        setMessage(data.message); 
        setCouponUUID(data.couponUUID); 
        setCouponCode(data.couponCode); 
        setCurrentPhase('qrcode'); 
        
      } else {
        // CÓDIGO INVÁLIDO ou EXPIRADO
        setMessage(data.message || 'Código inválido. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro na requisição de checagem OTP:', error);
      setMessage('Erro de conexão durante a validação.');
    } finally {
      setLoading(false);
    }
  };


  // ----------------------------------------------------------------------
  // --- LÓGICA DE RENDERIZAÇÃO DE TELAS ---
  // ----------------------------------------------------------------------

  // --- TELA 1.1: DUPLICIDADE DETECTADA ---
  if (existingUserCupons) {
      return (
        <div className="container duplication-container">
            {/* LOGO CORRIGIDO */}
            <img src="/logo.svg" alt="DONPEDRO" className="brand-logo" /> 
            
            <h1 className="main-title-error">Atenção!</h1>
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
                TENTAR NOVO CADASTRO
            </button>
        </div>
      );
  }

  // --- TELA 2: VALIDAÇÃO OTP ---
  if (currentPhase === 'validacao') {
    return (
        <div className="container validation-container">
            {/* LOGO CORRIGIDO */}
            <img src="/logo.svg" alt="DONPEDRO" className="brand-logo" />
            <h1 className="main-title">Verificação</h1>
            <span className="brand-name">DONPEDRO Segurança</span>

            <p className="instruction-text">{message}</p>
            
            <form onSubmit={handleCheckOtp}>
                <input
                    type="number" 
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Insira o Código de 6 dígitos"
                    required
                    disabled={loading}
                    maxLength={6}
                    style={{ textAlign: 'center', fontSize: '1.2em' }}
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Verificando...' : 'VALIDAR E FINALIZAR'}
                </button>
            </form>
            
            <button className="reset-button" onClick={() => setCurrentPhase('cadastro')} style={{ marginTop: '15px' }}>
                Voltar
            </button>
        </div>
    );
  }

  // --- TELA 3: QR CODE (SUCESSO) ---
  if (currentPhase === 'qrcode') {
      return (
        <div className="container qr-display-container">
            <div className="success-icon-container">
                <span className="success-check-mark">✔</span>
            </div>
            <h1 className="main-title-qr">Cupom Gerado!</h1>
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
            
            <p className="instruction-small">Apresente este QR Code para validar seu cupom. Válido para 1 uso.</p>
            
            <button className="reset-button" onClick={() => setCurrentPhase('cadastro')}>
                VOLTAR
            </button>
        </div>
      );
  }


  // --- TELA 1: CADASTRO (PADRÃO) ---
  return (
    <div className="container">
     
      <img src="/logo.svg" alt="DONPEDRO" className="brand-logo" />
      
      <h1 className="main-title">Cadastro Exclusivo</h1>
      <span className="brand-name">DONPEDRO</span>

      <p>Preencha os dados para receber o código de segurança via SMS.</p>
      
      <form onSubmit={handleSendOtp}> 
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu Nome Completo"
          required
          disabled={loading}
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefone (Ex: 555-555-5555)"
          required
          disabled={loading}
        />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Seu Endereço (Obrigatório)"
          required
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Enviando Código...' : 'Enviar Código de Verificação'}
        </button>
      </form>

      {message && <p className={`result-message ${couponUUID ? 'success' : 'error'}`}>{message}</p>}
    </div>
  );
}

export default App;