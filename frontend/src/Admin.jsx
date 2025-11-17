// Arquivo: coupon-sms-project/frontend/src/Admin.jsx (PAINEL DE ADMIN)

import React, { useState, useEffect } from 'react';
import './Admin.css'; // Vamos criar este CSS logo abaixo

const ADMIN_API_URL = 'http://localhost:3001/admin';

const AdminPanel = () => {
    const [leads, setLeads] = useState([]);
    const [filteredLeads, setFilteredLeads] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
    const [username, setUsername] = useState('donadmin');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    useEffect(() => {
        if (token) {
            fetchLeads();
        }
    }, [token]);

    useEffect(() => {
        // Lógica de busca
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const filtered = leads.filter(lead =>
                lead.name.toLowerCase().includes(query) ||
                lead.phone_number.includes(query) ||
                lead.address.toLowerCase().includes(query)
            );
            setFilteredLeads(filtered);
        } else {
            setFilteredLeads(leads);
        }
    }, [searchQuery, leads]);


    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');

        try {
            const response = await fetch(`${ADMIN_API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('adminToken', data.token);
                setToken(data.token);
            } else {
                setLoginError(data.message || 'Erro de login desconhecido.');
            }
        } catch (error) {
            setLoginError('Erro de conexão com o servidor.');
        }
    };

    const fetchLeads = async () => {
        try {
            const response = await fetch(`${ADMIN_API_URL}/leads`, {
                headers: { 'X-Admin-Token': token }
            });

            if (response.status === 401) {
                handleLogout();
                return;
            }

            const data = await response.json();
            setLeads(data);

        } catch (error) {
            console.error('Erro ao buscar leads:', error);
        }
    };
    
    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        setToken('');
        setLeads([]);
    };

    const exportToCSV = () => {
        if (filteredLeads.length === 0) return;

        const headers = ["ID", "Nome", "Telefone", "Endereço", "Data de Cadastro"];
        
        // Mapeia os dados para o formato CSV
        const csvData = filteredLeads.map(lead => [
            lead.id,
            `"${lead.name.replace(/"/g, '""')}"`, // Protege strings com aspas
            lead.phone_number,
            `"${lead.address.replace(/"/g, '""')}"`,
            new Date(lead.created_at).toLocaleString()
        ]);

        const csvContent = [
            headers.join(";"), // Cabeçalho separado por ponto e vírgula
            ...csvData.map(e => e.join(";"))
        ].join("\n");

        // Cria e baixa o arquivo CSV
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `donpedro_leads_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    if (!token) {
        return (
            <div className="admin-container login-form">
                <h2>Acesso Administrador</h2>
                <span className="brand-name">DONPEDRO</span>
                <form onSubmit={handleLogin}>
                    <input
                        type="text"
                        placeholder="Nome de Usuário (donadmin)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="submit">Entrar</button>
                    {loginError && <p className="login-error">{loginError}</p>}
                </form>
            </div>
        );
    }

    // Painel Principal
    return (
        <div className="admin-container admin-panel">
            <header className="admin-header">
                <h1>Painel de Leads <span className="brand-name">DONPEDRO</span></h1>
                <button onClick={handleLogout} className="logout-button">Sair</button>
            </header>
            
            <div className="admin-controls">
                <input
                    type="text"
                    placeholder="Buscar por Nome, Telefone ou Endereço..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
                <button onClick={exportToCSV} className="export-button">
                    Exportar para Excel ({filteredLeads.length})
                </button>
            </div>

            <div className="leads-table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nome</th>
                            <th>Telefone</th>
                            <th>Endereço</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLeads.length > 0 ? (
                            filteredLeads.map(lead => (
                                <tr key={lead.id}>
                                    <td>{lead.id}</td>
                                    <td>{lead.name}</td>
                                    <td>{lead.phone_number}</td>
                                    <td>{lead.address}</td>
                                    <td>{new Date(lead.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5">{leads.length === 0 ? 'Nenhum lead encontrado.' : 'Nenhum resultado para a busca.'}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminPanel;