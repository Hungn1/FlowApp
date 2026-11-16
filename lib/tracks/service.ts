import { db } from "@/lib/db";
import { parseList, toJson } from "@/lib/json";
import { getProfile, type ProfileDTO } from "@/lib/profile/service";
import type { ItemType, ResumeDoc } from "@/lib/resume/types";
import { buildResume, dates, SKILL_GROUP_LABEL, type ItemRow } from "@/lib/resume/build";
import { DEFAULT_TRACKS, EMPHASIS_WORDS, type Emphasis } from "./defaults";

const asEmphasis = (e: string): Emphasis => (["portfolio", "certs", "customer", "general"].includes(e) ? (e as Emphasis) : "general");

const CATEGORY_PRIORITY: Record<Emphasis, string[]> = {
  portfolio: ["design", "tool", "technical", "soft"],
  certs: ["tool", "technical", "soft", "design"],
  customer: ["tool", "technical", "soft", "design"],
  general: ["technical", "tool", "design", "soft"],
};

const FEATURE_TYPES: Record<Emphasis, string[]> = {
  portfolio: ["case-study"],
  certs: ["lab"],
  customer: ["personal", "lab"],
  general: ["case-study", "lab", "personal", "course"],
};


/** Sensible starting order for a track, based on its emphasis. */
export function defaultItemsFor(emphasis: Emphasis, p: ProfileDTO): ItemRow[] {
  const words = EMPHASIS_WORDS[emphasis];
  const rows: ItemRow[] = [];

  const skills = p.skills
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const ma = words.test(a.s.name) ? 0 : 1;
      const mb = words.test(b.s.name) ? 0 : 1;
      if (ma !== mb) return ma - mb;
      const pri = CATEGORY_PRIORITY[emphasis];
      const ca = pri.indexOf(a.s.category);
      const cb = pri.indexOf(b.s.category);
      return ca !== cb ? ca - cb : a.i - b.i;
    });
  skills.forEach(({ s }, order) =>
    rows.push({
      itemType: "skill",
      itemId: s.id!,
      order,
      featured: false,
      // Hide design-only skills and tools (e.g. Figma) on non-design tracks to keep the resume focused.
      hidden:
        (emphasis === "certs" || emphasis === "customer") &&
        (s.category === "design" || (EMPHASIS_WORDS.portfolio.test(s.name) && !words.test(s.name))),
    })
  );

  const featureTypes = FEATURE_TYPES[emphasis];
  const projects = p.projects
    .map((pr, i) => {
      const t = featureTypes.indexOf(pr.type);
      const wordHit = words.test(`${pr.name} ${pr.description} ${pr.tools.join(" ")}`);
      // Matching type and matching words both count; a project needs at least one to be featured.
      return { pr, i, score: (t >= 0 ? t : 4) * 2 + (wordHit ? 0 : 1), relevant: t >= 0 || wordHit };
    })
    .sort((a, b) => a.score - b.score || a.i - b.i);
  projects.forEach(({ pr, relevant }, order) =>
    rows.push({ itemType: "project", itemId: pr.id!, order, featured: order < 3 && relevant, hidden: false })
  );

  p.experiences.forEach((e, order) => rows.push({ itemType: "experience", itemId: e.id!, order, featured: false, hidden: false }));

  const certs = p.certifications
    .map((c, i) => ({ c, i, score: words.test(`${c.name} ${c.issuer}`) ? 0 : 1 }))
    .sort((a, b) => a.score - b.score || a.i - b.i);
  certs.forEach(({ c }, order) => rows.push({ itemType: "cert", itemId: c.id!, order, featured: false, hidden: false }));

  p.educations.forEach((e, order) => rows.push({ itemType: "education", itemId: e.id!, order, featured: false, hidden: false }));
  return rows;
}

async function uniqueSlug(name: string, excludeId?: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "track";
  let slug = base;
  for (let n = 2; ; n++) {
    const existing = await db.track.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${n}`;
  }
}

export async function createTrack(input: { name: string; color: string; emphasis: Emphasis; summary?: string; keywords?: string[]; slug?: string }) {
  const profile = await getProfile();
  const count = await db.track.count();
  const track = await db.track.create({
    data: {
      name: input.name,
      slug: input.slug ?? (await uniqueSlug(input.name)),
      color: input.color,
      emphasis: input.emphasis,
      summary: input.summary ?? "",
      keywords: toJson(input.keywords ?? []),
      order: count,
    },
  });
  if (profile.exists) {
    await db.trackItem.createMany({ data: defaultItemsFor(input.emphasis, profile).map((r) => ({ ...r, trackId: track.id })) });
  }
  return track;
}

export async function ensureDefaultTracks(): Promise<number> {
  let created = 0;
  for (const t of DEFAULT_TRACKS) {
    const exists = await db.track.findUnique({ where: { slug: t.slug } });
    if (!exists) {
      await createTrack(t);
      created++;
    }
  }
  return created;
}

/** Re-apply the default ordering for a track (used by the "Reset order" button). */
export async function resetTrackItems(trackId: string) {
  const track = await db.track.findUniqueOrThrow({ where: { id: trackId } });
  const profile = await getProfile();
  await db.trackItem.deleteMany({ where: { trackId } });
  if (profile.exists) {
    await db.trackItem.createMany({ data: defaultItemsFor(asEmphasis(track.emphasis), profile).map((r) => ({ ...r, trackId })) });
  }
}

// Make sure every track has a TrackItem row for every profile item, so new profile items
// show up in each track (appended at the end, not featured).
export async function syncTracksWithProfile() {
  const [tracks, profile] = await Promise.all([db.track.findMany({ include: { items: true } }), getProfile()]);
  if (!profile.exists || tracks.length === 0) return;
  const all: { itemType: ItemType; itemId: string }[] = [
    ...profile.experiences.map((x) => ({ itemType: "experience" as const, itemId: x.id! })),
    ...profile.skills.map((x) => ({ itemType: "skill" as const, itemId: x.id! })),
    ...profile.educations.map((x) => ({ itemType: "education" as const, itemId: x.id! })),
    ...profile.certifications.map((x) => ({ itemType: "cert" as const, itemId: x.id! })),
    ...profile.projects.map((x) => ({ itemType: "project" as const, itemId: x.id! })),
  ];
  for (const track of tracks) {
    if (track.items.length === 0) {
      await db.trackItem.createMany({ data: defaultItemsFor(asEmphasis(track.emphasis), profile).map((r) => ({ ...r, trackId: track.id })) });
      continue;
    }
    const have = new Set(track.items.map((i) => `${i.itemType}:${i.itemId}`));
    const maxOrder = new Map<string, number>();
    for (const i of track.items) maxOrder.set(i.itemType, Math.max(maxOrder.get(i.itemType) ?? -1, i.order));
    const missing = all.filter((a) => !have.has(`${a.itemType}:${a.itemId}`));
    if (!missing.length) continue;
    await db.trackItem.createMany({
      data: missing.map((m) => {
        const order = (maxOrder.get(m.itemType) ?? -1) + 1;
        maxOrder.set(m.itemType, order);
        return { trackId: track.id, itemType: m.itemType, itemId: m.itemId, order };
      }),
    });
  }
}

export type TrackListItem = {
  id: string; name: string; slug: string; color: string; emphasis: Emphasis; summary: string; keywords: string[];
  jobCount: number; activeCount: number;
};

export async function listTracks(): Promise<TrackListItem[]> {
  const tracks = await db.track.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { jobs: { select: { application: { select: { status: true } } } } },
  });
  return tracks.map((t) => ({
    id: t.id, name: t.name, slug: t.slug, color: t.color, emphasis: asEmphasis(t.emphasis), summary: t.summary,
    keywords: parseList(t.keywords),
    jobCount: t.jobs.length,
    activeCount: t.jobs.filter((j) => ["Applied", "Interviewing"].includes(j.application?.status ?? "")).length,
  }));
}

export type TrackItemView = ItemRow & { label: string; sublabel: string; category?: string; kind?: string };

export type TrackDetail = TrackListItem & { items: TrackItemView[]; resume: ResumeDoc; profile: ProfileDTO };

export async function getTrackDetail(id: string): Promise<TrackDetail | null> {
  const [track, profile, list] = await Promise.all([
    db.track.findUnique({ where: { id }, include: { items: true } }),
    getProfile(),
    listTracks(),
  ]);
  if (!track) return null;
  const base = list.find((t) => t.id === id)!;
  const rows: ItemRow[] = track.items.map((i) => ({ itemType: i.itemType as ItemType, itemId: i.itemId, order: i.order, featured: i.featured, hidden: i.hidden }));

  const label = (r: ItemRow): Pick<TrackItemView, "label" | "sublabel" | "category" | "kind"> | null => {
    switch (r.itemType) {
      case "skill": {
        const s = profile.skills.find((x) => x.id === r.itemId);
        return s ? { label: s.name, sublabel: SKILL_GROUP_LABEL[s.category] ?? "", category: s.category } : null;
      }
      case "project": {
        const p = profile.projects.find((x) => x.id === r.itemId);
        return p ? { label: p.name, sublabel: p.description, kind: p.type } : null;
      }
      case "experience": {
        const e = profile.experiences.find((x) => x.id === r.itemId);
        return e ? { label: e.title, sublabel: `${e.company}${e.start ? ` · ${dates(e.start, e.end)}` : ""}` } : null;
      }
      case "cert": {
        const c = profile.certifications.find((x) => x.id === r.itemId);
        return c ? { label: c.name, sublabel: c.inProgress ? "In progress" : c.issuer } : null;
      }
      case "education": {
        const e = profile.educations.find((x) => x.id === r.itemId);
        return e ? { label: e.school, sublabel: [e.degree, e.field].filter(Boolean).join(", ") } : null;
      }
    }
  };

  const items = rows
    .map((r) => {
      const l = label(r);
      return l ? { ...r, ...l } : null;
    })
    .filter((x): x is TrackItemView => x !== null)
    .sort((a, b) => a.itemType.localeCompare(b.itemType) || a.order - b.order);

  return { ...base, items, profile, resume: buildResume(profile, base.emphasis, track.summary, rows) };
}
