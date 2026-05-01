import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect } from 'react';

const BarcodeScanner = ({ onScanSuccess }) => {
    useEffect(() => {
        // 3. parametre olan 'false', kütüphanenin kendi loglarını susturur
        const scanner = new Html5QrcodeScanner('reader', {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [0]
        }, false);

        scanner.render(
            (decodedText) => {
                onScanSuccess(decodedText);
            },
            (error) => {
                // Tarama sırasındaki normal okuyamama durumları. Sessiz kal.
            }
        );

        // Bileşen ekrandan giderken kamerayı güvenlice kapatma işlemi
        return () => {
            try {
                scanner.clear().catch(error => {
                    // Promise hatası verirse bunu sadece logla, kırmızı ekran fırlatma
                    console.log("Kamera durdurulurken iptal edildi (Normal durum).");
                });
            } catch (error) {
                console.log("Kamera kapatma işlemi atlandı.");
            }
        };
    }, []); // Bağımlılık dizisini boş bıraktık ki gereksiz yere baştan render olmasın

    return (
        <div style={{ width: '100%', margin: '0 auto' }}>
            <div id="reader"></div>
        </div>
    );
};

export default BarcodeScanner;