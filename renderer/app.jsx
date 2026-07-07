import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AddSerie from './pages/AddSerie';
import SeriesDetail from './pages/SeriesDetail';
import AuthPage from './pages/AuthPage'; 
import SettingsPage from './pages/SettingsPage';
import DownloadManager from './pages/DownloadManager';

window.onerror = function(message, source, lineno, colno, error) {
  window.api.invoke('browser:navigate', 'data:text/html,<html><body><h1>React Crash</h1><p>' + message + '</p><p>' + (error ? error.stack : '') + '</p></body></html>');
};
window.onunhandledrejection = function(event) {
  window.api.invoke('browser:navigate', 'data:text/html,<html><body><h1>Promise Crash</h1><p>' + event.reason + '</p></body></html>');
};
function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  useEffect(() => {
    if (user) {
        setLoadingConfig(true);
        window.api.invoke('settings:get').then(cfg => {
            setConfig(cfg);
            setLoadingConfig(false);
        });
    } else {
        setLoadingConfig(false);
    }
  }, [user]);

  const handleLogin = (userData) => {
    setLoadingConfig(true); // Prevent Navigate race condition
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };
  const isSetupComplete = config && config.MEDIA_DIR && config.MEDIA_DIR.trim() !== "";
  console.log("APP CONFIG:", config, "isSetupComplete:", isSetupComplete);
  const ProtectedRoute = ({ children }) => {
    if (!user) return <AuthPage onLoginSuccess={handleLogin} />;
    if (loadingConfig) return <div style={{color:'white', padding:50}}>Yükleniyor...</div>;

    if (!isSetupComplete && window.location.hash !== '#/settings') {
        return <Navigate to="/settings" replace />;
    }

    return children;
  };
  return (
   <HashRouter>
        {!user ? (
            <AuthPage onLoginSuccess={handleLogin} />
        ) : (
            <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#121212' }}>
                <Routes>
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/settings" element={
                      <ProtectedRoute>
                          <SettingsPage isSetupRequired={!isSetupComplete} onConfigUpdate={setConfig} />
                      </ProtectedRoute>
                  } />
                  
                  <Route path="/add-series" element={<ProtectedRoute><AddSerie /></ProtectedRoute>} />
                  <Route path="/details/:folderName" element={<ProtectedRoute><SeriesDetail /></ProtectedRoute>} />
                  <Route path="/download" element={<ProtectedRoute><DownloadManager /></ProtectedRoute>} />
                </Routes>
            </div>
        )}
    </HashRouter>
  );
}

export default App;