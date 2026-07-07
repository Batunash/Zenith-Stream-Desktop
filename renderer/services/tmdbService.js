import { formatTmdbData } from '../utils/formatters';
import i18n from '../utils/i18n';
export const fetchSeriesByImdb = async (imdbId) => {
  const currentLang = i18n.language || 'tr-TR';

  try {
    const result = await window.api.invoke('file:fetchMetadata', {
      imdbId,
      lang: currentLang,
    });

    if (!result.success) {
      throw new Error(result.message || 'TMDB verisi alınamadı');
    }
    const finalFormatted = formatTmdbData(result.data, imdbId);
    finalFormatted.type = result.mediaType;
    return finalFormatted;
  } catch (error) {
    console.error('TMDB Service Error:', error);
    throw error;
  }
};
