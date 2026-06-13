import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaArrowRight, FaRedo, FaSearch, FaDownload, FaTimes, FaList, FaTrash, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const DownloadManager = () => {
  const navigate = useNavigate();
  const [urlInput, setUrlInput] = useState('');
  const [streams, setStreams] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [showDownloads, setShowDownloads] = useState(false);
  const browserContainerRef = useRef(null);

  useEffect(() => {
    window.api.invoke('browser:show');

    const updateBounds = () => {
      if (browserContainerRef.current) {
        const rect = browserContainerRef.current.getBoundingClientRect();
        window.api.invoke('browser:resize', {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    };

    // Use ResizeObserver to detect layout changes (like the banner appearing)
    const observer = new ResizeObserver(() => {
      updateBounds();
    });

    if (browserContainerRef.current) {
      observer.observe(browserContainerRef.current);
    }

    setTimeout(updateBounds, 100);
    window.addEventListener('resize', updateBounds);

    // Initial fetch of already captured streams
    window.api.invoke('browser:getStreams').then(res => {
      if (res && res.success && res.streams) {
        setStreams(res.streams);
      }
    });

    window.api.receive('browser:urlChanged', (url) => setUrlInput(url));
    window.api.receive('browser:streamDetected', (stream) => {
      setStreams(prev => {
        if (!prev.some(s => s.url === stream.url)) {
          return [...prev, stream];
        }
        return prev;
      });
    });
    
    const refreshDownloads = async () => {
      const currentDownloads = await window.api.invoke('browser:downloads');
      setDownloads(currentDownloads);
    };

    window.api.receive('browser:progress', refreshDownloads);
    window.api.receive('browser:complete', refreshDownloads);
    window.api.receive('browser:error', refreshDownloads);
    window.api.receive('browser:downloads', setDownloads);
    window.api.receive('browser:cancelDownload', refreshDownloads);
    window.api.receive('browser:streams', (streams) => setStreams(streams));

    refreshDownloads();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
      window.api.invoke('browser:hide');
      window.api.remove('browser:urlChanged');
      window.api.remove('browser:streamDetected');
      window.api.remove('browser:progress');
      window.api.remove('browser:complete');
      window.api.remove('browser:error');
      window.api.remove('browser:downloads');
      window.api.remove('browser:cancelDownload');
      window.api.remove('browser:streams');
    };
  }, []);

  const handleNavigate = (e) => {
    e.preventDefault();
    if (urlInput.trim()) {
      window.api.invoke('browser:navigate', urlInput);
    }
  };

  const handleDownloadStream = async (stream) => {
    // Provide a default filename based on the page title
    const safeTitle = (stream.pageTitle || 'video').replace(/[<>:"/\\|?*]/g, '_').trim();
    await window.api.invoke('browser:downloadStream', { stream, filename: safeTitle });
  };

  const clearStreams = () => {
    window.api.invoke('browser:clearStreams');
    setStreams([]);
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes progress-stripes {
          from { background-position: 1rem 0; }
          to { background-position: 0 0; }
        }
        .striped-bar {
          background-image: linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent);
          background-size: 1rem 1rem;
          animation: progress-stripes 1s linear infinite;
        }
        .btn-hover:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-hover:active { transform: translateY(0); }
      `}</style>
      {/* Browser Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.navControls}>
          <button onClick={() => navigate('/')} style={styles.backToHomeBtn} title="Back to App">
            <FaArrowLeft /> App
          </button>
          <div style={styles.divider}></div>
          <button onClick={() => window.api.invoke('browser:goBack')} style={styles.iconBtn}>
            <FaArrowLeft />
          </button>
          <button onClick={() => window.api.invoke('browser:goForward')} style={styles.iconBtn}>
            <FaArrowRight />
          </button>
          <button onClick={() => window.api.invoke('browser:reload')} style={styles.iconBtn}>
            <FaRedo />
          </button>
        </div>

        <form onSubmit={handleNavigate} style={styles.addressBarContainer}>
          <FaSearch style={styles.searchIcon} />
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Search Google or enter URL"
            style={styles.addressInput}
          />
        </form>

        <div style={styles.actionControls}>
          <button 
            onClick={() => setShowDownloads(!showDownloads)} 
            style={downloads.length > 0 ? styles.downloadsBtnActive : styles.iconBtn}
          >
            <FaList /> {downloads.length > 0 && <span style={styles.badge}>{downloads.length}</span>}
          </button>
        </div>
      </div>

      {/* Streams Detected Banner */}
      {streams.length > 0 && (
        <div style={styles.streamsBanner}>
          <div style={styles.streamsHeader}>
            <span style={{ fontWeight: 'bold', color: '#4ade80' }}>
              🎯 {streams.length} Video Stream(s) Detected
            </span>
            <button onClick={clearStreams} style={styles.clearBtn}><FaTrash /> Clear</button>
          </div>
          <div style={styles.streamsList}>
            {streams.map((stream, idx) => (
              <div key={stream.id || idx} style={styles.streamItem}>
                <span style={styles.streamType}>{stream.type}</span>
                <div style={styles.streamInfo}>
                  <div style={styles.streamTitle} title={stream.pageTitle}>{stream.pageTitle}</div>
                  <div style={styles.streamUrl} title={stream.url}>{stream.url}</div>
                </div>
                <button onClick={() => handleDownloadStream(stream)} style={styles.downloadBtn} className="btn-hover">
                  <FaDownload /> Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area: Browser + Sidebar side-by-side */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Main Browser Area */}
        <div style={styles.browserWrapper}>
          <div ref={browserContainerRef} style={styles.browserContainer}>
            {/* Electron BrowserView is injected over this element */}
          </div>
        </div>
        
        {/* Downloads Sidebar */}
        {showDownloads && (
          <div style={styles.downloadsSidebar}>
            <div style={styles.sidebarHeader}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Downloads Queue</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => window.api.invoke('browser:clearCompleted')} style={styles.clearBtn}>Clear Done</button>
                <button onClick={() => setShowDownloads(false)} style={styles.iconBtn}><FaTimes /></button>
              </div>
            </div>
            <div style={styles.downloadsList}>
              {downloads.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>No active downloads</div>
              ) : (
                downloads.map(d => {
                  const isUnknownProgress = (!d.percent || d.percent === 0) && d.sizeKB > 0;
                  return (
                  <div key={d.id} style={styles.downloadCard}>
                    <div style={styles.downloadHeader}>
                      <span style={styles.downloadTitle} title={d.title}>{d.title}</span>
                      {d.status === 'downloading' || d.status === 'starting' ? (
                        <button onClick={() => window.api.invoke('browser:cancelDownload', d.id)} style={styles.cancelBtn} title="Cancel">
                          <FaTimes />
                        </button>
                      ) : null}
                    </div>
                    <div style={styles.progressBarBg}>
                      <div 
                        className={isUnknownProgress ? 'striped-bar' : ''}
                        style={{
                          ...styles.progressBarFill, 
                          width: isUnknownProgress ? '100%' : `${d.percent || 0}%`, 
                          backgroundColor: d.status === 'failed' ? '#ef4444' : '#3b82f6',
                          transition: isUnknownProgress ? 'none' : 'width 0.3s ease'
                        }}
                      ></div>
                    </div>
                    <div style={styles.downloadStatus}>
                      <span>{d.status === 'completed' ? <FaCheckCircle color="#4ade80"/> : d.status === 'failed' ? <FaTimesCircle color="#ef4444"/> : d.status}</span>
                      <span>{d.status === 'completed' ? '100%' : isUnknownProgress ? `${(d.sizeKB / 1024).toFixed(1)} MB İndirildi` : `${d.percent || 0}%`}</span>
                    </div>
                  </div>
                )})
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#121212',
    color: '#fff',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 15px',
    backgroundColor: '#1e1e1e',
    borderBottom: '1px solid #333',
    gap: '15px',
    zIndex: 10,
  },
  navControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  backToHomeBtn: {
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 'bold',
  },
  divider: {
    width: '1px',
    height: '24px',
    backgroundColor: '#444',
    margin: '0 5px',
  },
  iconBtn: {
    backgroundColor: 'transparent',
    color: '#ccc',
    border: 'none',
    padding: '8px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBarContainer: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: '#888',
  },
  addressInput: {
    width: '100%',
    padding: '10px 12px 10px 35px',
    backgroundColor: '#2d2d2d',
    border: '1px solid #444',
    borderRadius: '20px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  actionControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  downloadsBtnActive: {
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    position: 'relative',
  },
  badge: {
    backgroundColor: '#ef4444',
    color: 'white',
    borderRadius: '10px',
    padding: '2px 6px',
    fontSize: '10px',
    fontWeight: 'bold',
  },
  streamsBanner: {
    backgroundColor: '#1f2937',
    borderBottom: '1px solid #374151',
    padding: '10px 15px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    height: '200px', // Sabit yükseklik, web sayfasının sürekli ufalmasını engeller
    flexShrink: 0,
    overflowY: 'auto',
    zIndex: 9,
  },
  streamsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    backgroundColor: 'transparent',
    color: '#ef4444',
    border: '1px solid #ef4444',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  streamsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  streamItem: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: '8px 12px',
    borderRadius: '6px',
    gap: '12px',
  },
  streamType: {
    backgroundColor: '#374151',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  streamInfo: {
    flex: 1,
    minWidth: 0,
  },
  streamTitle: {
    fontWeight: 'bold',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  streamUrl: {
    color: '#9ca3af',
    fontSize: '11px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  downloadBtn: {
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  browserWrapper: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    overflow: 'hidden',
  },
  browserContainer: {
    flex: 1,
    backgroundColor: '#ffffff', // Background before web page loads
  },
  downloadsSidebar: {
    width: '350px',
    backgroundColor: '#1e1e1e',
    borderLeft: '1px solid #333',
    boxShadow: '-5px 0 15px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 20,
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: '15px',
    borderBottom: '1px solid #333',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  downloadsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  downloadCard: {
    backgroundColor: '#2d2d2d',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #444',
  },
  downloadHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  downloadTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cancelBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
  },
  progressBarBg: {
    height: '6px',
    backgroundColor: '#111',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressBarFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  downloadStatus: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#aaa',
  }
};

export default DownloadManager;