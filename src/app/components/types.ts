export type ContentType = "movie" | "tv";

export type Pin = {
  id: string;
  tmdbId: number;
  contentType: ContentType;
  title: string;
  locationName: string;
  lat: number;
  lng: number;
  createdAt: number;
};

export type TmdbSuggestion = {
  id: number;
  media_type: ContentType;
  title: string;
  year: string | null;
  vote_average: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
};

export type TmdbDetails = {
  id: number;
  type: ContentType;
  title: string;
  overview: string;
  year: string | null;
  vote_average: number | null;
  genres: string[];
  origin_country: string[];
  original_language: string | null;
  homepage: string | null;
  images: {
    posters: string[];
    backdrops: string[];
  };
};
