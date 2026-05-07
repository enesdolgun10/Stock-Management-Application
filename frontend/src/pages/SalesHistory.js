import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const SalesHistory = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [timeframe, setTimeframe] = useState('all');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

    useEffect(() => {
        fetchSales();
    }, [timeframe]);

    const fetchSales = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/sales?timeframe=${timeframe}`);
            setSales(res.data);
            setSelectedItems([]);
        } catch (err) {
            toast.error("Satış verileri alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const filteredSales = sales.filter(item => {
        const search = searchTerm.toLowerCase();
        return (
            item.product_name.toLowerCase().includes(search) ||
            item.barcode_no.includes(search) ||
            item.sale_date.includes(search) ||
            (item.customer_name && item.customer_name.toLowerCase().includes(search))
        );
    });

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = filteredSales.map(item => item.id);
            setSelectedItems(allIds);
        } else {
            setSelectedItems([]);
        }
    };

    const handleSelectItem = (id) => {
        if (selectedItems.includes(id)) {
            setSelectedItems(selectedItems.filter(itemId => itemId !== id));
        } else {
            setSelectedItems([...selectedItems, id]);
        }
    };

    const handleDeleteClick = (item) => {
        setSelectedItems([]);
        setItemToDelete(item);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await axios.delete(`/sales/${itemToDelete.id}`);
            toast.success("Satış kaydı silindi.");
            fetchSales();
        } catch (error) {
            toast.error("Silme işlemi başarısız.");
        } finally {
            setDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    const confirmBulkDelete = async () => {
        if (selectedItems.length === 0) return;
        try {
            await Promise.all(selectedItems.map(id => axios.delete(`/sales/${id}`)));
            toast.success(`${selectedItems.length} adet satış kaydı silindi.`);
            fetchSales();
        } catch (error) {
            toast.error("Toplu silme sırasında bir hata oluştu.");
        } finally {
            setBulkDeleteModalOpen(false);
            setSelectedItems([]);
        }
    };

    const exportToExcel = () => {
        const itemsToExport = selectedItems.length > 0
            ? filteredSales.filter(item => selectedItems.includes(item.id))
            : filteredSales;

        if (itemsToExport.length === 0) {
            toast.error("Dışa aktarılacak veri bulunamadı!");
            return;
        }

        const dataToExport = itemsToExport.map(item => ({
            "İşlem Tarihi": formatDate(item.sale_date),
            "Müşteri Adı": item.customer_name || 'Perakende Müşteri',
            "Satılan Ürün": item.product_name,
            "Barkod No": item.barcode_no,
            "Adet": item.quantity
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const wscols = [{ wch: 20 }, { wch: 25 }, { wch: 50 }, { wch: 15 }, { wch: 10 }];
        worksheet['!cols'] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Satis_Gecmisi");

        const dateStr = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Satis_Raporu_${dateStr}.xlsx`);

        if (selectedItems.length > 0) {
            toast.success(`${selectedItems.length} seçili kayıt Excel'e aktarıldı!`, { icon: '📊' });
        } else {
            toast.success("Tüm liste Excel'e aktarıldı!", { icon: '📊' });
        }
    };

    return (
        <div className="App wide" style={{ position: 'relative' }}>
            {deleteModalOpen && itemToDelete && (
                <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(3px)' }}>
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '15px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
                        <div style={{ fontSize: '40px', marginBottom: '15px' }}>⚠️</div>
                        <h3 style={{ color: '#1f2937', margin: '0 0 10px 0', fontSize: '20px' }}>Kaydı Silmek Üzeresiniz</h3>
                        <p style={{ color: '#4b5563', fontSize: '15px', marginBottom: '25px', lineHeight: '1.5' }}>
                            <strong style={{ color: '#1e40af' }}>{itemToDelete.customer_name}</strong> isimli müşteriye ait <strong style={{ color: '#ef4444' }}>{itemToDelete.product_name}</strong> satış kaydını tamamen silmek istediğinize emin misiniz? <br /><br />(Not: Bu işlem stoğu geri yüklemez, sadece defterden siler.)
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setDeleteModalOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>İptal Et</button>
                            <button onClick={confirmDelete} style={{ flex: 1, padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Evet, Sil</button>
                        </div>
                    </div>
                </div>
            )}

            {bulkDeleteModalOpen && (
                <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(3px)' }}>
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '15px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
                        <div style={{ fontSize: '40px', marginBottom: '15px' }}>🗑️</div>
                        <h3 style={{ color: '#b91c1c', margin: '0 0 10px 0', fontSize: '20px' }}>Toplu Silme Onayı</h3>
                        <p style={{ color: '#4b5563', fontSize: '15px', marginBottom: '25px', lineHeight: '1.5' }}>
                            Seçili olan <strong style={{ color: '#ef4444', fontSize: '18px' }}>{selectedItems.length}</strong> adet satış kaydını tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz!
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setBulkDeleteModalOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>İptal Et</button>
                            <button onClick={confirmBulkDelete} style={{ flex: 1, padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Evet, Hepsini Sil</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', marginTop: '10px' }}>
                <h2 style={{ color: '#d97706', fontSize: '26px', fontWeight: '800', margin: 0 }}>
                    📊 Satış Geçmişi & Hareketler
                </h2>
                <button onClick={() => window.location.href = '/'} style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '2px solid #e5e7eb', borderRadius: '10px', color: '#4b5563', fontWeight: '600', cursor: 'pointer' }}>
                    Ana Menüye Dön
                </button>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div className="search-container" style={{ flex: 1, margin: 0, minWidth: '250px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Müşteri, ürün adı veya barkod ara..."
                        className="custom-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ margin: 0, border: 'none', backgroundColor: 'transparent', fontSize: '16px', boxShadow: 'none' }}
                    />
                </div>

                <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="custom-input"
                    style={{ margin: 0, width: 'auto', fontWeight: 'bold', color: '#1e40af', border: '2px solid #bfdbfe', backgroundColor: '#eff6ff', cursor: 'pointer' }}
                >
                    <option value="all">Tüm Zamanlar</option>
                    <option value="daily">📅 Bugün (Günlük)</option>
                    <option value="weekly">📆 Son 1 Hafta</option>
                    <option value="monthly">🗓️ Son 1 Ay</option>
                    <option value="3months">📚 Son 3 Ay</option>
                </select>

                <button
                    onClick={exportToExcel}
                    style={{
                        padding: '0 20px', backgroundColor: '#10b981', color: 'white', border: 'none',
                        borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(16,185,129,0.3)'
                    }}
                >
                    📊 Excel Raporu
                </button>

                {selectedItems.length > 0 && (
                    <button onClick={() => setBulkDeleteModalOpen(true)} style={{ padding: '0 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(239,68,68,0.3)' }}>
                        🗑️ Seçilenleri Sil ({selectedItems.length})
                    </button>
                )}
            </div>

            <div className="modern-table-container">
                {loading ? (
                    <div style={{ padding: '40px', color: '#6b7280', fontSize: '18px', fontWeight: '500' }}>Veriler yükleniyor...</div>
                ) : (
                    <table className="inventory-table">
                        <thead>
                            <tr>
                                <th style={{ width: '5%', textAlign: 'center' }}><input type="checkbox" style={{ transform: 'scale(1.2)', cursor: 'pointer' }} onChange={handleSelectAll} checked={filteredSales.length > 0 && selectedItems.length === filteredSales.length} /></th>
                                <th style={{ width: '15%' }}>Tarih</th>
                                <th style={{ width: '20%' }}>Müşteri</th>
                                <th style={{ width: '40%' }}>Satılan Ürün</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>Adet</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '16px' }}>Seçilen tarih aralığında satış kaydı bulunmuyor.</td>
                                </tr>
                            ) : (
                                filteredSales.map((item) => (
                                    <tr key={item.id} style={{ backgroundColor: selectedItems.includes(item.id) ? '#fef2f2' : 'transparent' }}>
                                        <td style={{ textAlign: 'center' }}><input type="checkbox" style={{ transform: 'scale(1.2)', cursor: 'pointer' }} checked={selectedItems.includes(item.id)} onChange={() => handleSelectItem(item.id)} /></td>
                                        <td style={{ color: '#6b7280', fontWeight: '500', fontSize: '14px' }}>{formatDate(item.sale_date)}</td>
                                        <td style={{ color: '#1e40af', fontWeight: '700', fontSize: '15px' }}>{item.customer_name || 'Perakende Müşteri'}</td>
                                        <td style={{ color: '#111827', fontWeight: '600' }}>
                                            {item.product_name}
                                            <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace', marginTop: '4px' }}>{item.barcode_no}</div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}><span style={{ fontWeight: '800', fontSize: '16px', color: '#b45309', backgroundColor: '#fef3c7', padding: '6px 12px', borderRadius: '8px' }}>- {item.quantity}</span></td>
                                        <td style={{ textAlign: 'center' }}><button onClick={() => handleDeleteClick(item)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#ef4444' }} title="Kaydı Sil">🗑️</button></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default SalesHistory;