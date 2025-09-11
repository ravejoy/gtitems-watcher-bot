// src/services/scanner.ts
import chardet from 'chardet';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import iconv from 'iconv-lite';
import pLimit from 'p-limit';

export type Progress = { done: number; total: number; matches: number };
export type FoundSite = { url: string; siteId: string; items: string[] };

const ORIGIN = process.env.BASE_URL ?? 'https://rpgtop.su';
const UA = 'Mozilla/5.0 (compatible; gtitems-watcher-bot/1.0)';
const COMM_RE = /^\/comm(?:\/t\d+)?\/\d+\/\d+\.htm$/i;

type ItemsXmlEntry = { id?: string | number | null; alt?: string | null; link?: string | null };
type ItemsXml = { item?: { items?: ItemsXmlEntry | ItemsXmlEntry[] } | null };

/* --------------------------- url helpers --------------------------- */

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function ratingUrl(i: number): string {
  return `${ORIGIN}/p${i}.html`;
}

function itemsCgiUrl(siteId: string, page = 1): string {
  const ver = process.env.ITEMS_CGI_VER ?? '2040';
  const tpl =
    process.env.ITEMS_CGI_PATH_TEMPLATE ??
    '/cgi-bin/js/_item.cgi?act=list&ver={ver}&site={siteId}&page={page}';
  return joinUrl(
    ORIGIN,
    tpl.replace('{ver}', ver).replace('{siteId}', siteId).replace('{page}', String(page)),
  );
}

/* ---------------------------- fetchers ---------------------------- */

async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html,*/*',
      ...(process.env.REQUEST_COOKIE ? { cookie: process.env.REQUEST_COOKIE } : {}),
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);

  const ab = await resp.arrayBuffer();
  const buf = Buffer.from(ab);
  const guess = (chardet.detect(buf) || 'UTF-8').toString().toLowerCase();
  const enc = guess.includes('1251') || guess.includes('windows-1251') ? 'win1251' : 'utf-8';
  return iconv.decode(buf, enc);
}

/** CGI on this site is effectively CP1251 → force win1251. */
async function fetchTextCgi(url: string, referer?: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/xml,*/*',
      'x-requested-with': 'XMLHttpRequest',
      ...(referer ? { referer } : {}),
      ...(process.env.REQUEST_COOKIE ? { cookie: process.env.REQUEST_COOKIE } : {}),
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  const ab = await resp.arrayBuffer();
  const buf = Buffer.from(ab);
  return iconv.decode(buf, 'win1251');
}

/* ---------------------------- parsers ----------------------------- */

function abs(href: string, base: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('//')) return 'https:' + href;
  return new URL(href, base).toString();
}

export function extractReviewLinksFromRating(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href) return;
    try {
      const u = new URL(abs(href, baseUrl));
      if (!/rpgtop\.su$/i.test(u.hostname)) return;
      if (COMM_RE.test(u.pathname)) out.add(`${u.origin}${u.pathname}`);
    } catch {
      /* ignore */
    }
  });
  return [...out];
}

function siteIdFromReviewUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/comm(?:\/t\d+)?\/(\d+)\/\d+\.htm$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function siteIdFromReviewHtml(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);

  // primary: anchor /site/{id}
  const viaLink = $('a[href*="/site/"]')
    .toArray()
    .map((el) => {
      try {
        const href = new URL($(el).attr('href')!, baseUrl).pathname;
        const m = href.match(/\/site\/(\d+)(?:\.htm)?(?:\/)?$/i);
        return m ? m[1] : null;
      } catch {
        return null;
      }
    })
    .find(Boolean);
  if (viaLink) return viaLink as string;

  // fallback: inline "site=" in scripts/attrs
  const m = html.match(/(?:[?&]site=|site\s*[:=]\s*)(\d{2,})/i);
  if (m) return m[1];
  return null;
}

function normalizeToArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

/** parse XML → return ALL item names (no dedupe) */
function parseItemsFromXml(text: string): string[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
  });

  try {
    const parsed = parser.parse(text) as unknown as ItemsXml;
    const items = normalizeToArray(parsed?.item?.items);
    return items.map((it) => (it?.alt ?? '').toString().trim()).filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/** fallback: CGI sometimes returns HTML fragment with #gtitems */
function parseItemsFromHtmlFragment(text: string): string[] {
  const $ = cheerio.load(text);
  const out: string[] = [];
  $('#gtitems .gift img[alt], .gift img[alt], #gtitems a img[alt]').each((_, el) => {
    const name = ($(el).attr('alt') || '').trim();
    if (name) out.push(name);
  });
  return out;
}

/* -------------------------- public API ---------------------------- */

async function fetchSiteItems(siteId: string, refererUrl: string): Promise<string[]> {
  const url = itemsCgiUrl(siteId, 1);
  const text = await fetchTextCgi(url, refererUrl);

  const viaXml = parseItemsFromXml(text);
  if (viaXml.length > 0) return viaXml;

  if (/gtitems|<img|<div|<a/i.test(text)) {
    const viaHtml = parseItemsFromHtmlFragment(text);
    if (viaHtml.length > 0) return viaHtml;
  }

  return [];
}

/** Collect review links from p1..p{pages} */
export async function collectReviewUrls(pages: number): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();

  for (let i = 1; i <= pages; i++) {
    const pUrl = ratingUrl(i);
    try {
      const html = await fetchHtml(pUrl);
      const links = extractReviewLinksFromRating(html, pUrl);
      for (const r of links) {
        if (!seen.has(r)) {
          seen.add(r);
          out.push(r);
        }
      }
    } catch {
      // ignore page errors
    }
  }

  return out;
}

/** Main scan with concurrency and progress callback */
export async function scan(
  pages: number,
  concurrency = 8,
  onProgress?: (p: Progress) => void,
): Promise<FoundSite[]> {
  const reviewUrls = await collectReviewUrls(pages);
  const total = reviewUrls.length;

  let done = 0;
  let matches = 0;
  const limit = pLimit(concurrency);
  const results: FoundSite[] = [];

  const tasks = reviewUrls.map((url) =>
    limit(async () => {
      try {
        let siteId = siteIdFromReviewUrl(url);
        if (!siteId) {
          const html = await fetchHtml(url);
          siteId = siteIdFromReviewHtml(html, url);
        }

        let items: string[] = [];
        if (siteId) items = await fetchSiteItems(siteId, url);

        done += 1;
        if (items.length > 0) {
          matches += 1;
          results.push({ url, siteId: siteId ?? 'unknown', items });
        }
        onProgress?.({ done, total, matches });
      } catch {
        done += 1;
        onProgress?.({ done, total, matches });
      }
    }),
  );

  await Promise.all(tasks);
  return results;
}
