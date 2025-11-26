// Arquivo: frontend/src/FuncionarioApp.jsx (VERSÃO FINAL COM CORREÇÃO DE LAYOUT)

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode'; 
import './Admin.css'; 
// ... (restante das importações e constantes)

const API_BASE_URL = 'http://localhost:3001';

// --- Componente do Scanner (Gerencia a Câmera) ---
const QrCodeScanner = ({ onScanSuccess, onScanError }) => {
    
    const html5QrCodeRef = useRef(null); 
    const qrCodeRegionId = "reader";

    useEffect(() => {
        if (!document.getElementById(qrCodeRegionId)) {
            onScanError("Erro de Montagem: Elemento 'reader' não encontrado no DOM.");
            return;
        }

        const html5QrCode = new Html5Qrcode(qrCodeRegionId, { verbose: false });
        html5QrCodeRef.current = html5QrCode; 

        const config = {
            fps: 10,
            qrbox: { width: 300, height: 300 },
            disableFlip: false,
        };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText, decodedResult) => {
                if (html5QrCode.isScanning) {
                    html5QrCode.stop().then(() => {
                        onScanSuccess(decodedText);
                    }).catch(err => {
                        console.error("Falha ao parar o scanner:", err);
                    });
                }
            },
            (errorMessage) => {
                // Log de erro de leitura
            }
        ).catch((err) => {
            onScanError(`Erro ao iniciar a câmera: ${err.message}. Verifique as permissões.`);
            console.error("Erro fatal ao iniciar o scanner:", err);
        });

        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(err => console.log("Stop failed on unmount", err));
            }
        };
    }, []); 
    
    return (
        <div className="camera-placeholder">
            <div id={qrCodeRegionId} />
            <p style={{color: '#CC0000', marginTop: '10px', fontSize: '0.9em'}}>
                Conceda permissão à câmera e verifique o console se a câmera não aparecer.
            </p>
        </div>
    );
};


const FuncionarioApp = () => {
    // --- Estados (Mantidos os mesmos) ---
    const [token, setToken] = useState(localStorage.getItem('funcToken') || '');
    const [nivelAcesso, setNivelAcesso] = useState(localStorage.getItem('funcNivel') || '');
    const [usuario, setUsuario] = useState('');
    const [senha, setSenha] = useState('');
    const [loginError, setLoginError] = useState('');

    const [scanCode, setScanCode] = useState('');
    const [validationResult, setValidationResult] = useState(null);
    const [validationLoading, setValidationLoading] = useState(false);
    
    const [validationMode, setValidationMode] = useState('manual'); 


    // --- Lógica de Limpeza e Validação (Mantida a mesma) ---
    const stopScanner = () => {
        try {
            const html5QrCodeCleanup = new Html5Qrcode("reader", { verbose: false });
            if (html5QrCodeCleanup.isScanning) {
                html5QrCodeCleanup.stop().catch(err => console.log("Stop failed on cleanup", err));
            }
        } catch (e) { }
    }

    useEffect(() => {
        if (validationMode === 'manual') {
            stopScanner();
        }
    }, [validationMode]);
    
    const handleLogin = async (e) => { /* ... lógica de login ... */ };
    const handleValidation = async (codeToValidate) => { /* ... lógica de validação ... */ };
    const handleLogout = () => { /* ... lógica de logout ... */ stopScanner(); };
    const handleErrorScan = (message) => { /* ... lógica de erro ... */ };

    
    // --- Renderização de Login ---
    if (!token) {
        return (
            <div className="admin-container login-form">
                <h2>Acesso Funcionário</h2>
                <span className="brand-name">Scanner DONPEDRO</span>
                <form onSubmit={handleLogin}>
                    <input type="text" placeholder="Nome de Usuário" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
                    <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
                    <button type="submit">Entrar</button>
                    {loginError && <p className="login-error">{loginError}</p>}
                </form>
            </div>
        );
    }

    // --- Renderização da Tela de Scanner (Validação) ---
    return (
        <div className="admin-container scanner-panel">
            <header className="admin-header">
                {/* NOVO: Bloco de Info */}
                <div className="admin-info-content">
                    <h1>Validação de Cupom</h1>
                    <p>Usuário: {usuario} ({nivelAcesso})</p>
                </div>
                
                {/* Botão Sair */}
                <button onClick={handleLogout} className="logout-button">SAIR</button>
            </header>
            
            {/* NOVO SEPARADOR VISUAL (A linha vermelha) */}
            <div className="header-separator"></div>
            
            {/* BOTÕES DE ALTERNÂNCIA DE MODO (Não aninhado no header) */}
            <div className="scanner-mode-toggle">
                <button 
                    onClick={() => setValidationMode('camera')}
                    className={`mode-button ${validationMode === 'camera' ? 'active-mode' : ''}`}
                >
                    Scannear por Câmera
                </button>
                <button 
                    onClick={() => setValidationMode('manual')}
                    className={`mode-button ${validationMode === 'manual' ? 'active-mode' : ''}`}
                >
                    Inserir UUID Manualmente
                </button>
            </div>

            {/* RENDERIZAÇÃO CONDICIONAL */}
            {validationMode === 'camera' && (
                <div className="camera-area">
                    <QrCodeScanner onScanSuccess={handleValidation} onScanError={handleErrorScan} />
                    <p className="scanner-instruction">Aponte a câmera para o QR Code do cliente.</p>
                </div>
            )}

            {validationMode === 'manual' && (
                <form onSubmit={(e) => { e.preventDefault(); handleValidation(scanCode); }} className="validation-form">
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
            )}

            {/* Resultado da Validação */}
            {validationResult && (
                <div className={`validation-result ${validationResult.success ? 'success' : 'error'}`}>
                    <p className={`result-status ${validationResult.success ? 'success' : 'error'}`}>
                        {validationResult.success ? 'SUCESSO' : 'FALHA'}
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