// Arquivo: coupon-sms-project/frontend/src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminPanel from './Admin.jsx';
import './index.css';

// Lógica simples para carregar a página correta com base na URL
const rootElement = document.getElementById('root');
const currentPath = window.location.pathname;

let ComponentToRender = App;

if (currentPath.startsWith('/admin')) {
    ComponentToRender = AdminPanel;
} else {
    ComponentToRender = App;
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ComponentToRender />
  </React.StrictMode>,
);