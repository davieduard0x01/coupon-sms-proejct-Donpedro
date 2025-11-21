// Arquivo: frontend/src/App.jsx (INTERFACE DO USUÁRIO - CADASTRO/QR CODE)

import React, { useState } from 'react';
// CORREÇÃO: Usamos { QRCodeSVG } para importação correta da biblioteca
import { QRCodeSVG } from 'qrcode.react'; 
import './App.css'; 

// URL base do backend
const API_URL = 'http://localhost:3001/api/register-coupon';

// Componente para exibir a lista de cupons existentes
// Recebe os cupons e a função para voltar para a tela do QR Code
const UserCuponsList = ({ cupons, onViewQR }) => ( 
    <div className="coupon-list-wrapper">
        <h2>Meus Cupons Cadastrados</h2>
        <p className="list-intro">Você já possui cadastro. Abaixo estão seus cupons:</p>
        <div className="coupon-grid">
            {cupons.map((coupon) => (
                <div 
                    key={coupon.coupon_uuid} 
                    className={`coupon-card status-${coupon.status_uso.toLowerCase().replace('_', '-')}`}
                    // Lógica para permitir o clique APENAS se o cupom não foi usado
                    onClick={() => coupon.status_uso === 'NAO_UTILIZADO' && onViewQR(coupon.coupon_uuid)} 
                    style={{ cursor: coupon.status_uso === 'NAO_UTILIZADO' ? 'pointer' : 'default' }}
                >
                    <p className="status-label">{coupon.status_uso.replace('_', ' ')}</p>
                    <p className="coupon-code-display">{coupon.coupon_code} ({coupon.coupon_uuid.substring(0, 8)}...)</p>
                    {coupon.status_uso === 'NAO_UTILIZADO' ? (
                        // Opção de re-visualizar o QR Code
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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estados para o fluxo QR Code e Duplicidade
  const [couponUUID, setCouponUUID] = useState(null);
  const [couponCode, setCouponCode] = useState(null); // Armazena o código fixo
  const [existingUserCupons, setExistingUserCupons] = useState(null);

  // Função para acionar a visualização do QR Code de um cupom já existente
  const handleViewQR = (uuid) => {
    // Busca o cupom válido na lista para obter o código fixo (D0nP3dro20)
    const validCoupon = existingUserCupons.find(c => c.coupon_uuid === uuid);

    setCouponUUID(uuid);
    setCouponCode(validCoupon ? validCoupon.coupon_code : 'D0nP3dro20');
    setMessage("Seu cupom válido foi recuperado.");
    setExistingUserCupons(null); // Esconde a lista de cupons
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setCouponUUID(null); 
    setExistingUserCupons(null); 

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
        setCouponUUID(data.couponUUID); 
        setCouponCode(data.couponCode); // Armazena o código fixo
        
      } else if (response.status === 409) {
        // CÓDIGO 409 (JÁ CADASTRADO): Trata o erro e mostra a lista de cupons
        setMessage(`Falha: ${data.message}`);
        setExistingUserCupons(data.cupons); // Recebe a lista de cupons
        
      } else {
        // Outros Erros (400, 500)
        setMessage(`Falha: ${data.message}`);
        // Se houver código de suporte, ele será exibido
        if (data.couponCode) { 
            setCouponCode(data.couponCode); 
        }
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      setMessage('Erro de conexão. Verifique se o servidor Node.js está rodando na porta 3001.');
    } finally {
      setLoading(false);
    }
  };


  // --- RENDERIZAÇÃO DA TELA DE QR CODE ---
  if (couponUUID) {
      return (
        <div className="container qr-display-container">
            <h1 className="main-title">✅ Cupom Gerado!</h1>
            <span className="brand-name">DONPEDRO</span>
            <p className="success-message">{message}</p>

            <div className="qrcode-box">
                <QRCodeSVG
                    value={couponUUID} // O valor lido pelo scanner
                    size={256}
                    level="H"
                    includeMargin={true}
                />
            </div>
            
            <p className="instruction">Este QR Code é o seu cupom único **{couponCode}**.</p>
            <p className="instruction-small">Tire um print da tela ou salve a imagem. Válido para 1 uso.</p>
            
            <button className="reset-button" onClick={() => setCouponUUID(null)}>
                VOLTAR AO CADASTRO
            </button>
        </div>
      );
  }

  // --- RENDERIZAÇÃO DO FORMULÁRIO PADRÃO ---
  return (
    <div className="container">
      <img src="/logo.svg" alt="DONPEDRO Logo" className="brand-logo" />
      
      <h1 className="main-title">Cadastro Exclusivo</h1>
      <span className="brand-name">DONPEDRO</span>

      <p>Preencha os dados e receba seu cupom de desconto via QR Code.</p>

      {/* Exibe a lista de cupons se o usuário tentar cadastrar novamente (409) */}
      {existingUserCupons && <UserCuponsList cupons={existingUserCupons} onViewQR={handleViewQR} />}

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

      {/* Mensagem de sucesso ou falha (exceto quando a lista de cupons está visível) */}
      {message && !existingUserCupons && <p className={`result-message ${couponUUID ? 'success' : 'error'}`}>{message}</p>}
      
      {/* Exibe o código de suporte em caso de erro 500 (falha de DB) */}
      {couponCode && !couponUUID && <p className="coupon-display">Código de Suporte: {couponCode}</p>}
      
      <p className="note">
        *O código será gerado no formato UUID e validado via scanner.
      </p>
    </div>
  );
}

export default App;