// Reads ONE job page that you asked for, once. No crawling, no login, no submitting.
// Many job boards block this; when that happens you paste the description instead.

function decode(s: string) {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlToText(html: string) {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<(br|\/p|\/div|\/h\d|\/li|\/ul|\/ol|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

type JsonLdJob = {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string } } | { address?: { addressLocality?: string; addressRegion?: string } }[];
  jobLocationType?: string;
  validThrough?: string;
  baseSalary?: { value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string } };
};

function findJobPosting(html: string): JsonLdJob | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      const nodes: JsonLdJob[] = Array.isArray(data) ? data : data["@graph"] ?? [data];
      const job = nodes.find((n) => [n["@type"]].flat().includes("JobPosting"));
      if (job) return job;
    } catch {
      /* ignore bad JSON-LD */
    }
  }
  return null;
}

export async function fetchJobPage(url: string): Promise<{ text: string; hints: Record<string, string> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (ApplyFlow personal job tracker)", Accept: "text/html,application/xhtml+xml" },
    });
  } catch {
    throw new Error("Couldn't open that page (it may be offline or blocking automated reads). Paste the job description instead.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`That site returned an error (${res.status}). Many job boards block this; paste the description instead.`);
  const html = (await res.text()).slice(0, 2_000_000);

  const ld = findJobPosting(html);
  const hints: Record<string, string> = {};
  let text = "";
  if (ld) {
    const loc = [ld.jobLocation].flat()[0]?.address;
    if (ld.title) hints.title = decode(ld.title);
    if (ld.hiringOrganization?.name) hints.company = decode(ld.hiringOrganization.name);
    if (loc) hints.location = [loc.addressLocality, loc.addressRegion].filter(Boolean).join(", ");
    if (ld.jobLocationType === "TELECOMMUTE") hints.workMode = "remote";
    if (ld.validThrough) hints.deadline = ld.validThrough.slice(0, 10);
    text = [ld.title, ld.hiringOrganization?.name, hints.location, htmlToText(ld.description ?? "")].filter(Boolean).join("\n");
  }
  if (text.length < 200) {
    const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
    text = htmlToText(main);
  }
  if (text.length < 200) throw new Error("That page didn't contain a readable job description (it may need JavaScript or a login). Paste the description instead.");
  return { text: text.slice(0, 50_000), hints };
}
