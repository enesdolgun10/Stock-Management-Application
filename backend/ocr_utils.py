import cv2
import numpy as np
from pyzbar.pyzbar import decode
import pytesseract
from PIL import Image
import io
import fitz  
def read_barcode_from_image(image_bytes):
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    decoded_objects = decode(img)
    for obj in decoded_objects:
        return obj.data.decode("utf-8")
    return None

def extract_text_from_invoice(image_bytes):
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = image.convert('L') 
        text = pytesseract.image_to_string(image, lang='tur+eng')
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return lines
    except Exception as e:
        print(f"OCR Hatası: {e}")
        return []

def extract_text_from_pdf(pdf_bytes):
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        lines = []
        
        for page in doc:
            words = page.get_text("words")
            
            words.sort(key=lambda w: (round(w[1] / 5), w[0]))
            
            current_line = []
            current_y = None
            
            for w in words:
                y_group = round(w[1] / 5)
                if current_y is None:
                    current_y = y_group
                
                if y_group != current_y:
                    lines.append(" ".join(current_line))
                    current_line = []
                    current_y = y_group
                
                current_line.append(w[4])
            
            if current_line:
                lines.append(" ".join(current_line))
                
        return lines
    except Exception as e:
        print(f"PDF Okuma Hatası: {e}")
        return []