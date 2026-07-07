import React from 'react';
import { IoRemoveOutline, IoSquareOutline, IoCloseOutline } from 'react-icons/io5';

export default function TitleBar() {
  const handleMinimize = () => {
    window.api?.send('window:minimize');
  };

  const handleMaximize = () => {
    window.api?.send('window:maximize');
  };

  const handleClose = () => {
    window.api?.send('window:close');
  };

  return (
    <>
      <style>{`
        .titlebar-container {
          height: 32px;
          background-color: #121212;
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          border-bottom: 1px solid #333;
        }

        .drag-region {
          flex: 1;
          height: 100%;
          display: flex;
          align-items: center;
          padding-left: 15px;
          -webkit-app-region: drag;
        }

        .title-text {
          color: #c6a14a;
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 1px;
          font-family: sans-serif;
        }

        .controls {
          display: flex;
          height: 100%;
          -webkit-app-region: no-drag;
        }

        .control-btn {
          width: 45px;
          height: 100%;
          background-color: transparent;
          border: none;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          color: white;
          outline: none;
          transition: background-color 0.2s;
        }

        .control-btn:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        .close-btn:hover {
          background-color: #e81123 !important;
        }
      `}</style>
      <div className="titlebar-container">
        <div className="drag-region">
          <span className="title-text">Zenith Stream</span>
        </div>
        <div className="controls">
          <button onClick={handleMinimize} className="control-btn" title="Küçült">
            <IoRemoveOutline size={18} />
          </button>

          <button onClick={handleMaximize} className="control-btn" title="Büyüt">
            <IoSquareOutline size={16} />
          </button>

          <button onClick={handleClose} className="control-btn close-btn" title="Kapat">
            <IoCloseOutline size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
