interface MutualFundNavRequest {
  method?: string;
  body?: unknown;
}

interface MutualFundNavResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

export interface MutualFundNav {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string;
}

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const MAX_ISINS = 100;
const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function respond(response: MutualFundNavResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function parseNavDate(value: string): string | null {
  const match = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = MONTHS[match[2][0].toUpperCase() + match[2].slice(1).toLowerCase()];
  if (!month) return null;
  const date = `${match[3]}-${month}-${match[1]}`;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}

function requestedIsins(body: unknown): string[] | null {
  if (typeof body !== "object" || body === null || !("isins" in body) || !Array.isArray(body.isins) ||
    body.isins.length === 0 || body.isins.length > MAX_ISINS) return null;
  const isins: string[] = [];
  for (const value of body.isins) {
    if (typeof value !== "string") return null;
    const isin = value.trim().toUpperCase();
    if (!ISIN_PATTERN.test(isin)) return null;
    isins.push(isin);
  }
  return [...new Set(isins)];
}

function parseNavFeed(feed: string, requested: Set<string>): Map<string, MutualFundNav> {
  const matches = new Map<string, MutualFundNav>();
  for (const line of feed.split(/\r?\n/)) {
    const fields = line.split(";");
    if (fields.length < 8) continue;
    const isinGrowth = fields[1].trim().toUpperCase();
    const isinReinvestment = fields[2].trim().toUpperCase();
    const isin = requested.has(isinGrowth) ? isinGrowth
      : requested.has(isinReinvestment) ? isinReinvestment
        : "";
    if (!isin) continue;
    const nav = Number(fields[6].trim());
    const date = parseNavDate(fields[7]);
    if (!/^\d+$/.test(fields[0].trim()) || !fields[3].trim() ||
      !Number.isFinite(nav) || nav <= 0 || !date) continue;
    const existing = matches.get(isin);
    if (!existing || date > existing.date) {
      matches.set(isin, {
        schemeCode: fields[0].trim(),
        schemeName: fields[3].trim(),
        nav,
        date,
      });
    }
  }
  return matches;
}

export async function fetchMutualFundNavs(isins: string[]): Promise<Map<string, MutualFundNav>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const navResponse = await fetch("https://portal.amfiindia.com/spages/NAVAll.txt", {
      headers: { Accept: "text/plain" },
      signal: controller.signal,
    });
    if (!navResponse.ok) throw new Error(`AMFI returned HTTP ${navResponse.status} while loading NAV data.`);
    const feed = await navResponse.text();
    if (!feed.includes(";") || feed.length > 12 * 1024 * 1024) {
      throw new Error("AMFI returned an invalid or unexpectedly large NAV file.");
    }
    return parseNavFeed(feed, new Set(isins));
  } catch (caught) {
    if (caught instanceof Error && caught.name === "AbortError") {
      throw new Error("The AMFI NAV request timed out. Try again later.");
    }
    throw caught;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function mutualFundNavHandler(
  request: MutualFundNavRequest,
  response: MutualFundNavResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, { error: "Only POST requests are supported." });
    return;
  }

  const isins = requestedIsins(request.body);
  if (!isins) {
    respond(response, 400, { error: `Provide between 1 and ${MAX_ISINS} valid mutual-fund ISINs.` });
    return;
  }

  try {
    const latestNavs = await fetchMutualFundNavs(isins);
    respond(response, 200, {
      provider: "AMFI",
      navs: isins.map((isin) => {
        const nav = latestNavs.get(isin);
        return nav ? { isin, ...nav } : { isin, error: "AMFI did not provide a usable NAV for this ISIN." };
      }),
    });
  } catch (caught) {
    respond(response, 502, { error: caught instanceof Error ? caught.message : "Could not load mutual-fund NAV data from AMFI." });
  }
}
