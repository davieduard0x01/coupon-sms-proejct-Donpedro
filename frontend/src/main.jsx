import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminPanel from './AdminPanel.jsx';
import FuncionarioApp from './FuncionarioApp.jsx'; 
import './index.css';

// Lógica de roteamento simples baseada na URL
const rootElement = document.getElementById('root');
const currentPath = window.location.pathname;

let ComponentToRender;

if (currentPath.startsWith('/admin')) {
    ComponentToRender = AdminPanel;
} else if (currentPath.startsWith('/scanner')) {
    ComponentToRender = FuncionarioApp; 
} else {
    ComponentToRender = App; 
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ComponentToRender />
  </React.StrictMode>,
);