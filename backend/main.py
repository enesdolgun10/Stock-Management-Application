from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import re

from ocr_utils import read_barcode_from_image, extract_text_from_invoice, extract_text_from_pdf

app = FastAPI(title="Esnaf Stok Sistemi API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# YENİ VE KALICI SUPABASE VERİTABANIMIZ!
# DİKKAT: [YOUR-PASSWORD] yazan yere Supabase şifreni yaz!
DATABASE_URL = "postgresql://postgres.qnqfhahwclldcoherekt:JH!LewWB8!kKKw,@aws-1-eu-central-1.pooler.supabase.com:6543/postgres"

class Product(BaseModel):
    barcode_no: str
    brand: Optional[str] = ""  
    product_name: str
    category: Optional[str] = "Ev Tekstili"
    color: Optional[str] = ""
    size_type: Optional[str] = ""      
    dimensions: Optional[str] = ""     
    price: Optional[float] = 0.0
    current_stock: int = 0

class SellRequest(BaseModel):
    barcode_no: str
    quantity: int
    customer_name: Optional[str] = "Perakende Müşteri"

class ProductUpdate(BaseModel):
    brand: Optional[str] = ""
    product_name: str
    color: Optional[str] = ""
    size_type: Optional[str] = ""
    dimensions: Optional[str] = ""
    current_stock: int

class BulkSaveRequest(BaseModel):
    items: List[Product]

def get_db_connection():
    # PostgreSQL veritabanına bağlanır
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # PostgreSQL uyumlu tablo oluşturma (AUTOINCREMENT yerine SERIAL kullanıyoruz)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Products (
            id SERIAL PRIMARY KEY,
            barcode_no TEXT UNIQUE NOT NULL,
            brand TEXT DEFAULT '',
            product_name TEXT NOT NULL,
            category TEXT,
            color TEXT,
            size_type TEXT,
            dimensions TEXT,
            price REAL,
            current_stock INTEGER DEFAULT 0
        )
    ''')
        
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Sales (
            id SERIAL PRIMARY KEY,
            barcode_no TEXT NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            customer_name TEXT DEFAULT 'Perakende Müşteri',
            sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    cursor.close()
    conn.close()

# Sunucu ilk açıldığında tabloları oluştur
try:
    init_db()
    print("✅ Bulut Veritabanına (Supabase) Başarıyla Bağlanıldı ve Tablolar Hazır!")
except Exception as e:
    print(f"❌ Veritabanı Bağlantı Hatası (Şifreni kontrol et!): {str(e)}")


@app.get("/")
def read_root():
    return {"status": "online"}

@app.get("/inventory")
async def get_all_inventory():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Products ORDER BY id DESC")
    items = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(row) for row in items]

@app.get("/product/{barcode}")
async def get_product(barcode: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    # PostgreSQL'de ? yerine %s kullanılır
    cursor.execute("SELECT * FROM Products WHERE barcode_no = %s", (barcode,))
    product = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if product is None:
        return {"status": "not_found", "barcode_no": barcode}
    
    return {"status": "success", "data": dict(product)}

@app.post("/product/scan-image")
async def scan_image(file: UploadFile = File(...)):
    contents = await file.read()
    barcode = read_barcode_from_image(contents)
    if not barcode:
        raise HTTPException(status_code=400, detail="Barkod okunamadı.")
    return await get_product(barcode)

@app.post("/product/save")
def save_product(product: Product):
    if product.current_stock <= 0:
        raise HTTPException(status_code=400, detail="Stok miktarı 1'den küçük olamaz!")
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # PostgreSQL UPSERT Sözdizimi
        cursor.execute('''
            INSERT INTO Products (barcode_no, brand, product_name, category, color, size_type, dimensions, price, current_stock)
            VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (barcode_no) DO UPDATE SET
                brand = EXCLUDED.brand,
                product_name = EXCLUDED.product_name,
                color = EXCLUDED.color,
                size_type = EXCLUDED.size_type,
                dimensions = EXCLUDED.dimensions,
                current_stock = Products.current_stock + EXCLUDED.current_stock
        ''', (product.barcode_no, product.brand, product.product_name, product.category, product.color, product.size_type, product.dimensions, product.price, product.current_stock))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.post("/product/bulk-save")
def bulk_save_products(request: BulkSaveRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        for product in request.items:
            if product.current_stock <= 0:
                continue
                
            cursor.execute('''
                INSERT INTO Products (barcode_no, brand, product_name, category, color, size_type, dimensions, price, current_stock)
                VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (barcode_no) DO UPDATE SET
                    product_name = EXCLUDED.product_name,
                    brand = CASE WHEN EXCLUDED.brand != '' THEN EXCLUDED.brand ELSE Products.brand END,
                    current_stock = Products.current_stock + EXCLUDED.current_stock
            ''', (product.barcode_no, product.brand, product.product_name, product.category, product.color, product.size_type, product.dimensions, product.price, product.current_stock))
        conn.commit()
        return {"status": "success", "message": f"{len(request.items)} kalem ürün stoğa işlendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.post("/product/sell")
def sell_product(req: SellRequest):
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Satış adedi 1'den küçük olamaz!")
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT product_name, brand, current_stock FROM Products WHERE barcode_no = %s", (req.barcode_no,))
        product = cursor.fetchone()
        
        if not product:
            raise HTTPException(status_code=404, detail="Ürün bulunamadı")
        
        if product['current_stock'] < req.quantity:
            raise HTTPException(status_code=400, detail="Yetersiz stok! Mevcut stoktan fazlasını satamazsınız.")
            
        cursor.execute('UPDATE Products SET current_stock = current_stock - %s WHERE barcode_no = %s', (req.quantity, req.barcode_no))
        
        full_name = f"{product['brand']} {product['product_name']}".strip()
        customer = req.customer_name if req.customer_name.strip() else "Perakende Müşteri"
        
        cursor.execute('INSERT INTO Sales (barcode_no, product_name, quantity, customer_name) VALUES (%s, %s, %s, %s)', (req.barcode_no, full_name, req.quantity, customer))
        
        conn.commit()
        new_stock = product['current_stock'] - req.quantity
        return {"status": "success", "new_stock": new_stock}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.get("/sales")
async def get_sales_history(timeframe: str = "all"):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM Sales"
    
    # PostgreSQL uyumlu tarih filtreleri
    if timeframe == "daily":
        query += " WHERE DATE(sale_date) = CURRENT_DATE"
    elif timeframe == "weekly":
        query += " WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'"
    elif timeframe == "monthly":
        query += " WHERE sale_date >= CURRENT_DATE - INTERVAL '1 month'"
    elif timeframe == "3months":
        query += " WHERE sale_date >= CURRENT_DATE - INTERVAL '3 months'"
        
    query += " ORDER BY sale_date DESC LIMIT 1000"
    
    cursor.execute(query)
    items = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(row) for row in items]

@app.delete("/sales/{item_id}")
def delete_sale(item_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Sales WHERE id = %s", (item_id,))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.delete("/inventory/{item_id}")
def delete_item(item_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Products WHERE id = %s", (item_id,))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.put("/inventory/{item_id}")
def update_item(item_id: int, item: ProductUpdate):
    if item.current_stock < 0:
        raise HTTPException(status_code=400, detail="Stok eksi değere düşürülemez!")
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE Products 
            SET brand = %s, product_name = %s, color = %s, size_type = %s, dimensions = %s, current_stock = %s
            WHERE id = %s
        ''', (item.brand, item.product_name, item.color, item.size_type, item.dimensions, item.current_stock, item_id))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.post("/invoice/scan")
async def scan_invoice(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        raw_lines = []
        if file.filename.lower().endswith('.pdf') or file.content_type == 'application/pdf':
            raw_lines = extract_text_from_pdf(contents)
        else:
            raw_lines = extract_text_from_invoice(contents)
        
        if not raw_lines:
            raise HTTPException(status_code=400, detail="Dosyadan yazı okunamadı.")
        
        parsed_items = []
        blacklist = ["MERSIS", "MERSİS", "FATURA", "VKN", "TCKN", "IBAN", "TARIH", "TARİH", "İRSALİYE", "IRSALIYE", "VERGİ", "VERGI", "TEL:", "FAX:", "E-POSTA", "TOPLAM", "İNDİRİM", "İSKONTO"]
        
        for line in raw_lines:
            if any(blacklisted_word in line.upper() for blacklisted_word in blacklist):
                continue
                
            barcode_match = re.search(r'\b(\d{13})\b', line)
            
            if barcode_match:
                barcode = barcode_match.group(1)
                
                qty = 1
                qty_match = re.search(r'(?i)(\d+)\s*(Adet|Ad\.|AD|Adt)', line)
                if qty_match:
                    qty = int(qty_match.group(1))
                
                clean_name = line.replace(barcode, '').strip()
                if qty_match:
                    clean_name = re.sub(r'(?i)\d+\s*(Adet|Ad\.|AD|Adt)', '', clean_name).strip()
                    
                clean_name = re.sub(r'\d+[,\.]?\d*\s*TL', '', clean_name).strip() 
                clean_name = re.sub(r'%\s*\d+[,\.]?\d*', '', clean_name).strip() 
                clean_name = re.sub(r'^\d+\s*\.?\s*', '', clean_name).strip() 
                clean_name = re.sub(r'\s+', ' ', clean_name).replace('|', '').strip()
                clean_name = re.sub(r'(?:\s+\d+\s*\.?)+$', '', clean_name).strip()
                
                if len(clean_name) > 3:
                    item_data = {
                        "barcode_no": barcode,
                        "product_name": clean_name[:60],
                        "qty": qty
                    }
                    
                    existing = next((i for i in parsed_items if i["barcode_no"] == barcode), None)
                    if existing:
                        existing["qty"] += qty
                    else:
                        parsed_items.append(item_data)
                        
        return {
            "status": "success",
            "parsed_items": parsed_items
        }
    except Exception as e:
        import traceback
        print("FATURA OKUMA HATASI:\n", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Sunucu Hatası: {str(e)}")

@app.get("/dashboard-stats")
async def get_dashboard_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) as count FROM Products")
        total_items = cursor.fetchone()['count']
        
        cursor.execute("SELECT SUM(current_stock) as total FROM Products")
        total_stock_query = cursor.fetchone()['total']
        total_stock = total_stock_query if total_stock_query else 0
        
        cursor.execute("SELECT barcode_no, brand, product_name, current_stock FROM Products WHERE current_stock <= 5 AND current_stock > 0 ORDER BY current_stock ASC")
        low_stock_items = cursor.fetchall()
        
        cursor.execute("SELECT barcode_no, brand, product_name, current_stock FROM Products WHERE current_stock <= 0 ORDER BY product_name ASC")
        out_of_stock = cursor.fetchall()
        
        return {
            "status": "success",
            "total_items": total_items,
            "total_stock": total_stock,
            "low_stock": [dict(row) for row in low_stock_items],
            "out_of_stock": [dict(row) for row in out_of_stock]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()