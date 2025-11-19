// Arquivo: frontend/src/AdminPanel.jsx (Painel de Administração)

import React, { useState, useEffect } from 'react';
import './Admin.css'; 

const API_BASE_URL = 'http://localhost:3001';

// Função auxiliar para converter a lista de objetos para formato CSV
const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';
    
    // Extrai os cabeçalhos (chaves do primeiro objeto)
    const headers = Object.keys(data[0]);
    
    // Mapeia os dados:
    // 1. A primeira linha é o cabeçalho (separado por vírgula)
    // 2. As linhas seguintes são os valores (separados por vírgula)
    const csvContent = [
        headers.join(';'), // Cabeçalhos (usando ';' como separador para evitar problemas com vírgulas nos dados)
        ...data.map(row => 
            headers.map(header => {
                let value = row[header] === null || row[header] === undefined ? '' : row[header];
                // Remove quebras de linha e aspas duplas, e envolve em aspas se contiverem o separador
                value = String(value).replace(/"/g, '""'); 
                if (value.includes(';') || value.includes('\n')) {
                    value = `"${value}"`;
                }
                return value;
            }).join(';')
        )
    ].join('\n');

    return csvContent;
};

const AdminPanel = () => {
    // --- Estados de Autenticação e Dados ---
    const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
    const [nivelAcesso, setNivelAcesso] = useState(localStorage.getItem('adminNivel') || '');
    const [usuario, setUsuario] = useState('');
    const [senha, setSenha] = useState('');
    const [loginError, setLoginError] = useState('');

    // --- Estados do Dashboard ---
    const [cupons, setCupons] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [dataError, setDataError] = useState('');


    // --- 1. Efeito para carregar os dados ao autenticar ---
    useEffect(() => {
        if (token && nivelAcesso === 'ADMIN') {
            fetchData();
        }
    }, [token, nivelAcesso]); 

    // --- 2. Lógica de Carregamento de Dados (Dashboard) ---
    const fetchData = async () => {
        setLoadingData(true);
        setDataError('');

        try {
            const response = await fetch(`${API_BASE_URL}/admin/data`, {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Auth-Token': token // Envia o token para autenticar o Admin
                },
            });

            const data = await response.json();
            
            if (response.ok) {
                setCupons(data);
            } else if (response.status === 401) {
                // Token inválido ou expirado, força logout
                handleLogout();
                setLoginError('Sessão expirada. Faça login novamente.');
            } else {
                setDataError(data.message || 'Erro ao carregar os dados.');
            }

        } catch (error) {
            setDataError('Erro de comunicação com o servidor ao buscar dados.');
        } finally {
            setLoadingData(false);
        }
    };


    // --- 3. Lógica de Login ---
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
                if (data.nivel !== 'ADMIN') {
                    setLoginError('Acesso negado. Esta área é restrita a Administradores.');
                    return;
                }
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('adminNivel', data.nivel);
                setToken(data.token);
                setNivelAcesso(data.nivel);
                // O useEffect cuidará de chamar fetchData
            } else {
                setLoginError(data.message || 'Erro de login desconhecido.');
            }
        } catch (error) {
            setLoginError('Erro de conexão com o servidor de autenticação.');
        }
    };

    // --- 4. Lógica de Logout ---
    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminNivel');
        setToken('');
        setNivelAcesso('');
        setCupons([]);
        setLoginError('');
    };

    // --- 5. Lógica de Exportação CSV ---
    const handleExportCSV = () => {
        const csv = convertToCSV(cupons);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) { 
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `leads_donpedro_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // --- 6. Renderização ---

    // Tela de Login
    if (!token || nivelAcesso !== 'ADMIN') {
        return (
            <div className="admin-container login-form">
                <h2>Painel de Administração</h2>
                <span className="brand-name">DONPEDRO Leads</span>
                <form onSubmit={handleLogin}>
                    <input
                        type="text"
                        placeholder="Usuário Admin"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Senha Admin"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                    />
                    <button type="submit">Acessar Dashboard</button>
                    {loginError && <p className="login-error">{loginError}</p>}
                </form>
            </div>
        );
    }

    // Dashboard
    return (
        <div className="admin-container dashboard-panel">
            <header className="admin-header">
                <h1>Dashboard de Leads e Cupons</h1>
                <p>Usuário logado: {usuario} ({nivelAcesso})</p>
                <div className="admin-actions">
                    <button onClick={handleExportCSV} disabled={loadingData || cupons.length === 0} className="export-button">
                        {cupons.length > 0 ? `Exportar ${cupons.length} Registros para CSV` : 'Nenhum dado para exportar'}
                    </button>
                    <button onClick={handleLogout} className="logout-button">Sair</button>
                </div>
            </header>

            {loadingData && <p className="loading-message">Carregando dados...</p>}
            {dataError && <p className="error-message">{dataError}</p>}

            {!loadingData && cupons.length > 0 && (
                <div className="data-table-wrapper">
                    <p className="total-count">Total de Cadastros: **{cupons.length}**</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Telefone</th>
                                <th>Endereço</th>
                                <th>Status Uso</th>
                                <th>Código Cupom</th>
                                <th>Cadastrado Em</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cupons.map((c) => (
                                <tr key={c.coupon_uuid} className={`status-${c.status_uso.toLowerCase().replace('_', '-')}`}>
                                    <td>{c.nome}</td>
                                    <td>{c.telefone}</td>
                                    <td>{c.endereco}</td>
                                    <td>{c.status_uso.replace('_', ' ')}</td>
                                    <td title={c.coupon_uuid}>{c.coupon_uuid.substring(0, 8)}...</td>
                                    <td>{new Date(c.data_cadastro).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            {!loadingData && cupons.length === 0 && !dataError && (
                <p className="no-data">Nenhum cupom cadastrado ainda.</p>
            )}

        </div>
    );
};

export default AdminPanel;