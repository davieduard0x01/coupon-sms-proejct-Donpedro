// Arquivo: frontend/src/FuncionarioApp.jsx (VERSÃO FINAL COM SCANNER E LOGIN)

import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode'; // Biblioteca do scanner
import './Admin.css'; 

const API_BASE_URL = 'http://localhost:3001';

// --- Componente do Scanner (Gerencia a Câmera) ---
const QrCodeScanner = ({ onScanSuccess, onScanError }) => {
    
    // O useEffect gerencia a criação, inicialização e limpeza do scanner
    useEffect(() => {
        const qrCodeRegionId = "reader";
        let html5QrCode; 

        const startScanner = () => {
            // Cria a instância SOMENTE QUANDO O DIV ESTÁ NA TELA
            if (document.getElementById(qrCodeRegionId)) {
                 html5QrCode = new Html5Qrcode(qrCodeRegionId, { verbose: false });
            } else {
                 onScanError("Elemento 'reader' não encontrado no DOM.");
                 return;
            }

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                disableFlip: false,
            };

            html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText, decodedResult) => {
                    // SUCESSO: Para a câmera e chama o handler de validação
                    if (html5QrCode.isScanning) {
                        html5QrCode.stop().then(() => {
                            onScanSuccess(decodedText);
                        }).catch(err => {
                            console.error("Falha ao parar o scanner:", err);
                        });
                    }
                },
                (errorMessage) => {
                    // Erro de leitura
                }
            ).catch((err) => {
                onScanError(`Erro ao iniciar a câmera: ${err.message}`);
                console.error("Erro fatal ao iniciar o scanner:", err);
            });
        };

        startScanner();

        // Limpeza: Garante que o scanner para ao desmontar ou mudar de modo
        return () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch(err => console.log("Stop failed on unmount", err));
            }
        };
    }, []); // Roda apenas uma vez ao montar
    
    // Adicionado um placeholder de erro simples
    return (
        <div className="camera-placeholder">
            <div id="reader" style={{ width: "100%", height: "250px", border: "1px solid #ccc", overflow: "hidden" }} />
            <p style={{color: 'red', marginTop: '10px'}}>Conceda permissão à câmera e verifique o console se a câmera não aparecer.</p>
        </div>
    );
};


const FuncionarioApp = () => {
    const [token, setToken] = useState(localStorage.getItem('funcToken') || '');
    const [nivelAcesso, setNivelAcesso] = useState(localStorage.getItem('funcNivel') || '');
    const [usuario, setUsuario] = useState('');
    const [senha, setSenha] = useState('');
    const [loginError, setLoginError] = useState('');

    const [scanCode, setScanCode] = useState('');
    const [validationResult, setValidationResult] = useState(null);
    const [validationLoading, setValidationLoading] = useState(false);
    
    // Estado que alterna entre 'manual' (padrão) e 'camera'
    const [validationMode, setValidationMode] = useState('manual'); 


    // --- Efeito de Limpeza ao Mudar Modo ---
    useEffect(() => {
        // Garante que o scanner para se o modo manual for selecionado
        if (validationMode === 'manual' && Html5Qrcode.isScanning) {
            // Usamos a mesma lógica de parada aqui, verificando se há uma instância rodando
            new Html5Qrcode("reader", { verbose: false }).stop().catch(err => console.log("Stop failed on mode change", err));
        }
    }, [validationMode]);


    // --- Lógica de Login ---
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


    // --- Lógica de Validação do Cupom (Chama a API) ---
    const handleValidation = async (codeToValidate) => {
        setValidationLoading(true);
        setValidationResult(null);
        setScanCode(codeToValidate); 

        if (!codeToValidate) {
            setValidationResult({ success: false, message: 'Insira o código UUID do QR Code.' });
            setValidationLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/func/validate`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Auth-Token': token 
                },
                body: JSON.stringify({ couponUUID: codeToValidate }), 
            });

            const data = await response.json();
            
            if (response.ok) {
                setValidationResult({ success: true, message: data.message, nome: data.nome });
            } else {
                setValidationResult({ success: false, message: data.message });
            }

        } catch (error) {
            setValidationResult({ success: false, message: 'Erro de comunicação com o servidor.' });
        } finally {
            setValidationLoading(false);
            setScanCode(''); // Limpa o código
            setValidationMode('manual'); // Volta para o modo manual após a validação
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('funcToken');
        localStorage.removeItem('funcNivel');
        setToken('');
        setNivelAcesso('');
        // Tenta parar o scanner ao sair
        if (validationMode === 'camera') {
            new Html5Qrcode("reader", { verbose: false }).stop().catch(err => console.log("Stop failed on logout", err));
        }
    };
    
    const handleErrorScan = (message) => {
        setValidationResult({ success: false, message: message });
    };


    // --- Renderização de Login ---
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

    // --- Renderização da Tela de Scanner (Validação) ---
    return (
        <div className="admin-container scanner-panel">
            <header className="admin-header">
                <h1>Validação de Cupom</h1>
                <p>Usuário: {usuario} ({nivelAcesso})</p>
                <button onClick={handleLogout} className="logout-button">Sair</button>
            </header>
            
            {/* BOTÕES DE ALTERNÂNCIA DE MODO */}
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
                    {/* O onScanError é adicionado para debug */}
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