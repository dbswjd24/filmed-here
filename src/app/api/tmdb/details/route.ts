export const runtime = "nodejs";

const TMDB_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "").toLowerCase();
  const id = searchParams.get("id");

  if (!TMDB_TOKEN) {
    return Response.json({ error: "Missing TMDB_READ_ACCESS_TOKEN" }, { status: 500 });
  }
  if (!id || (type !== "movie" && type !== "tv")) {
    return Response.json({ error: "Missing/invalid type or id" }, { status: 400 });
  }

  const detailsUrl = `https://api.themoviedb.org/3/${type}/${id}?language=en-US`;
  const imagesUrl = `https://api.themoviedb.org/3/${type}/${id}/images`;

  const [dRes, iRes] = await Promise.all([
    fetch(detailsUrl, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
    }),
    fetch(imagesUrl, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
    }),
  ]);

  if (!dRes.ok) {
    const text = await dRes.text();
    return Response.json({ error: "TMDB details error", status: dRes.status, text }, { status: 500 });
  }
  if (!iRes.ok) {
    const text = await iRes.text();
    return Response.json({ error: "TMDB images error", status: iRes.status, text }, { status: 500 });
  }

  const d = await dRes.json();
  const imgs = await iRes.json();

  const title = type === "tv" ? d.name : d.title;
  const date = type === "tv" ? d.first_air_date : d.release_date;
  const year = date ? String(date).slice(0, 4) : null;

  const out = {
    id: d.id,
    type,
    title,
    overview: d.overview ?? "",
    year,
    vote_average: typeof d.vote_average === "number" ? d.vote_average : null,
    genres: Array.isArray(d.genres) ? d.genres.map((g: any) => g.name).filter(Boolean) : [],
    origin_country: Array.isArray(d.origin_country) ? d.origin_country : [],
    original_language: d.original_language ?? null,
    homepage: d.homepage ?? null,
    images: {
      posters: (imgs?.posters ?? []).slice(0, 12).map((x: any) => x.file_path).filter(Boolean),
      backdrops: (imgs?.backdrops ?? []).slice(0, 12).map((x: any) => x.file_path).filter(Boolean),
    },
  };

  return Response.json(out);
}
