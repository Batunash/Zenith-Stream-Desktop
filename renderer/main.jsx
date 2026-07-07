import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';
import './index.css';
import './utils/i18n.js';
import TitleBar from './components/TitleBar/TitleBar.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <TitleBar />
      <div
        style={{
          marginTop: '32px',
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <App />
      </div>
    </div>
  </StrictMode>
);
