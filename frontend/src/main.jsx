// Arquivo: frontend/src/main.jsx (Roteamento Atualizado)

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminPanel from './Admin.jsx'; // Painel Admin (Não incluído aqui, mas necessário)
import FuncionarioApp from './FuncionarioApp.jsx'; // Novo App Scanner
import './index.css';

const rootElement = document.getElementById('root');
const currentPath = window.location.pathname;

let ComponentToRender;

if (currentPath.startsWith('/admin')) {
    ComponentToRender = AdminPanel;
} else if (currentPath.startsWith('/scanner')) {
    ComponentToRender = FuncionarioApp; // Carrega o App Scanner
} else {
    ComponentToRender = App; // Carrega o Formulário Público
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ComponentToRender />
  </React.StrictMode>,
);