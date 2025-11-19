// Arquivo: frontend/src/FuncionarioApp.jsx (App Scanner)

import React, { useState } from 'react';
import './Admin.css'; // Reutilizaremos o CSS do Admin para login/estrutura

const API_BASE_URL = 'http://localhost:3001';

const FuncionarioApp = () => {
    // --- Estados de Autenticação ---
    const [token, setToken] = useState(localStorage.getItem('funcToken') || '');
    const [nivelAcesso, setNivelAcesso] = useState(localStorage.getItem('funcNivel') || '');
    const [usuario, setUsuario] = useState('');
    const [senha, setSenha] = useState('');
    const [loginError, setLoginError] = useState('');

    // --- Estados da Validação ---
    const [scanCode, setScanCode] = useState('');
    const [validationResult, setValidationResult] = useState(null);
    const [validationLoading, setValidationLoading] = useState(false);


    // --- 1. Lógica de Login ---
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario, senha }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('funcToken', data.token);
                localStorage.setItem('funcNivel', data.nivel);
                setToken(data.token);
                setNivelAcesso(data.nivel);
            } else {
                setLoginError(data.message || 'Erro de login desconhecido.');
            }
        } catch (error) {
            setLoginError('Erro de conexão com o servidor de autenticação.');
        }
    };

    // --- 2. Lógica de Validação do Cupom (Scanner) ---
    const handleValidation = async (e) => {
        e.preventDefault();
        setValidationLoading(true);
        setValidationResult(null);

        if (!scanCode) {
            setValidationResult({ success: false, message: 'Insira o código UUID do QR Code.' });
            setValidationLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/func/validate`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Auth-Token': token // Envia o token para autenticar o funcionário
                },
                body: JSON.stringify({ couponUUID: scanCode }),
            });

            const data = await response.json();
            
            if (response.ok) {
                // Sucesso (200 OK) - Cupom VÁLIDO e USADO
                setValidationResult({ success: true, message: data.message, nome: data.nome });
            } else {
                // Falha (404, 409, 500) - Cupom já usado ou inválido
                setValidationResult({ success: false, message: data.message });
            }

        } catch (error) {
            setValidationResult({ success: false, message: 'Erro de comunicação com o servidor.' });
        } finally {
            setValidationLoading(false);
            setScanCode(''); // Limpa o campo após a tentativa de leitura
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('funcToken');
        localStorage.removeItem('funcNivel');
        setToken('');
        setNivelAcesso('');
    };

    // --- 3. Renderização ---

    // Tela de Login
    if (!token) {
        return (
            <div className="admin-container login-form">
                <h2>Acesso Funcionário</h2>
                <span className="brand-name">Scanner DONPEDRO</span>
                <form onSubmit={handleLogin}>
                    <input
                        type="text"
                        placeholder="Nome de Usuário"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Senha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                    />
                    <button type="submit">Entrar</button>
                    {loginError && <p className="login-error">{loginError}</p>}
                </form>
            </div>
        );
    }

    // Tela de Scanner (Validação)
    return (
        <div className="admin-container scanner-panel">
            <header className="admin-header">
                <h1>Validação de Cupom</h1>
                <p>Usuário: {usuario} ({nivelAcesso})</p>
                <button onClick={handleLogout} className="logout-button">Sair</button>
            </header>
            
            <form onSubmit={handleValidation} className="validation-form">
                <p className="scanner-instruction">
                    Insira o UUID lido pelo QR Code:
                </p>
                <input
                    type="text"
                    placeholder="Cole ou Digite o Código UUID do Cupom"
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    required
                    disabled={validationLoading}
                />
                <button type="submit" disabled={validationLoading}>
                    {validationLoading ? 'Validando...' : 'VALIDAR CUPOM'}
                </button>
            </form>

            {/* Resultado da Validação */}
            {validationResult && (
                <div className={`validation-result ${validationResult.success ? 'success' : 'error'}`}>
                    <p className="result-status">
                        {validationResult.success ? '✅ SUCESSO' : '❌ FALHA'}
                    </p>
                    <p className="result-message">
                        {validationResult.message}
                    </p>
                    {validationResult.nome && (
                        <p className="result-info">Cliente: **{validationResult.nome}**</p>
                    )}
                </div>
            )}
            
        </div>
    );
};

export default FuncionarioApp;