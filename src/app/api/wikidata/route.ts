export const runtime = "nodejs";

type Mode = "title" | "city" | "actor" | "franchise" | "nearby";

const WDQS = "https://query.wikidata.org/sparql";
const WB_API = "https://www.wikidata.org/w/api.php";

async function wdSearchEntityId(query: string) {
  const url =
    `${WB_API}?action=wbsearchentities&search=` +
    encodeURIComponent(query) +
    `&language=en&format=json&limit=1`;

  const r = await fetch(url, {
    headers: { "User-Agent": "FilmedHere/1.0 (student project)" },
  });

  if (!r.ok) return null;
  const data = await r.json();
  const id = data?.search?.[0]?.id as string | undefined;
  return id ?? null; // ex: "Q11335"
}

function parseCoord(coord?: string) {
  if (!coord) return null;
  const m = coord.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!m) return null;
  return { lng: Number(m[1]), lat: Number(m[2]) };
}

function sparqlByTitleQid(qid: string) {
  // filming location: P915
  // coordinates: P625
  return `
SELECT ?place ?placeLabel ?coord (GROUP_CONCAT(DISTINCT ?workLabel; separator=" • ") AS ?works)
WHERE {
  wd:${qid} wdt:P915 ?place .
  OPTIONAL { ?place wdt:P625 ?coord . }

  wd:${qid} rdfs:label ?workLabel .
  FILTER(LANG(?workLabel) = "en")

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?place ?placeLabel ?coord
LIMIT 120
`;
}

function sparqlQuery(mode: Mode, q: string, lat?: number, lng?: number, km?: number) {
  const esc = (s: string) => s.replace(/"/g, '\\"');

  if (mode === "nearby") {
    if (lat == null || lng == null) throw new Error("Missing lat/lng");
    const radiusKm = Math.max(0.5, Math.min(50, km ?? 5));
    return `
SELECT ?place ?placeLabel ?coord (GROUP_CONCAT(DISTINCT ?workLabel; separator=" • ") AS ?works)
WHERE {
  SERVICE wikibase:around {
    ?place wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
  }
  OPTIONAL {
    ?work wdt:P915 ?place .
    ?work rdfs:label ?workLabel .
    FILTER(LANG(?workLabel) = "en")
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?place ?placeLabel ?coord
LIMIT 120
`;
  }

  if (mode === "city") {
    const city = esc(q);
    return `
SELECT ?place ?placeLabel ?coord (GROUP_CONCAT(DISTINCT ?workLabel; separator=" • ") AS ?works)
WHERE {
  ?city rdfs:label "${city}"@en .
  {
    ?work wdt:P915 ?place .
    ?place wdt:P131* ?city .
  }
  UNION
  {
    ?work wdt:P915 ?place .
    FILTER(?place = ?city)
  }
  OPTIONAL { ?place wdt:P625 ?coord . }
  ?work rdfs:label ?workLabel .
  FILTER(LANG(?workLabel) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?place ?placeLabel ?coord
LIMIT 120
`;
  }

  if (mode === "actor") {
    const actor = esc(q);
    return `
SELECT ?place ?placeLabel ?coord (GROUP_CONCAT(DISTINCT ?workLabel; separator=" • ") AS ?works)
WHERE {
  ?person rdfs:label "${actor}"@en .
  ?work wdt:P161 ?person .
  ?work wdt:P915 ?place .
  OPTIONAL { ?place wdt:P625 ?coord . }
  ?work rdfs:label ?workLabel .
  FILTER(LANG(?workLabel) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?place ?placeLabel ?coord
LIMIT 120
`;
  }

  if (mode === "franchise") {
    const franchise = esc(q);
    return `
SELECT ?place ?placeLabel ?coord (GROUP_CONCAT(DISTINCT ?workLabel; separator=" • ") AS ?works)
WHERE {
  ?series rdfs:label "${franchise}"@en .
  ?work wdt:P179 ?series .
  ?work wdt:P915 ?place .
  OPTIONAL { ?place wdt:P625 ?coord . }
  ?work rdfs:label ?workLabel .
  FILTER(LANG(?workLabel) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?place ?placeLabel ?coord
LIMIT 120
`;
  }

  // mode === "title" handled separately via QID
  throw new Error("title mode uses QID flow");
}

async function runSparql(query: string) {
  const r = await fetch(WDQS + "?format=json&query=" + encodeURIComponent(query), {
    headers: {
      "User-Agent": "FilmedHere/1.0 (student project)",
      Accept: "application/sparql-results+json",
    },
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`WDQS error ${r.status}: ${text.slice(0, 400)}`);
  }
  return r.json();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get("mode") as Mode) ?? "city";
    const q = (searchParams.get("q") ?? "").trim();

    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const km = searchParams.get("km");

    let sparql = "";

    if (mode === "title") {
      if (!q) return Response.json({ error: "Missing q" }, { status: 400 });

      const qid = await wdSearchEntityId(q);
      if (!qid) return Response.json({ ok: true, spots: [] });

      sparql = sparqlByTitleQid(qid);
    } else {
      sparql = sparqlQuery(
        mode,
        q,
        lat ? Number(lat) : undefined,
        lng ? Number(lng) : undefined,
        km ? Number(km) : undefined
      );
    }

    const data = await runSparql(sparql);
    const rows = data?.results?.bindings ?? [];

    const spots = rows
      .map((b: any) => {
        const label = b.placeLabel?.value as string | undefined;
        const coord = parseCoord(b.coord?.value);
        const works = (b.works?.value as string | undefined) ?? "";
        if (!label || !coord) return null;

        return {
          id: `wd_${encodeURIComponent(label)}_${coord.lat.toFixed(5)}_${coord.lng.toFixed(5)}`,
          locationName: label,
          lat: coord.lat,
          lng: coord.lng,
          works,
        };
      })
      .filter(Boolean);

    return Response.json({ ok: true, spots });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
