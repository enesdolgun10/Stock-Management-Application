import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from 'react-hot-toast';
import { supabase } from './supabaseClient';
import './App.css';
import ScannerPage from './pages/ScannerPage';
import Inventory from './pages/Inventory';
import InvoicePage from './pages/InvoicePage';
import SalesHistory from './pages/SalesHistory';
import Login from './pages/Login';


axios.defaults.baseURL = process.env.REACT_APP_API_URL || "http://localhost:8000";

axios.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});


const Home = ({ session }) => {
  const [stats, setStats] = useState({ total_items: 0, total_stock: 0, low_stock: [], out_of_stock: [] });
  const [loadingStats, setLoadingStats] = useState(true);
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await axios.get("/dashboard-stats");
      if (res.data.status === "success") {
        setStats(res.data);
      }
    } catch (error) {
      console.error("İstatistikler alınamadı", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="App wide" style={{ paddingTop: '20px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ color: '#1f2937', fontSize: '32px', fontWeight: '800', margin: '0 0 5px 0' }}>
            Esnaf Stok Sistemi
          </h2>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '15px' }}>Dükkanının dijital kontrol paneli</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase' }}>Aktif Dükkan</span>
            <span style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>👤 {session?.user?.email}</span>
          </div>

          <button
            onClick={handleLogout}
            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>🚪</span> Çıkış
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', backgroundColor: '#eff6ff', padding: '20px', borderRadius: '15px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
          <span style={{ fontSize: '30px' }}>📦</span>
          <h3 style={{ color: '#1e3a8a', fontSize: '28px', margin: '10px 0 5px 0' }}>
            {loadingStats ? <span style={{ fontSize: '18px', color: '#60a5fa' }}>Hesaplanıyor...</span> : stats.total_items}
          </h3>
          <p style={{ color: '#3b82f6', margin: 0, fontWeight: '600' }}>Farklı Çeşit Ürün</p>
        </div>
        <div style={{ flex: '1 1 200px', backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '15px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
          <span style={{ fontSize: '30px' }}>📊</span>
          <h3 style={{ color: '#14532d', fontSize: '28px', margin: '10px 0 5px 0' }}>
            {loadingStats ? <span style={{ fontSize: '18px', color: '#4ade80' }}>Hesaplanıyor...</span> : stats.total_stock}
          </h3>
          <p style={{ color: '#22c55e', margin: 0, fontWeight: '600' }}>Depodaki Toplam Adet</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', flexWrap: 'wrap' }}>
        <div className="card compact-card" style={{ flex: '1 1 300px', borderTop: '4px solid #f59e0b', margin: 0 }}>
          <h3 style={{ color: '#d97706', margin: '0 0 15px 0', fontSize: '18px' }}>⚠️ Stoğu Azalanlar (Son 5)</h3>
          {loadingStats ? (
            <p style={{ color: '#9ca3af', fontSize: '14px', fontStyle: 'italic' }}>Veriler buluttan çekiliyor⏳...</p>
          ) : stats.low_stock.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Stoğu azalan ürün yok, her şey yolunda!</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {stats.low_stock.slice(0, 5).map((item, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #fde68a', fontSize: '14px' }}>
                  <span style={{ fontWeight: '600', color: '#92400e' }}>{item.brand} {item.product_name}</span>
                  <span style={{ backgroundColor: '#f59e0b', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{item.current_stock} Kaldı</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card compact-card" style={{ flex: '1 1 300px', borderTop: '4px solid #ef4444', margin: 0 }}>
          <h3 style={{ color: '#b91c1c', margin: '0 0 15px 0', fontSize: '18px' }}>🚨 Tamamen Tükenenler</h3>
          {loadingStats ? (
            <p style={{ color: '#9ca3af', fontSize: '14px', fontStyle: 'italic' }}>Veriler buluttan çekiliyor⏳...</p>
          ) : stats.out_of_stock.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Tükenen ürün bulunmuyor.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {stats.out_of_stock.slice(0, 5).map((item, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #fecaca', fontSize: '14px' }}>
                  <span style={{ fontWeight: '600', color: '#7f1d1d' }}>{item.brand} {item.product_name}</span>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>TÜKENDİ</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h3 style={{ color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '20px', textAlign: 'left' }}>Hızlı İşlemler</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
        <Link to="/scanner" style={{ display: 'contents' }}>
          <button className="main-button btn-blue" style={{ margin: 0, height: '80px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '24px', marginBottom: '5px' }}>🛒</span> PERAKENDE SATIŞ
          </button>
        </Link>
        <Link to="/invoice" style={{ display: 'contents' }}>
          <button className="main-button" style={{ margin: 0, height: '80px', fontSize: '16px', backgroundColor: '#8b5cf6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '24px', marginBottom: '5px' }}>🧾</span> FATURA / MAL KABUL
          </button>
        </Link>
        <Link to="/inventory" style={{ display: 'contents' }}>
          <button className="main-button btn-green" style={{ margin: 0, height: '80px', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '24px', marginBottom: '5px' }}>📋</span> STOK LİSTESİ
          </button>
        </Link>
        <Link to="/sales" style={{ display: 'contents' }}>
          <button className="main-button" style={{ margin: 0, height: '80px', fontSize: '16px', backgroundColor: '#f59e0b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '24px', marginBottom: '5px' }}>📊</span> SATIŞ GEÇMİŞİ
          </button>
        </Link>
      </div>
    </div>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontWeight: 'bold', color: '#4b5563' }}>Sistem Hazırlanıyor...</div>;
  }

  const ProtectedRoute = ({ children }) => {
    if (!session) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <Router>
      <Toaster position="top-center" toastOptions={{ duration: 2500, style: { fontSize: '15px', fontWeight: '600', borderRadius: '12px' } }} />
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />

        <Route path="/" element={<ProtectedRoute><Home session={session} /></ProtectedRoute>} />
        <Route path="/scanner" element={<ProtectedRoute><ScannerPage /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/invoice" element={<ProtectedRoute><InvoicePage /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute><SalesHistory /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;