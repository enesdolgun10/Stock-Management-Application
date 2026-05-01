# Temel Python sürümünü alıyoruz
FROM python:3.11-slim

# Barkod (Zbar) ve Fatura (Tesseract + Türkçe dil) okumak için gereken Linux kütüphanelerini kuruyoruz
RUN apt-get update && apt-get install -y \
    libzbar0 \
    tesseract-ocr \
    tesseract-ocr-tur \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Çalışma klasörümüzü /app olarak belirliyoruz
WORKDIR /app

# Sadece requirements.txt'yi kopyalayıp Python kütüphanelerini kuruyoruz
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Geri kalan tüm kodlarımızı sunucuya kopyalıyoruz
COPY . .

# Render'ın kendi atayacağı otomatik port üzerinden sistemi başlatıyoruz
CMD uvicorn main:app --host 0.0.0.0 --port $PORT