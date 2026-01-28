import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SeriesBanner from '../components/SeriesBanner';
import SeasonList from '../components/SeasonList';
import EpisodeList from '../components/EpisodeList';
import TransferList from '../components/TransferList';
import { useTranslation } from 'react-i18next';

const SeriesDetail = () => {
  const { t } = useTranslation();
  const { folderName } = useParams();
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState({});
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedFileForConvert, setSelectedFileForConvert] = useState(null);
  const [conversionState, setConversionState] = useState({});
  const handleConvertClick = (episode) => {
      setSelectedFileForConvert(episode.path);
      setShowConvertModal(true);
  };
  const handleStartConversion = async (userPreferences) => {
      const filePath = selectedFileForConvert;
      setShowConvertModal(false);
      setConversionState(prev => ({
          ...prev,
          [filePath]: { status: 'processing', progress: 0 }
      }));

      try {
          await window.api.invoke('media:process', {
              filePath,
              userPreferences
          });
          setConversionState(prev => {
              const newState = { ...prev };
              delete newState[filePath];
              return newState;
          });
          
      } catch (error) {
          console.error(error);
      }
  };

  const fetchDetails = async () => {
    try {
      const data = await window.api.invoke('file:getSeriesDetail', folderName);
      if (data.error) { 
          alert(t('detail.not_found')); 
          navigate('/'); 
          return; 
      }
      setMetadata(data);
      setSeasons(data.seasons || []);
      if (data.seasons?.length > 0) setActiveSeason(data.seasons[0]);
      else setLoading(false);
    } catch (error) { console.error(error); }
  };

  const fetchEpisodes = async () => {
    if (activeSeason) {
        const eps = await window.api.invoke('file:getEpisodes', { folderName, season: activeSeason });
        setEpisodes(eps);
        setLoading(false);
    }
  };

  useEffect(() => { fetchDetails(); }, [folderName]);
  useEffect(() => { fetchEpisodes(); }, [activeSeason, folderName]);
  
  useEffect(() => {
    window.api.receive("file:addEpisode:progress", (data) => {
      setTransfers(prev => ({ ...prev, [data.file]: { percent: data.percent, status: 'transferring' } }));
    });
    window.api.receive("file:addEpisode:done", (data) => {
      setTransfers(prev => ({ 
          ...prev, 
          [data.file]: { percent: 100, status: data.error ? 'error' : 'completed', error: data.error } 
      }));
      if (!data.error) fetchEpisodes();
    });
    const removeListener = window.api.receive('media:progress', ({ filePath, percent }) => {
        setConversionState(prev => ({
            ...prev,
            [filePath]: { status: 'processing', progress: percent }
        }));
    });
    return () => {
        window.api.remove("file:addEpisode:progress");
        window.api.remove("file:addEpisode:done");
        window.api.remove('media:progress');
    };
  }, [activeSeason]);
  

  const handleAddSeason = async () => {
    const seasonNumbers = seasons.map(seasonName => {
        const numberPart = seasonName.replace(/\D/g, ''); 
        return parseInt(numberPart) || 0; 
    });
    const maxSeasonNum = seasonNumbers.length > 0 ? Math.max(...seasonNumbers) : 0;
    const nextSeasonNum = maxSeasonNum + 1;
    const newSeasonName = `Season ${nextSeasonNum}`;
    const res = await window.api.invoke('file:createSeason', {
        serieName: folderName,
        seasonId: newSeasonName
    });

    if (res.isExist) {
        const updatedSeasons = [...seasons, newSeasonName].sort((a, b) => {
             const numA = parseInt(a.replace(/\D/g, '')) || 0;
             const numB = parseInt(b.replace(/\D/g, '')) || 0;
             return numA - numB;
        });
        setSeasons(updatedSeasons);
        setActiveSeason(newSeasonName);
    } else {
        alert(t('common.error') + ": " + res.message);
    }
  };

  const handleUploadEpisode = async () => {
    if (!activeSeason) return alert(t('detail.select_season_warn'));
    const isMovie = metadata?.type === 'movie';
    const files = await window.api.invoke("dialog:openVideoFiles", { 
        multiSelections: !isMovie 
    });

    if (!files || !files.length) return;
    const initialTransfers = {};
    files.forEach(path => initialTransfers[path] = { percent: 0, status: 'pending' });
    setTransfers(prev => ({ ...prev, ...initialTransfers }));
    const videos = files.map(path => ({ path }));
    await window.api.invoke("file:addEpisode", { serieName: folderName, seasonId: activeSeason, videos });
  };

  const handleDeleteSeason = async (seasonName) => {
    if (!confirm(t('detail.delete_season_confirm'))) return;
    const res = await window.api.invoke('file:deleteSeason', { folderName, season: seasonName });
    if (res.success) {
        const newSeasons = seasons.filter(s => s !== seasonName);
        setSeasons(newSeasons);
        if (activeSeason === seasonName) {
            setActiveSeason(newSeasons[0] || null);
            setEpisodes([]);
        }
    }
  };

  const handleDeleteEpisode = async (path) => {
    if (!confirm(t('detail.delete_episode_confirm'))) return;
    const res = await window.api.invoke('file:deleteEpisode', path);
    if (res.success) setEpisodes(prev => prev.filter(ep => ep.path !== path));
  };

  if (loading && !metadata) return <div style={{color:'white', padding: 40}}>{t('common.loading')}</div>;

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: '#121212', color: 'white' }}>
      <SeriesBanner 
        metadata={metadata} 
        seasonCount={seasons.length} 
        onBack={() => navigate('/')} 
      />
      <div style={{ padding: '0 40px 50px 40px' ,marginTop:'30px'}}>
        <SeasonList 
            seasons={seasons} 
            activeSeason={activeSeason} 
            onSelect={setActiveSeason} 
            onAdd={handleAddSeason}
            onDelete={handleDeleteSeason}
            isMovie={metadata?.type === 'movie'}
        />
        <TransferList transfers={transfers} />
        <EpisodeList 
            episodes={episodes} 
            activeSeason={activeSeason} 
            onUpload={handleUploadEpisode}
            onDelete={handleDeleteEpisode}
            uploadDisabled={metadata?.type === 'movie' && episodes.length >= 1}
            onConvert={handleConvertClick}
            conversionState={conversionState}
        />
      </div>
      {showConvertModal && selectedFileForConvert && (
            <ConversionModal 
                filePath={selectedFileForConvert}
                onClose={() => setShowConvertModal(false)}
                onStart={handleStartConversion}
            />
        )}
    </div>
    
  );
};

export default SeriesDetail;