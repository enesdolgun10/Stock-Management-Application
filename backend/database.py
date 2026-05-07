import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
DATABASE_PATH = os.path.join(DATA_DIR, "stok.db")

def init_db():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        print(f"Klasör oluşturuldu: {DATA_DIR}")

    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS Products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barcode_no TEXT UNIQUE NOT NULL,
                product_name TEXT NOT NULL,
                category TEXT,
                color TEXT,
                size_type TEXT,
                dimensions TEXT,
                price REAL DEFAULT 0.0,
                current_stock INTEGER DEFAULT 0
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS Invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_no TEXT,
                supplier_name TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS InvoiceItems (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER,
                product_barcode TEXT,
                expected_qty INTEGER,
                received_qty INTEGER DEFAULT 0,
                FOREIGN KEY (invoice_id) REFERENCES Invoices(id)
            )
        ''')
        
        conn.commit()
        conn.close()
        print(f"Veritabanı başarıyla hazırlandı: {DATABASE_PATH}")
        
    except sqlite3.Error as e:
        print(f"Veritabanı hatası: {e}")

if __name__ == "__main__":
    init_db()