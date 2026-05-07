import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (isRegistering) {
            const { error } = await supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (error) {
                alert('Kayıt başarısız: ' + error.message);
            } else {
                alert('Dükkan kaydın başarıyla oluşturuldu! Şimdi giriş yapabilirsin.');
                setIsRegistering(false);
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                alert('Giriş başarısız: ' + error.message);
            }
        }
        setLoading(false);
    };

    const styles = {
        container: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f4f4f9', padding: '20px' },
        card: { backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
        title: { textAlign: 'center', color: '#1f2937', marginBottom: '10px', fontWeight: '800' },
        subtitle: { textAlign: 'center', color: '#6b7280', marginBottom: '20px', fontSize: '14px' },
        input: { width: '100%', padding: '12px', margin: '10px 0', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '16px' },
        button: { width: '100%', padding: '14px', backgroundColor: isRegistering ? '#10b981' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
        toggleText: { textAlign: 'center', marginTop: '20px', color: '#4b5563', fontSize: '14px' },
        toggleLink: { color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>Esnaf Stok Sistemi</h2>
                <p style={styles.subtitle}>
                    {isRegistering ? 'Yeni bir dükkan hesabı oluştur' : 'Dükkan paneline giriş yap'}
                </p>

                <form onSubmit={handleAuth}>
                    <input
                        type="email"
                        placeholder="E-posta Adresi"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={styles.input}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Şifre (En az 6 karakter)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={styles.input}
                        required
                    />
                    <button type="submit" style={styles.button} disabled={loading}>
                        {loading ? 'İşlem yapılıyor...' : (isRegistering ? 'Dükkanı Kaydet' : 'Giriş Yap')}
                    </button>
                </form>

                <p style={styles.toggleText}>
                    {isRegistering ? 'Zaten bir dükkanın var mı? ' : 'Henüz sistemde dükkanın yok mu? '}
                    <span style={styles.toggleLink} onClick={() => setIsRegistering(!isRegistering)}>
                        {isRegistering ? 'Giriş Yap' : 'Hemen Kayıt Ol'}
                    </span>
                </p>
            </div>
        </div>
    );
};

export default Login;