from fastapi import FastAPI, HTTPException, File, UploadFile, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import re
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

from ocr_utils import read_barcode_from_image, extract_text_from_invoice, extract_text_from_pdf

app = FastAPI(title="Esnaf Stok Sistemi API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        res = supabase.auth.get_user(token)
        return res.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Yetkisiz erişim veya oturum süresi dolmuş!")

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
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Products (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL,
            barcode_no TEXT NOT NULL,
            brand TEXT DEFAULT '',
            product_name TEXT NOT NULL,
            category TEXT,
            color TEXT,
            size_type TEXT,
            dimensions TEXT,
            price REAL,
            current_stock INTEGER DEFAULT 0,
            CONSTRAINT unique_user_barcode UNIQUE (user_id, barcode_no)
        )
    ''')
        
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Sales (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL,
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

try:
    init_db()
    print("✅ Bulut Veritabanına Başarıyla Bağlanıldı ve Tablolar Hazır!")
except Exception as e:
    print(f"❌ Veritabanı Bağlantı Hatası: {str(e)}")


@app.get("/")
def read_root():
    return {"status": "online"}


@app.get("/inventory")
async def get_all_inventory(user_id: str = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Products WHERE user_id = %s ORDER BY id DESC", (user_id,))
    items = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(row) for row in items]

@app.get("/product/{barcode}")
async def get_product(barcode: str, user_id: str = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Products WHERE user_id = %s AND barcode_no = %s", (user_id, barcode))
    product = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if product is None:
        return {"status": "not_found", "barcode_no": barcode}
    
    return {"status": "success", "data": dict(product)}

@app.post("/product/scan-image")
async def scan_image(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    contents = await file.read()
    barcode = read_barcode_from_image(contents)
    if not barcode:
        raise HTTPException(status_code=400, detail="Barkod okunamadı.")
    return await get_product(barcode, user_id)

@app.post("/product/save")
def save_product(product: Product, user_id: str = Depends(get_current_user)):
    if product.current_stock <= 0:
        raise HTTPException(status_code=400, detail="Stok miktarı 1'den küçük olamaz!")
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO Products (user_id, barcode_no, brand, product_name, category, color, size_type, dimensions, price, current_stock)
            VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, barcode_no) DO UPDATE SET
                brand = EXCLUDED.brand,
                product_name = EXCLUDED.product_name,
                color = EXCLUDED.color,
                size_type = EXCLUDED.size_type,
                dimensions = EXCLUDED.dimensions,
                current_stock = Products.current_stock + EXCLUDED.current_stock
        ''', (user_id, product.barcode_no, product.brand, product.product_name, product.category, product.color, product.size_type, product.dimensions, product.price, product.current_stock))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.post("/product/bulk-save")
def bulk_save_products(request: BulkSaveRequest, user_id: str = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        for product in request.items:
            if product.current_stock <= 0:
                continue
                
            cursor.execute('''
                INSERT INTO Products (user_id, barcode_no, brand, product_name, category, color, size_type, dimensions, price, current_stock)
                VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, barcode_no) DO UPDATE SET
                    product_name = EXCLUDED.product_name,
                    brand = CASE WHEN EXCLUDED.brand != '' THEN EXCLUDED.brand ELSE Products.brand END,
                    current_stock = Products.current_stock + EXCLUDED.current_stock
            ''', (user_id, product.barcode_no, product.brand, product.product_name, product.category, product.color, product.size_type, product.dimensions, product.price, product.current_stock))
        conn.commit()
        return {"status": "success", "message": f"{len(request.items)} kalem ürün stoğa işlendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.post("/product/sell")
def sell_product(req: SellRequest, user_id: str = Depends(get_current_user)):
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Satış adedi 1'den küçük olamaz!")
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT product_name, brand, current_stock FROM Products WHERE user_id = %s AND barcode_no = %s", (user_id, req.barcode_no))
        product = cursor.fetchone()
        
        if not product:
            raise HTTPException(status_code=404, detail="Ürün bulunamadı")
        
        if product['current_stock'] < req.quantity:
            raise HTTPException(status_code=400, detail="Yetersiz stok! Mevcut stoktan fazlasını satamazsınız.")
            
        cursor.execute('UPDATE Products SET current_stock = current_stock - %s WHERE user_id = %s AND barcode_no = %s', (req.quantity, user_id, req.barcode_no))
        
        full_name = f"{product['brand']} {product['product_name']}".strip()
        customer = req.customer_name if req.customer_name.strip() else "Perakende Müşteri"
        
        cursor.execute('INSERT INTO Sales (user_id, barcode_no, product_name, quantity, customer_name) VALUES (%s, %s, %s, %s, %s)', (user_id, req.barcode_no, full_name, req.quantity, customer))
        
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
async def get_sales_history(timeframe: str = "all", user_id: str = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM Sales WHERE user_id = %s"
    
    if timeframe == "daily":
        query += " AND DATE(sale_date) = CURRENT_DATE"
    elif timeframe == "weekly":
        query += " AND sale_date >= CURRENT_DATE - INTERVAL '7 days'"
    elif timeframe == "monthly":
        query += " AND sale_date >= CURRENT_DATE - INTERVAL '1 month'"
    elif timeframe == "3months":
        query += " AND sale_date >= CURRENT_DATE - INTERVAL '3 months'"
        
    query += " ORDER BY sale_date DESC LIMIT 1000"
    
    cursor.execute(query, (user_id,))
    items = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(row) for row in items]

@app.delete("/sales/{item_id}")
def delete_sale(item_id: int, user_id: str = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Sales WHERE user_id = %s AND id = %s", (user_id, item_id))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.delete("/inventory/{item_id}")
def delete_item(item_id: int, user_id: str = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Products WHERE user_id = %s AND id = %s", (user_id, item_id))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.put("/inventory/{item_id}")
def update_item(item_id: int, item: ProductUpdate, user_id: str = Depends(get_current_user)):
    if item.current_stock < 0:
        raise HTTPException(status_code=400, detail="Stok eksi değere düşürülemez!")
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE Products 
            SET brand = %s, product_name = %s, color = %s, size_type = %s, dimensions = %s, current_stock = %s
            WHERE user_id = %s AND id = %s
        ''', (item.brand, item.product_name, item.color, item.size_type, item.dimensions, item.current_stock, user_id, item_id))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals(): cursor.close()
        conn.close()

@app.post("/invoice/scan")
async def scan_invoice(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
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
async def get_dashboard_stats(user_id: str = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) as count FROM Products WHERE user_id = %s", (user_id,))
        total_items = cursor.fetchone()['count']
        
        cursor.execute("SELECT SUM(current_stock) as total FROM Products WHERE user_id = %s", (user_id,))
        total_stock_query = cursor.fetchone()['total']
        total_stock = total_stock_query if total_stock_query else 0
        
        cursor.execute("SELECT barcode_no, brand, product_name, current_stock FROM Products WHERE user_id = %s AND current_stock <= 5 AND current_stock > 0 ORDER BY current_stock ASC", (user_id,))
        low_stock_items = cursor.fetchall()
        
        cursor.execute("SELECT barcode_no, brand, product_name, current_stock FROM Products WHERE user_id = %s AND current_stock <= 0 ORDER BY product_name ASC", (user_id,))
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