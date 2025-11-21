export const extractImdbId = (url) => {
  const match = url.match(/tt\d+/);
  return match ? match[0] : null;
};

export const formatTmdbData = (apiResult, imdbId) => {
  const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";
  
  return {
    id: apiResult.id,
    imdb_id: imdbId,
    title: apiResult.name || apiResult.title,
    overview: apiResult.overview,
    rating: apiResult.vote_average ? apiResult.vote_average.toFixed(1) : "0.0",
    numberOfSeasons: apiResult.number_of_seasons || 1,
    numberOfEpisodes: apiResult.number_of_episodes || 0,
    status: apiResult.status,
    image: apiResult.poster_path 
      ? `${IMAGE_BASE_URL}${apiResult.poster_path}` 
      : 'https://via.placeholder.com/500x750?text=Gorsel+Yok',
    backdrop: apiResult.backdrop_path 
      ? `${IMAGE_BASE_URL}${apiResult.backdrop_path}` 
      : null
  };
};