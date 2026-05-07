import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const Inventory = () => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [editingId, setEditingId] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'descending' });
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        try {
            const res = await axios.get("/inventory");
            setInventory(res.data);
            setSelectedItems([]);
        } catch (error) {
            toast.error("Stok verileri alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const processedInventory = useMemo(() => {
        let filtered = inventory.filter(item => {
            const search = searchTerm.toLowerCase();
            return (
                item.product_name.toLowerCase().includes(search) ||
                item.barcode_no.includes(search) ||
                (item.brand && item.brand.toLowerCase().includes(search))
            );
        });

        if (sortConfig !== null) {
            filtered.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';
                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = typeof bValue === 'string' ? bValue.toLowerCase() : bValue;
                }
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [inventory, sortConfig, searchTerm]);

    const getSortIcon = (columnName) => {
        if (!sortConfig || sortConfig.key !== columnName) return ' ↕️';
        return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = processedInventory.map(item => item.id);
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

    const handleEditClick = (item) => {
        setSelectedItems([]);
        setEditingId(item.id);
        setEditFormData({
            brand: item.brand || '',
            product_name: item.product_name || '',
            color: item.color || '',
            size_type: item.size_type || '',
            current_stock: item.current_stock || 0
        });
    };

    const handleEditFormChange = (e, fieldName) => {
        const value = e.target.value;
        setEditFormData({ ...editFormData, [fieldName]: value });
    };

    const handleSaveClick = async (id) => {
        try {
            await axios.put(`/inventory/${id}`, editFormData);
            toast.success("Ürün başarıyla güncellendi!");
            setEditingId(null);
            fetchInventory();
        } catch (error) {
            toast.error("Güncelleme başarısız oldu.");
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
            await axios.delete(`/inventory/${itemToDelete.id}`);
            toast.success("Ürün tamamen silindi.");
            fetchInventory();
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
            await Promise.all(selectedItems.map(id => axios.delete(`/inventory/${id}`)));
            toast.success(`${selectedItems.length} ürün tamamen silindi.`);
            fetchInventory();
        } catch (error) {
            toast.error("Toplu silme sırasında bir hata oluştu.");
        } finally {
            setBulkDeleteModalOpen(false);
            setSelectedItems([]);
        }
    };

    const exportToExcel = () => {
        const itemsToExport = selectedItems.length > 0
            ? processedInventory.filter(item => selectedItems.includes(item.id))
            : processedInventory;

        if (itemsToExport.length === 0) {
            toast.error("Dışa aktarılacak veri bulunamadı!");
            return;
        }

        const dataToExport = itemsToExport.map(item => ({
            "Barkod No": item.barcode_no,
            "Marka": item.brand || '-',
            "Ürün Adı": item.product_name,
            "Mevcut Stok": item.current_stock,
            "Kategori": item.category || 'Ev Tekstili'
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const wscols = [{ wch: 15 }, { wch: 15 }, { wch: 50 }, { wch: 15 }, { wch: 15 }];
        worksheet['!cols'] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Stok_Listesi");

        const dateStr = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Stok_Durumu_${dateStr}.xlsx`);

        if (selectedItems.length > 0) {
            toast.success(`${selectedItems.length} seçili ürün Excel'e aktarıldı!`, { icon: '📊' });
        } else {
            toast.success("Tüm liste Excel'e aktarıldı!", { icon: '📊' });
        }
    };

    const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '6px', margin: 0, border: '2px solid #3b82f6', borderRadius: '6px', fontSize: '14px' };

    return (
        <div className="App wide" style={{ position: 'relative' }}>
            {deleteModalOpen && itemToDelete && (
                <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(3px)' }}>
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '15px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
                        <div style={{ fontSize: '40px', marginBottom: '15px' }}>⚠️</div>
                        <h3 style={{ color: '#1f2937', margin: '0 0 10px 0', fontSize: '20px' }}>Ürünü Silmek Üzeresiniz</h3>
                        <p style={{ color: '#4b5563', fontSize: '15px', marginBottom: '25px', lineHeight: '1.5' }}>
                            <strong style={{ color: '#ef4444' }}>{itemToDelete.brand} {itemToDelete.product_name}</strong> isimli ürünü tamamen silmek istediğinize emin misiniz?
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
                            Seçili olan <strong style={{ color: '#ef4444', fontSize: '18px' }}>{selectedItems.length}</strong> adet ürünü tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz!
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setBulkDeleteModalOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>İptal Et</button>
                            <button onClick={confirmBulkDelete} style={{ flex: 1, padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Evet, Hepsini Sil</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', marginTop: '10px' }}>
                <h2 style={{ color: '#10b981', fontSize: '26px', fontWeight: '800', margin: 0 }}>
                    📋 Mevcut Stok Listesi
                </h2>
                <button onClick={() => window.location.href = '/'} style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '2px solid #e5e7eb', borderRadius: '10px', color: '#4b5563', fontWeight: '600', cursor: 'pointer' }}>
                    Ana Menüye Dön
                </button>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div className="search-container" style={{ flex: 1, margin: 0, minWidth: '250px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Marka, ürün adı veya barkod ile arama yapın..."
                        className="custom-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ margin: 0, border: 'none', backgroundColor: 'transparent', fontSize: '16px', boxShadow: 'none' }}
                    />
                </div>

                <button
                    onClick={exportToExcel}
                    style={{
                        padding: '0 20px', backgroundColor: '#10b981', color: 'white', border: 'none',
                        borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(16,185,129,0.3)'
                    }}
                >
                    📊 Excel'e İndir
                </button>

                {selectedItems.length > 0 && (
                    <button
                        onClick={() => setBulkDeleteModalOpen(true)}
                        style={{
                            padding: '0 20px', backgroundColor: '#ef4444', color: 'white', border: 'none',
                            borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(239,68,68,0.3)'
                        }}
                    >
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
                                <th style={{ width: '5%', textAlign: 'center' }}>
                                    <input type="checkbox" style={{ transform: 'scale(1.2)', cursor: 'pointer' }} onChange={handleSelectAll} checked={processedInventory.length > 0 && selectedItems.length === processedInventory.length} />
                                </th>
                                <th style={{ width: '15%', cursor: 'pointer' }} onClick={() => requestSort('barcode_no')}>Barkod No {getSortIcon('barcode_no')}</th>
                                <th style={{ width: '15%', cursor: 'pointer' }} onClick={() => requestSort('brand')}>Marka {getSortIcon('brand')}</th>
                                <th style={{ width: '35%', cursor: 'pointer' }} onClick={() => requestSort('product_name')}>Ürün Adı {getSortIcon('product_name')}</th>
                                <th style={{ width: '10%', cursor: 'pointer', textAlign: 'center' }} onClick={() => requestSort('current_stock')}>Stok {getSortIcon('current_stock')}</th>
                                <th style={{ width: '20%', textAlign: 'center' }}>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedInventory.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '16px' }}>Kayıtlı ürün bulunamadı.</td>
                                </tr>
                            ) : (
                                processedInventory.map((item) => (
                                    <tr key={item.id} style={{ backgroundColor: selectedItems.includes(item.id) ? '#fef2f2' : 'transparent' }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <input type="checkbox" style={{ transform: 'scale(1.2)', cursor: 'pointer' }} checked={selectedItems.includes(item.id)} onChange={() => handleSelectItem(item.id)} />
                                        </td>
                                        <td style={{ color: '#64748b', fontFamily: 'monospace' }}>{item.barcode_no}</td>
                                        <td>
                                            {editingId === item.id ? <input type="text" value={editFormData.brand} onChange={(e) => handleEditFormChange(e, 'brand')} style={inputStyle} /> : <span style={{ fontWeight: '600', color: '#1e40af' }}>{item.brand}</span>}
                                        </td>
                                        <td>
                                            {editingId === item.id ? <input type="text" value={editFormData.product_name} onChange={(e) => handleEditFormChange(e, 'product_name')} style={inputStyle} /> : <span style={{ fontWeight: '600', color: '#111827' }}>{item.product_name}</span>}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {editingId === item.id ? (
                                                <input type="number" value={editFormData.current_stock} onChange={(e) => handleEditFormChange(e, 'current_stock')} style={{ ...inputStyle, textAlign: 'center' }} min="0" />
                                            ) : (
                                                <span style={{ fontWeight: '800', fontSize: '15px', color: item.current_stock <= 5 ? '#ef4444' : '#059669', backgroundColor: item.current_stock <= 5 ? '#fee2e2' : '#d1fae5', padding: '4px 10px', borderRadius: '8px' }}>{item.current_stock}</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {editingId === item.id ? (
                                                <div style={{ display: 'flex', gap: '5px', justifyItems: 'center', justifyContent: 'center' }}>
                                                    <button onClick={() => handleSaveClick(item.id)} style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Kaydet</button>
                                                    <button onClick={() => setEditingId(null)} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>İptal</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '10px', justifyItems: 'center', justifyContent: 'center' }}>
                                                    <button onClick={() => handleEditClick(item)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#3b82f6' }} title="Düzenle">✏️</button>
                                                    <button onClick={() => handleDeleteClick(item)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#ef4444' }} title="Sil">🗑️</button>
                                                </div>
                                            )}
                                        </td>
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

export default Inventory;