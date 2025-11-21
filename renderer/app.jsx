import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AddSerie from './pages/AddSerie';

function App() {
  return (
    <HashRouter>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#121212' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add-series" element={<AddSerie/>} />
        
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;