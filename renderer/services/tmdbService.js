import { formatTmdbData } from '../utils/formatters';

const getApiKeyFromSettings = async () => {
    const settings = await window.api.invoke('settings:get');
    return settings.TMDB_API_KEY || settings.VITE_TMDB_API_KEY || '';      
}

const BASE_URL = "https://api.themoviedb.org/3";

export const fetchSeriesByImdb = async (imdbId) => {
  const API_KEY = await getApiKeyFromSettings();
  if (!API_KEY) {
      throw new Error("TMDB API Key eksik. Lütfen Ayarlar'dan giriniz.");
  }
  try {
    const findResponse = await fetch(
      `${BASE_URL}/find/${imdbId}?api_key=${API_KEY}&external_source=imdb_id&language=tr-TR`
    );
    
    if (!findResponse.ok) throw new Error("Find API hatası");
    const findData = await findResponse.json();
    const basicResult = findData.tv_results?.[0] || findData.movie_results?.[0];
    if (!basicResult) return null;
    if (findData.movie_results?.length > 0) {
        return formatTmdbData(basicResult, imdbId);
    }
    const detailResponse = await fetch(
      `${BASE_URL}/tv/${basicResult.id}?api_key=${API_KEY}&language=tr-TR`
    );
    if (!detailResponse.ok) {  
        return formatTmdbData(basicResult, imdbId);
    }
    const detailData = await detailResponse.json();
    return formatTmdbData(detailData, imdbId);
  } catch (error) {
    console.error("TMDB Service Error:", error);
    throw error;
  }
};