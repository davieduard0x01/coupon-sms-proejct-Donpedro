// Arquivo: coupon-sms-project/frontend/src/App.jsx

import { useState } from 'react';
import './App.css'; 

function App() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [couponCode, setCouponCode] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setCouponCode(null); 

    const API_URL = 'http://localhost:3001/api/register-coupon';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Envia todos os campos, que agora são obrigatórios
        body: JSON.stringify({ name, phone, address }), 
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Sucesso! ${data.message}`);
        
      } else {
        setMessage(`Falha: ${data.message}`);
        
        if (data.code) { 
            setCouponCode(data.code); 
        } else {
             setCouponCode(null);
        }
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      setMessage('Erro de conexão. Verifique se o servidor Node.js está rodando na porta 3001.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Logo SVG */}
      <img src="/logo.svg" alt="DONPEDRO Logo" className="brand-logo" />
      
      {/* Títulos */}
      <h1 className="main-title">Cadastro Exclusivo</h1>
      <span className="brand-name">DONPEDRO</span>

      {/* Texto revisado: sem prévia do desconto */}
      <p>Preencha os dados e receba seu cupom de desconto via SMS.</p>

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
          {loading ? 'Cadastrando...' : 'Receber Cupom via SMS!'}
        </button>
      </form>

      {message && <p className={`result-message ${couponCode ? 'error' : 'success'}`}>{message}</p>}
      
      {couponCode && (
        <div className="coupon-display">
          <h2>CÓDIGO DE SUPORTE:</h2> 
          <p className="code">{couponCode}</p>
        </div>
      )}

      <p className="note">
        *Apenas números no formato dos EUA (+1) são válidos para o envio do SMS.
      </p>
    </div>
  );
}

export default App;