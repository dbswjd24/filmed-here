export const runtime = "nodejs";

const TMDB_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") ?? "").trim();

  // type can be: movie | tv | multi
  const type = (searchParams.get("type") ?? "multi").toLowerCase();

  if (!TMDB_TOKEN) {
    return Response.json({ error: "Missing TMDB_READ_ACCESS_TOKEN" }, { status: 500 });
  }
  if (!query) return Response.json({ results: [] });

  const endpoint =
    type === "movie"
      ? "search/movie"
      : type === "tv"
      ? "search/tv"
      : "search/multi";

  const url = `https://api.themoviedb.org/3/${endpoint}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      "Content-Type": "application/json;charset=utf-8",
    },
  });

  if (!r.ok) {
    const text = await r.text();
    return Response.json({ error: "TMDB error", status: r.status, text }, { status: 500 });
  }

  const data = await r.json();

  const results = (data?.results ?? [])
    .filter((x: any) => x.media_type !== "person")
    .map((x: any) => {
      const media_type = (x.media_type ?? type) as "movie" | "tv";
      const title = media_type === "tv" ? x.name : x.title;
      const date = media_type === "tv" ? x.first_air_date : x.release_date;
      const year = date ? String(date).slice(0, 4) : null;

      return {
        id: x.id,
        media_type,
        title,
        year,
        vote_average: typeof x.vote_average === "number" ? x.vote_average : null,
        poster_path: x.poster_path ?? null,
        backdrop_path: x.backdrop_path ?? null,
      };
    });

  return Response.json({ results });
}
