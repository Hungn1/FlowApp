// Pick the track whose keywords best match the posting. Title hits count 3x.
export function suggestTrack(
  tracks: { id: string; name: string; keywords: string[] }[],
  title: string,
  description: string
): { trackId: string | null; reason: string } {
  const t = title.toLowerCase();
  const d = description.toLowerCase();
  let best: { id: string; name: string; score: number; hits: string[] } | null = null;
  for (const tr of tracks) {
    let score = 0;
    const hits: string[] = [];
    for (const kw of tr.keywords) {
      const k = kw.toLowerCase().trim();
      if (!k) continue;
      const re = new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`, "g");
      const inTitle = (t.match(re) ?? []).length;
      const inDesc = Math.min((d.match(re) ?? []).length, 5);
      if (inTitle || inDesc) hits.push(kw);
      score += inTitle * 3 + inDesc;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: tr.id, name: tr.name, score, hits };
  }
  return best
    ? { trackId: best.id, reason: `Matched ${best.name} keywords: ${best.hits.slice(0, 4).join(", ")}` }
    : { trackId: null, reason: "No track keywords matched. Pick a track." };
}
