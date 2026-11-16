import { db } from "@/lib/db";
import { parseList, toJson } from "@/lib/json";
import type { ProfileInputT } from "./schema";

export const PROFILE_ID = "me";

export type ProfileDTO = ProfileInputT & { isSample: boolean; exists: boolean; updatedAt: string | null };

export async function getProfile(): Promise<ProfileDTO> {
  const p = await db.profile.findUnique({
    where: { id: PROFILE_ID },
    include: {
      experiences: { orderBy: { order: "asc" } },
      skills: { orderBy: { order: "asc" } },
      educations: { orderBy: { order: "asc" } },
      certifications: { orderBy: { order: "asc" } },
      projects: { orderBy: { order: "asc" } },
    },
  });
  if (!p) {
    return {
      exists: false,
      isSample: false,
      updatedAt: null,
      contact: { name: "", email: "", phone: "", location: "", headline: "", linkedin: "", github: "", portfolio: "", otherLinks: [] },
      experiences: [],
      skills: [],
      educations: [],
      certifications: [],
      projects: [],
    };
  }
  return {
    exists: true,
    isSample: p.isSample,
    updatedAt: p.updatedAt.toISOString(),
    rawResumeText: p.rawResumeText,
    contact: {
      name: p.name,
      email: p.email,
      phone: p.phone,
      location: p.location,
      headline: p.headline,
      linkedin: p.linkedin,
      github: p.github,
      portfolio: p.portfolio,
      otherLinks: parseList(p.otherLinks),
    },
    experiences: p.experiences.map((e) => ({
      id: e.id, company: e.company, title: e.title, location: e.location, start: e.start, end: e.end,
      isTechRole: e.isTechRole, bullets: parseList(e.bullets),
    })),
    skills: p.skills.map((s) => ({ id: s.id, name: s.name, category: s.category as ProfileInputT["skills"][number]["category"] })),
    educations: p.educations.map((e) => ({
      id: e.id, school: e.school, degree: e.degree, field: e.field, start: e.start, end: e.end, coursework: parseList(e.coursework),
    })),
    certifications: p.certifications.map((c) => ({
      id: c.id, name: c.name, issuer: c.issuer, issued: c.issued, expires: c.expires, credentialUrl: c.credentialUrl, inProgress: c.inProgress,
    })),
    projects: p.projects.map((pr) => ({
      id: pr.id, name: pr.name, type: pr.type as ProfileInputT["projects"][number]["type"], description: pr.description,
      bullets: parseList(pr.bullets), tools: parseList(pr.tools), url: pr.url,
    })),
  };
}

type ItemType = "experience" | "skill" | "education" | "cert" | "project";

/**
 * Save the whole profile. Items keep their ids (so tracks and tailored resumes that point at them
 * stay valid); items without an id are created; items no longer present are deleted.
 */
export async function saveProfile(input: ProfileInputT, opts: { isSample?: boolean } = {}) {
  const c = input.contact;
  await db.$transaction(async (tx) => {
    await tx.profile.upsert({
      where: { id: PROFILE_ID },
      create: {
        id: PROFILE_ID, name: c.name, email: c.email, phone: c.phone, location: c.location, headline: c.headline,
        linkedin: c.linkedin, github: c.github, portfolio: c.portfolio, otherLinks: toJson(c.otherLinks),
        rawResumeText: input.rawResumeText ?? "", isSample: opts.isSample ?? false,
      },
      update: {
        name: c.name, email: c.email, phone: c.phone, location: c.location, headline: c.headline,
        linkedin: c.linkedin, github: c.github, portfolio: c.portfolio, otherLinks: toJson(c.otherLinks),
        ...(input.rawResumeText !== undefined ? { rawResumeText: input.rawResumeText } : {}),
        isSample: opts.isSample ?? false,
      },
    });

    const removed: { type: ItemType; ids: string[] }[] = [];

    // Generic sync for each list
    async function sync<T extends { id?: string }>(
      type: ItemType,
      items: T[],
      delegate: {
        findMany: (args: { where: { profileId: string }; select: { id: true } }) => Promise<{ id: string }[]>;
        deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>;
        upsert: (args: { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
      },
      toData: (item: T, order: number) => Record<string, unknown>
    ) {
      const existing = await delegate.findMany({ where: { profileId: PROFILE_ID }, select: { id: true } });
      const keep = new Set(items.map((i) => i.id).filter(Boolean) as string[]);
      const toDelete = existing.map((e) => e.id).filter((id) => !keep.has(id));
      if (toDelete.length) {
        await delegate.deleteMany({ where: { id: { in: toDelete } } });
        removed.push({ type, ids: toDelete });
      }
      for (const [order, item] of items.entries()) {
        const data = toData(item, order);
        await delegate.upsert({
          where: { id: item.id ?? "__new__" },
          create: { ...data, profileId: PROFILE_ID },
          update: data,
        });
      }
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    await sync("experience", input.experiences, tx.experience as any, (e, order) => ({
      company: e.company, title: e.title, location: e.location, start: e.start, end: e.end,
      isTechRole: e.isTechRole, bullets: toJson(e.bullets.filter(Boolean)), order,
    }));
    await sync("skill", input.skills, tx.skill as any, (s, order) => ({ name: s.name, category: s.category, order }));
    await sync("education", input.educations, tx.education as any, (e, order) => ({
      school: e.school, degree: e.degree, field: e.field, start: e.start, end: e.end, coursework: toJson(e.coursework.filter(Boolean)), order,
    }));
    await sync("cert", input.certifications, tx.certification as any, (cft, order) => ({
      name: cft.name, issuer: cft.issuer, issued: cft.issued, expires: cft.expires, credentialUrl: cft.credentialUrl, inProgress: cft.inProgress, order,
    }));
    await sync("project", input.projects, tx.project as any, (p, order) => ({
      name: p.name, type: p.type, description: p.description, bullets: toJson(p.bullets.filter(Boolean)), tools: toJson(p.tools.filter(Boolean)), url: p.url, order,
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Drop track references to items that no longer exist.
    for (const r of removed) {
      await tx.trackItem.deleteMany({ where: { itemType: r.type, itemId: { in: r.ids } } });
    }
  });
  return getProfile();
}
