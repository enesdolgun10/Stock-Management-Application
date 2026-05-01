import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // React.StrictMode etiketlerini kaldırdık ki kamera iki kez tetiklenmesin
  <App />
);