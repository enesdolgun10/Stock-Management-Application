import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import BarcodeScanner from '../components/BarcodeScanner';

const ScannerPage = () => {
    const [activeTab, setActiveTab] = useState('camera');
    const [scannedData, setScannedData] = useState(null);
    const [message, setMessage] = useState('İşlem seçin ve başlayın');
    const [loading, setLoading] = useState(false);
    const [isExistingProduct, setIsExistingProduct] = useState(false);

    const [brand, setBrand] = useState('');
    const [productName, setProductName] = useState('');
    const [color, setColor] = useState('');
    const [sizeType, setSizeType] = useState('');
    const [dimensions, setDimensions] = useState('');
    const [quantityToAdd, setQuantityToAdd] = useState(1);

    const [manualBarcode, setManualBarcode] = useState('');
    const [inventoryList, setInventoryList] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [customerName, setCustomerName] = useState('');

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        try {
            const res = await axios.get("http://127.0.0.1:8000/inventory");
            setInventoryList(res.data);
        } catch (error) {
            console.error("Envanter çekilemedi.");
        }
    };

    const clearForm = () => {
        setScannedData(null);
        setBrand('');
        setProductName('');
        setColor('');
        setSizeType('');
        setDimensions('');
        setQuantityToAdd(1);
        setManualBarcode('');
        setCustomerName('');
        setMessage('İşlem seçin ve başlayın');
        setIsExistingProduct(false);
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setManualBarcode(value);

        if (value.trim().length > 0) {
            const filtered = inventoryList.filter(item =>
                item.product_name.toLowerCase().includes(value.toLowerCase()) ||
                (item.brand && item.brand.toLowerCase().includes(value.toLowerCase())) ||
                item.barcode_no.includes(value)
            ).slice(0, 5);
            setSuggestions(filtered);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (item) => {
        setManualBarcode(item.barcode_no);
        setShowSuggestions(false);
        processBarcode(item.barcode_no);
    };

    const processBarcode = async (barcode) => {
        if (!barcode) return;
        setLoading(true);
        setMessage("Sorgulanıyor...");
        setShowSuggestions(false);

        try {
            const response = await axios.get(`http://127.0.0.1:8000/product/${barcode}`);
            if (response.data.status === "success") {
                const data = response.data.data;
                setScannedData(data);
                setBrand(data.brand || '');
                setProductName(data.product_name);
                setColor(data.color || '');
                setSizeType(data.size_type || '');
                setDimensions(data.dimensions || '');
                setIsExistingProduct(true);
                setMessage("Ürün Bulundu (Satış Yapabilirsiniz)");
            } else {
                setScannedData({ barcode_no: barcode, current_stock: 0 });
                setBrand("");
                setProductName("");
                setColor(''); setSizeType(''); setDimensions('');
                setIsExistingProduct(false);
                setMessage("Yeni Ürün (Bilgileri Girin)");
            }
        } catch (error) {
            setMessage("Sistem hatası.");
            toast.error("Bağlantı hatası!");
        }
        setLoading(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        setLoading(true);
        setMessage("Fotoğraf İşleniyor...");
        try {
            const res = await axios.post("http://127.0.0.1:8000/product/scan-image", formData);
            if (res.data.status === "success") {
                const data = res.data.data;
                setScannedData(data);
                setBrand(data.brand || '');
                setProductName(data.product_name);
                setColor(data.color || '');
                setSizeType(data.size_type || '');
                setDimensions(data.dimensions || '');
                setIsExistingProduct(true);
                setMessage("Fotoğraftan Okundu");
            } else {
                setScannedData({ barcode_no: res.data.barcode_no, current_stock: 0 });
                setBrand("");
                setProductName("");
                setColor(''); setSizeType(''); setDimensions('');
                setIsExistingProduct(false);
                setMessage("Yeni Barkod");
            }
        } catch (err) {
            setMessage("Barkod okunamadı.");
            toast.error("Barkod net değil.");
        }
        setLoading(false);
    };

    const saveToStock = async () => {
        if (!productName) {
            toast.error("Lütfen ürün adını girin!");
            return;
        }

        // YENİ: Eksi veya 0 rakam engelleyicisi
        const qty = parseInt(quantityToAdd);
        if (isNaN(qty) || qty <= 0) {
            toast.error("Eklenecek adet 1'den küçük olamaz!");
            return;
        }

        try {
            const payload = {
                barcode_no: scannedData.barcode_no,
                brand: brand,
                product_name: productName,
                color: color,
                size_type: sizeType,
                dimensions: dimensions,
                category: "Ev Tekstili",
                current_stock: qty,
                price: 0.0
            };
            await axios.post("http://127.0.0.1:8000/product/save", payload);
            toast.success(`${qty} adet stoğa eklendi!`);

            clearForm();
            fetchInventory();
        } catch (error) {
            toast.error("Kayıt sırasında bir hata oluştu.");
        }
    };

    const sellStock = async () => {
        // YENİ: Eksi veya 0 satış engelleyicisi
        const qty = parseInt(quantityToAdd);
        if (isNaN(qty) || qty <= 0) {
            toast.error("Satış adedi 1'den küçük olamaz!");
            return;
        }

        if (scannedData.current_stock < qty) {
            toast.error("Yetersiz stok! Mevcuttan fazlasını satamazsınız.");
            return;
        }

        try {
            const payload = {
                barcode_no: scannedData.barcode_no,
                quantity: qty,
                customer_name: customerName
            };
            await axios.post("http://127.0.0.1:8000/product/sell", payload);

            const msgName = customerName.trim() ? ` (${customerName})` : '';
            toast.success(`${qty} adet satıldı${msgName}!`, {
                icon: '🛒',
                style: { background: '#f59e0b', color: '#fff' }
            });

            clearForm();
            fetchInventory();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Satış işlemi başarısız.");
        }
    };

    return (
        <div className="App">
            <h2 style={{ color: '#1f2937', fontSize: '22px', fontWeight: '700', margin: '10px 0 20px 0' }}>
                📦 Mal Kabul & Kasa
            </h2>

            {!scannedData ? (
                <>
                    <div className="tab-container">
                        <button className={`tab-btn ${activeTab === 'camera' ? 'active' : ''}`} onClick={() => setActiveTab('camera')}>📷 Kamera</button>
                        <button className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>🔍 Elle Ara</button>
                        <button className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`} onClick={() => setActiveTab('image')}>🖼️ Fotoğraf</button>
                    </div>

                    {activeTab === 'search' && (
                        <div className="card compact-card" style={{ zIndex: 50, position: 'relative' }}>
                            <label className="form-label">Ürün Ara veya Barkod Gir:</label>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <input
                                        type="text" value={manualBarcode} onChange={handleInputChange}
                                        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') processBarcode(manualBarcode.trim()) }}
                                        className="custom-input" style={{ margin: 0, height: '46px' }} placeholder="Örn: Taç Nevresim..."
                                    />
                                    {showSuggestions && suggestions.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', listStyle: 'none', padding: 0, margin: '8px 0 0 0', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                                            {suggestions.map(item => (
                                                <li key={item.id} onClick={() => handleSuggestionClick(item)} style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer', textAlign: 'left', fontSize: '14px' }}>
                                                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                                                        {item.brand && <span style={{ color: '#0066cc', marginRight: '5px' }}>{item.brand}</span>}
                                                        {item.product_name}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                                        {item.color && <span>{item.color} | </span>} {item.barcode_no}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <button className="main-button btn-blue" style={{ margin: 0, width: '85px', height: '46px', padding: 0 }} onClick={() => processBarcode(manualBarcode.trim())}>BUL</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'camera' && (
                        <div className="card compact-card" style={{ padding: '10px' }}>
                            <BarcodeScanner onScanSuccess={processBarcode} />
                        </div>
                    )}

                    {activeTab === 'image' && (
                        <div className="card compact-card">
                            <label className="form-label">Kamera netlemezse fotoğraf yükleyin:</label>
                            <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="custom-input" style={{ marginTop: '8px' }} />
                        </div>
                    )}
                </>
            ) : (
                <div className="card compact-card" style={{ borderTop: isExistingProduct ? '4px solid #3b82f6' : '4px solid #10b981', marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, color: isExistingProduct ? '#2563eb' : '#047857', fontSize: '16px' }}>{message}</h4>
                        <span style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '6px' }}>{scannedData.barcode_no}</span>
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '5px' }}>
                            <div style={{ flex: 1 }}>
                                <label className="form-label">Marka:</label>
                                <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} className="custom-input" placeholder="Örn: Taç" disabled={isExistingProduct} />
                            </div>
                            <div style={{ flex: 2 }}>
                                <label className="form-label">Ürün Adı:</label>
                                <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} className="custom-input" placeholder="Zorunlu Alan" disabled={isExistingProduct} />
                            </div>
                        </div>

                        <div className="stock-box">
                            <div>
                                <span style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Mevcut Stok</span>
                                <span style={{ fontSize: '22px', fontWeight: '700', color: '#1f2937' }}>{scannedData.current_stock}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>İşlem Adedi</span>
                                <input type="number" value={quantityToAdd} onChange={(e) => setQuantityToAdd(e.target.value)} className="custom-input" style={{ width: '90px', margin: 0, textAlign: 'center', height: '40px', fontWeight: '600' }} min="1" />
                            </div>
                        </div>

                        {isExistingProduct && (
                            <div style={{ marginTop: '15px', backgroundColor: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                <label style={{ display: 'block', fontSize: '13px', color: '#1e3a8a', fontWeight: 'bold', marginBottom: '5px' }}>Müşteri Adı Soyadı (Opsiyonel)</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="custom-input"
                                    style={{ margin: 0, height: '40px' }}
                                    placeholder="Örn: Ayşe Yılmaz"
                                />
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                            <button className="main-button btn-green" onClick={saveToStock} style={{ flex: 1, padding: '12px', margin: 0 }}>➕ STOK EKLE</button>
                            {isExistingProduct && (
                                <button className="main-button" onClick={sellStock} style={{ flex: 1, padding: '12px', margin: 0, backgroundColor: '#f59e0b', boxShadow: '0 4px 10px rgba(245, 158, 11, 0.2)' }}>🛒 SATIŞ YAP</button>
                            )}
                        </div>

                        <button onClick={clearForm} style={{ width: '100%', padding: '12px', marginTop: '12px', backgroundColor: '#fef2f2', color: '#ef4444', border: '2px solid #fecaca', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
                            ❌ İŞLEMİ İPTAL ET
                        </button>
                    </div>
                </div>
            )}

            <button onClick={() => window.location.href = '/'} style={{ color: '#6b7280', background: 'none', border: 'none', fontSize: '15px', fontWeight: '500', textDecoration: 'underline', cursor: 'pointer', margin: '15px 0', padding: '10px' }}>Ana Sayfaya Dön</button>
        </div>
    );
};

export default ScannerPage;