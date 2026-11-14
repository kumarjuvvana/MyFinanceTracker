interface NpsNavRequest {
  method?: string;
}

interface NpsNavResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

export interface NpsNav {
  schemeId: string;
  schemeName: string;
  pfmName: string;
  nav: number;
  date: string;
}

function respond(response: NpsNavResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function parseNavFeed(feed: string): NpsNav[] {
  const latestNavs = new Map<string, NpsNav>();
  for (const line of feed.split(/\r?\n/)) {
    const fields = line.split("\t").map((field) => field.trim());
    if (fields.length < 6 || !/^\d+$/.test(fields[0]) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fields[1]) || !/^SM\d{6}$/.test(fields[3])) continue;
    const date = fields[1];
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    const nav = Number(fields[5]);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date ||
      !fields[2] || !fields[4] || !Number.isFinite(nav) || nav <= 0) continue;

    const existing = latestNavs.get(fields[3]);
    if (!existing || date > existing.date) {
      latestNavs.set(fields[3], {
        schemeId: fields[3],
        schemeName: fields[4],
        pfmName: fields[2],
        nav,
        date,
      });
    }
  }
  return [...latestNavs.values()];
}

export async function fetchNpsNavs(): Promise<NpsNav[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const navResponse = await fetch("https://npstrust.org.in/nav-report-excel", {
      headers: { Accept: "application/vnd.ms-excel, text/plain" },
      signal: controller.signal,
    });
    if (!navResponse.ok) {
      throw new Error(`NPS Trust returned HTTP ${navResponse.status} while loading NAV data.`);
    }
    const feed = await navResponse.text();
    if (!feed.includes("SCHEME ID") || feed.length > 4 * 1024 * 1024) {
      throw new Error("NPS Trust returned an invalid or unexpectedly large NAV file.");
    }
    const navs = parseNavFeed(feed);
    if (!navs.length) throw new Error("NPS Trust did not provide any usable scheme NAVs.");
    return navs;
  } catch (caught) {
    if (caught instanceof Error && caught.name === "AbortError") {
      throw new Error("The NPS Trust NAV request timed out. Try again later.");
    }
    throw caught;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function npsNavHandler(request: NpsNavRequest, response: NpsNavResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, { error: "Only POST requests are supported." });
    return;
  }

  try {
    const navs = await fetchNpsNavs();
    respond(response, 200, { provider: "NPS Trust", navs });
  } catch (caught) {
    respond(response, 502, { error: caught instanceof Error ? caught.message : "Could not load NPS Trust NAV data." });
  }
}
