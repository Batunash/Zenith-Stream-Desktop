import React, { useState, useEffect } from 'react';

const AuthPage = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ 
    username: '', 
    password: '' 
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setFormData({ username: '', password: '' });
    setError(null);
    setLoading(false);
  }, [isLogin]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.username || !formData.password) {
        setError("Lütfen tüm alanları doldurun.");
        return;
    }

    setLoading(true);

    try {
        const channel = isLogin ? "auth:login" : "auth:register";        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Sunucu yanıt vermedi")), 5000)
        );
        const responsePromise = window.api.invoke(channel, formData);        
        const res = await Promise.race([responsePromise, timeoutPromise]);

        if (res.success) {
            if (isLogin) {
                onLoginSuccess(res.user);
            } else {
                alert(res.message);
                setIsLogin(true); 
            }
        } else {
            setError(res.message);
        }
    } catch (err) {
        console.error(err);
        setError(err.message || "Beklenmedik bir hata oluştu.");
    } finally {
        setLoading(false); 
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>{isLogin ? 'Hoşgeldiniz' : 'Hesap Oluştur'}</h2>
        <p style={styles.subtitle}>Video Hub Yönetim Paneli</p>

        <form onSubmit={handleSubmit}>
            <div style={{marginBottom: '15px'}}>
                <input 
                    type="text" 
                    name="username"
                    placeholder="Kullanıcı Adı" 
                    value={formData.username}
                    onChange={handleChange}
                    style={styles.input}
                    autoComplete="off"
                />
            </div>
            
            <div style={{marginBottom: '15px'}}>
                <input 
                    type="password" 
                    name="password"
                    placeholder="Şifre" 
                    value={formData.password}
                    onChange={handleChange}
                    style={styles.input}
                    autoComplete="off"
                />
            </div>
            
            {error && <div style={styles.error}>{error}</div>}

            <button 
                type="submit" 
                style={{...styles.button, opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer'}} 
                disabled={loading} 
            >
                {loading ? 'İşleniyor...' : (isLogin ? 'Giriş Yap' : 'Kayıt Ol')}
            </button>
        </form>

        <div style={styles.footer}>
            {isLogin ? "Hesabın yok mu? " : "Zaten hesabın var mı? "}
            <span 
                style={styles.link} 
                onClick={() => setIsLogin(!isLogin)}
            >
                {isLogin ? "Kayıt Ol" : "Giriş Yap"}
            </span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d', color: 'white' },
  card: { width: '400px', padding: '40px', backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textAlign: 'center' },
  title: { fontSize: '2rem', marginBottom: '10px', fontWeight: 'bold' },
  subtitle: { color: '#888', marginBottom: '30px' },
  input: { width: '100%', padding: '12px', backgroundColor: '#222', border: '1px solid #444', borderRadius: '8px', color: 'white', fontSize: '1rem', outline: 'none' },
  button: { width: '100%', padding: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', marginTop: '10px' },
  error: { color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem' },
  footer: { marginTop: '20px', color: '#888', fontSize: '0.9rem' },
  link: { color: '#2563eb', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' }
};

export default AuthPage;