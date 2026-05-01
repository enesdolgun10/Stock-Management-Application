import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const InvoicePage = () => {
    const [loadingInvoice, setLoadingInvoice] = useState(false);
    const [draftItems, setDraftItems] = useState([]);

    // YENİ: Toplu Marka Etiketi için State
    const [globalBrand, setGlobalBrand] = useState('');

    const handleInvoiceUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoadingInvoice(true);
        toast.loading("Belge analiz ediliyor...", { id: 'ocr-toast' });

        try {
            const res = await axios.post("https://stock-management-application.onrender.com/invoice/scan", formData);
            if (res.data.status === "success") {
                const parsed = res.data.parsed_items.map(item => ({
                    barcode_no: item.barcode_no,
                    product_name: item.product_name,
                    current_stock: item.qty
                }));

                if (parsed.length > 0) {
                    setDraftItems(parsed);
                    toast.success(`${parsed.length} farklı ürün bulundu. Lütfen kontrol edin!`, { id: 'ocr-toast', duration: 4000 });
                } else {
                    toast.error("Belgede okunabilir ürün barkodu bulunamadı.", { id: 'ocr-toast' });
                }
            }
        } catch (error) {
            toast.error("Belge okunamadı. Dosyayı kontrol edin.", { id: 'ocr-toast' });
        }
        setLoadingInvoice(false);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...draftItems];
        newItems[index][field] = value;
        setDraftItems(newItems);
    };

    const handleRemoveItem = (index) => {
        const newItems = draftItems.filter((_, i) => i !== index);
        setDraftItems(newItems);
    };

    const handleAddManualRow = () => {
        setDraftItems([{ barcode_no: "", product_name: "", current_stock: 1 }, ...draftItems]);
    };

    const handleApproveAndSave = async () => {
        const validItems = draftItems.filter(item => item.barcode_no.trim() !== "" && item.product_name.trim() !== "");

        if (validItems.length === 0) {
            toast.error("Kaydedilecek geçerli ürün yok!");
            return;
        }

        // YENİ: Girilen markayı tablodaki tüm ürünlere otomatik olarak zımbala
        const itemsToSave = validItems.map(item => ({
            ...item,
            brand: globalBrand.trim(),
            category: "Ev Tekstili"
        }));

        try {
            const payload = { items: itemsToSave };
            await axios.post("https://stock-management-application.onrender.com/product/bulk-save", payload);

            toast.success(`${validItems.length} ürün '${globalBrand}' markasıyla stoğa eklendi!`, {
                style: { padding: '16px', color: '#fff', background: '#10b981', fontWeight: 'bold' }
            });

            setDraftItems([]);
            setGlobalBrand(''); // Masayı temizlerken markayı da sıfırla
        } catch (error) {
            toast.error("Kaydedilirken hata oluştu.");
        }
    };

    return (
        <div className="App wide">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px' }}>
                <h2 style={{ color: '#8b5cf6', fontSize: '24px', fontWeight: '800', margin: 0 }}>
                    🧾 Fatura İçe Aktarma & Onay Masası
                </h2>
                <button onClick={() => window.location.href = '/'} style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', color: '#4b5563', fontWeight: '600', cursor: 'pointer' }}>
                    Ana Menüye Dön
                </button>
            </div>

            <div className="card compact-card" style={{ borderTop: '4px solid #8b5cf6', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: '#4c1d95', fontSize: '18px' }}>1. Belgeyi Yükle</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '15px' }}>Dükkana gelen malların E-Faturasını (PDF) veya İrsaliye fotoğrafını seçin.</p>
                <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={handleInvoiceUpload}
                    className="custom-input"
                    disabled={loadingInvoice}
                    style={{ maxWidth: '400px' }}
                />
            </div>

            {draftItems.length > 0 && (
                <div className="card compact-card" style={{ borderTop: '4px solid #f59e0b', padding: '20px' }}>

                    {/* YENİ: MARKA ETİKETLEME ALANI */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: '#eff6ff', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #bfdbfe' }}>
                        <span style={{ fontSize: '28px' }}>🏷️</span>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '14px', color: '#1e3a8a', fontWeight: 'bold', marginBottom: '6px' }}>
                                Faturaya Ait Marka (Eklenen tüm ürünlere işlenecektir)
                            </label>
                            <input
                                type="text"
                                value={globalBrand}
                                onChange={(e) => setGlobalBrand(e.target.value)}
                                className="custom-input"
                                style={{ margin: 0, maxWidth: '300px', border: '1px solid #93c5fd' }}
                                placeholder="Örn: Özdilek, Taç, Karaca..."
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <div>
                            <h3 style={{ margin: 0, color: '#d97706', fontSize: '18px' }}>2. Listeyi Kontrol Et ve Düzenle</h3>
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>Eksik veya hatalı okunan yerleri tablodan düzeltebilirsiniz.</p>
                        </div>
                        <button onClick={handleAddManualRow} style={{ padding: '8px 16px', backgroundColor: '#e0e7ff', color: '#4f46e5', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                            ➕ Yeni Satır Ekle
                        </button>
                    </div>

                    <div className="modern-table-container">
                        <table className="inventory-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '20%' }}>Barkod No</th>
                                    <th style={{ width: '55%' }}>Ürün Adı</th>
                                    <th style={{ width: '15%', textAlign: 'center' }}>Gelen Adet</th>
                                    <th style={{ width: '10%', textAlign: 'center' }}>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {draftItems.map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            <input
                                                type="text"
                                                value={item.barcode_no}
                                                onChange={(e) => handleItemChange(index, 'barcode_no', e.target.value)}
                                                className="custom-input"
                                                style={{ margin: 0, padding: '8px', height: 'auto', fontFamily: 'monospace' }}
                                                placeholder="Barkod"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={item.product_name}
                                                onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                                                className="custom-input"
                                                style={{ margin: 0, padding: '8px', height: 'auto', fontWeight: '500' }}
                                                placeholder="Ürün Adı"
                                            />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                value={item.current_stock}
                                                onChange={(e) => handleItemChange(index, 'current_stock', parseInt(e.target.value) || 0)}
                                                className="custom-input"
                                                style={{ margin: 0, padding: '8px', height: 'auto', textAlign: 'center', fontWeight: 'bold', width: '80px' }}
                                                min="1"
                                            />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button onClick={() => handleRemoveItem(index)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '18px', cursor: 'pointer' }}>
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: '20px', textAlign: 'right', borderTop: '2px solid #f3f4f6', paddingTop: '20px' }}>
                        <button
                            className="main-button btn-green"
                            style={{ margin: 0, padding: '15px 40px', fontSize: '18px', display: 'inline-block', width: 'auto' }}
                            onClick={handleApproveAndSave}
                        >
                            ✅ LİSTEYİ ONAYLA VE STOĞA EKLE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoicePage;