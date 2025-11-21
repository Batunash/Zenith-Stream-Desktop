const [transfers, setTransfers] = useState({}); 

 
    const createSeason = async () => {
    const res = await window.api.invoke("file:createSeason", {
      serieName: "deneme",
      seasonId: "s1",
    });
    alert(res.message + (res.path ? "\nPath: " + res.path : ""));
  };

  const selectAndAddEpisode = async () => {
    const files = await window.api.invoke("dialog:openFile");

    if (!files.length) return;
    const initialTransfers = {};
    files.forEach(path => {
      initialTransfers[path] = { percent: 0, status: 'pending' };
    });
    
    setTransfers(prev => ({ ...prev, ...initialTransfers }));

    const videos = files.map(path => ({ path }));

    await window.api.invoke("file:addEpisode", {
      serieName: "deneme",
      seasonId: "s1",
      videos
    });
  };

  useEffect(() => {
    refreshStatus();
    window.api.receive("file:addEpisode:progress", (data) => {
      setTransfers((prev) => ({
        ...prev,
        [data.file]: { percent: data.percent, status: 'transferring' },
      }));
    });

    window.api.receive("file:addEpisode:done", (data) => {
      setTransfers((prev) => ({
        ...prev,
        [data.file]: { 
            percent: 100, 
            status: data.error ? 'error' : 'completed',
            error: data.error 
        },
      }));
    });

    return () => {
        window.api.remove("file:addEpisode:progress");
        window.api.remove("file:addEpisode:done");
    };
  }, []);

  {/* bölüm ekle
    <button style={styles.startBtn} onClick={selectAndAddEpisode}>
          Bölüm Ekle
        </button>
        
        <div style={styles.transferList}>
          {Object.entries(transfers).map(([path, item]) => {
            const fileName = path.split(/[/\\]/).pop(); 
            return (
              <div key={path} style={styles.transferItem}>
                <div style={styles.transferInfo}>
                    <span style={styles.fileName}>{fileName}</span>
                    <span style={styles.percentText}>
                        {item.status === 'error' ? 'HATA' : `%${item.percent}`}
                    </span>
                </div>
                <div style={styles.progressBarBg}>
                  <div
                    style={{
                      ...styles.progressBarFill,
                      width: `${item.percent}%`,
                      backgroundColor: item.status === 'error' ? '#ef4444' : 
                                       item.status === 'completed' ? '#22c55e' : '#3b82f6'
                    }}
                  />
                </div>
                {item.error && <div style={{color: 'red', fontSize:'12px'}}>{item.error}</div>}
              </div>
            );
*/}