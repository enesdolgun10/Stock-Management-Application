import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect } from 'react';

const BarcodeScanner = ({ onScanSuccess }) => {
    useEffect(() => {
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
            }
        );

        return () => {
            try {
                scanner.clear().catch(error => {
                    console.log("Kamera durdurulurken iptal edildi (Normal durum).");
                });
            } catch (error) {
                console.log("Kamera kapatma işlemi atlandı.");
            }
        };
    }, []);
    return (
        <div style={{ width: '100%', margin: '0 auto' }}>
            <div id="reader"></div>
        </div>
    );
};

export default BarcodeScanner;