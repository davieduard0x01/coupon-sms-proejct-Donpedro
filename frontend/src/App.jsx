// Arquivo: coupon-sms-project/frontend/src/App.jsx (INTERFACE DO USUÁRIO - CADASTRO/QR CODE)

import React, { useState } from 'react';
import QRCode from 'qrcode.react'; // Biblioteca para gerar QR Code
import './App.css'; 

// URL base do backend
const API_URL = 'http://localhost:3001/api/register-coupon';

// Componente para exibir a lista de cupons existentes
const UserCuponsList = ({ cupons }) => (
    <div className="coupon-list-wrapper">
        <h2>Meus Cupons Cadastrados</h2>
        <p className="list-intro">Você já possui cadastro. Abaixo estão seus cupons:</p>
        <div className="coupon-grid">
            {cupons.map((coupon) => (
                <div key={coupon.coupon_uuid} className={`coupon-card status-${coupon.status_uso.toLowerCase().replace('_', '-')}`}>
                    <p className="status-label">{coupon.status_uso.replace('_', ' ')}</p>
                    <p className="coupon-code-display">{coupon.coupon_code} ({coupon.coupon_uuid.substring(0, 8)}...)</p>
                    {coupon.status_uso === 'NAO_UTILIZADO' && (
                        <p className="print-info">Este cupom ainda é válido. Use o QR Code anterior.</p>
                    )}
                </div>
            ))}
        </div>
        <p className="note">Se você perdeu seu QR Code válido, contate o suporte.</p>
    </div>
);


function App() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Novos estados para o fluxo QR Code
  const [couponUUID, setCouponUUID] = useState(null);
  const [existingUserCupons, setExistingUserCupons] = useState(null);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setCouponUUID(null); // Limpa o QR Code anterior
    setExistingUserCupons(null); // Limpa a lista de cupons antigos

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, phone, address }), 
      });

      const data = await response.json();
      
      if (response.ok) {
        // CÓDIGO 200 (NOVO CADASTRO): Exibe o QR Code
        setMessage(`Parabéns, ${name}! Seu cupom foi gerado.`);
        setCouponUUID(data.couponUUID); // Armazena o UUID para gerar o QR Code
        
      } else if (response.status === 409) {
        // CÓDIGO 409 (JÁ CADASTRADO): Trata o erro e mostra a lista de cupons
        setMessage(`Falha: ${data.message}`);
        setExistingUserCupons(data.cupons); // Recebe e exibe a lista de cupons do usuário
        
      } else {
        // Outros Erros (400, 500)
        setMessage(`Falha: ${data.message}`);
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      setMessage('Erro de conexão. Verifique se o servidor Node.js está rodando na porta 3001.');
    } finally {
      setLoading(false);
    }
  };


  // --- Renderização do QR Code ou Formulário ---
  if (couponUUID) {
      const couponURL = `${window.location.origin}/coupon/${couponUUID}`;
      return (
        <div className="container qr-display-container">
            <h1 className="main-title">✅ Cupom Gerado!</h1>
            <span className="brand-name">DONPEDRO</span>
            <p className="success-message">{message}</p>

            <div className="qrcode-box">
                {/* Geração do QR Code usando o UUID como valor */}
                <QRCode
                    value={couponUUID} // Valor que será lido pelo scanner (o UUID único)
                    size={256}
                    level="H"
                    includeMargin={true}
                />
            </div>
            
            <p className="instruction">Este QR Code é o seu cupom único **D0nP3dro20**.</p>
            <p className="instruction-small">Tire um print da tela ou salve a imagem. Válido para 1 uso.</p>
            
            <button className="reset-button" onClick={() => setCouponUUID(null)}>
                Voltar ao Cadastro
            </button>
        </div>
      );
  }

  // --- Renderização do Formulário Padrão ---
  return (
    <div className="container">
      <img src="/logo.svg" alt="DONPEDRO Logo" className="brand-logo" />
      
      <h1 className="main-title">Cadastro Exclusivo</h1>
      <span className="brand-name">DONPEDRO</span>

      <p>Preencha os dados e receba seu cupom de desconto via QR Code.</p>

      {/* Exibe a lista de cupons se o usuário tentar cadastrar novamente */}
      {existingUserCupons && <UserCuponsList cupons={existingUserCupons} />}

      <form onSubmit={handleSubmit}>
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
          {loading ? 'Cadastrando...' : 'Gerar Meu QR Code!'}
        </button>
      </form>

      {message && !existingUserCupons && <p className={`result-message ${couponUUID ? 'success' : 'error'}`}>{message}</p>}
      
      <p className="note">
        *O código será gerado no formato UUID e validado via scanner.
      </p>
    </div>
  );
}

export default App;