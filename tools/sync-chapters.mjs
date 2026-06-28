import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(rootDir, 'data', 'source-config.json');
const outputPath = path.join(rootDir, 'data', 'site-data.json');

function absoluteUrl(href, baseUrl) {
  return new URL(href, baseUrl).href;
}

function normalizeChapterNo(value) {
  const match = String(value || '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function sourceKey(source) {
  return `${source.platform}|${source.url}`;
}

function mergeSourcesByChapter(scrapedByPlatform) {
  const chapters = new Map();

  for (const sourceRows of scrapedByPlatform) {
    for (const source of sourceRows) {
      if (!Number.isFinite(source.chapterNo)) continue;
      const key = String(source.chapterNo);
      if (!chapters.has(key)) {
        chapters.set(key, {
          no: source.chapterNo,
          label: `ตอนที่ ${source.chapterNo}`,
          sources: []
        });
      }

      const chapter = chapters.get(key);
      const publicSource = {
        platform: source.platform,
        url: source.url
      };
      if (source.access) publicSource.access = source.access;

      if (!chapter.sources.some(existing => sourceKey(existing) === sourceKey(publicSource))) {
        chapter.sources.push(publicSource);
      }
    }
  }

  return [...chapters.values()].sort((a, b) => a.no - b.no);
}

async function safeClick(page, locator, options = {}) {
  const count = await locator.count();
  if (count !== 1) return false;
  await locator.click({ timeout: options.timeout ?? 10000, force: options.force ?? false });
  await page.waitForTimeout(options.after ?? 700);
  return true;
}

async function scrapeReadRealm(page, source) {
  await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);

  const ranges = await page.evaluate(() => {
    return [...document.querySelectorAll('div.cursor-pointer')]
      .map(el => (el.textContent || '').trim().replace(/\s+/g, ' '))
      .filter(text => /^\d+\s*-\s*\d+$/.test(text));
  });

  for (const rangeText of ranges) {
    if (rangeText === ranges[0]) continue;
    await page.evaluate(text => {
      const target = [...document.querySelectorAll('div.cursor-pointer')]
        .find(el => (el.textContent || '').trim().replace(/\s+/g, ' ') === text);
      target?.click();
    }, rangeText);
    await page.waitForTimeout(500);
  }

  return page.evaluate(platform => {
    function readRealmCoinAccess(anchor) {
      const coinIcon = anchor.querySelector('img[title*="ReadCoin"], img[alt*="ReadCoin"], img[src*="read-coin"]');
      if (!coinIcon) return null;
      const coinRow = coinIcon.closest('div');
      const amountText = (coinRow?.textContent || '').trim().replace(/\s+/g, ' ');
      const amount = Number((amountText.match(/\d+(?:\.\d+)?/) || [])[0]);
      return amount > 0 ? { type: 'coin', label: 'coin', amount } : null;
    }

    const rows = [...document.querySelectorAll('a[href*="/comic/chapter/"]')]
      .map(anchor => {
        const label = (anchor.querySelector('p')?.textContent || '').trim().replace(/\s+/g, ' ');
        if (!/^\d+(?:\.\d+)?$/.test(label)) return null;
        const row = {
          platform,
          chapterNo: Number(label),
          label,
          url: new URL(anchor.getAttribute('href'), location.origin).href
        };
        const access = readRealmCoinAccess(anchor);
        if (access) row.access = access;
        return row;
      })
      .filter(Boolean);

    return [...new Map(rows.map(row => [row.url, row])).values()].sort((a, b) => a.chapterNo - b.chapterNo);
  }, source.platform);
}

async function closeMyNovelPopup(page) {
  const closeCandidates = [
    page.locator('button').filter({ hasText: '×' }),
    page.locator('button').filter({ hasText: 'x' }),
    page.locator('[aria-label="Close"]'),
    page.locator('[aria-label="close"]')
  ];

  for (const locator of closeCandidates) {
    if (await safeClick(page, locator, { force: true, after: 500 }).catch(() => false)) return true;
  }

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  return false;
}

async function scrapeMyNovel(page, source) {
  await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
  await closeMyNovelPopup(page);

  const collected = new Map();
  async function collectCurrent() {
    const rows = await page.evaluate(platform => {
      return [...document.querySelectorAll('a[href*="/chapter/"]')]
        .map(anchor => {
          const label = (anchor.querySelector('h3')?.textContent || '').trim().replace(/\s+/g, ' ');
          const match = label.match(/(?:ตอนที่\s*)?(\d+(?:\.\d+)?)/);
          if (!match) return null;
          return {
            platform,
            chapterNo: Number(match[1]),
            label,
            url: new URL(anchor.getAttribute('href'), location.origin).href
          };
        })
        .filter(Boolean);
    }, source.platform);

    for (const row of rows) collected.set(row.chapterNo, row);
  }

  await collectCurrent();
  const ranges = await page.evaluate(() => {
    return [...document.querySelectorAll('button')]
      .map(button => (button.innerText || button.textContent || '').trim().replace(/\s+/g, ' '))
      .filter(text => /^\d+\s*-\s*\d+$/.test(text));
  });

  for (const rangeText of ranges) {
    await safeClick(page, page.locator('button').filter({ hasText: rangeText }), { force: true, after: 800 });
    await collectCurrent();
  }

  return [...collected.values()].sort((a, b) => a.chapterNo - b.chapterNo);
}

async function scrapeReadToon(page, source) {
  await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);

  const collected = new Map();
  async function collectCurrent() {
    const rows = await page.evaluate(platform => {
      return [...document.querySelectorAll('a[href^="/content/"]')]
        .map(anchor => {
          const href = anchor.getAttribute('href') || '';
          if (!/\/\d+(?:\.\d+)?$/.test(href)) return null;
          const text = (anchor.innerText || anchor.textContent || '').trim().replace(/\s+/g, ' ');
          const match = text.match(/ตอนที่\s*(\d+(?:\.\d+)?)/);
          if (!match) return null;
          const coin = text.match(/(\d+)\s*เหรียญ/);
          return {
            platform,
            chapterNo: Number(match[1]),
            label: `ตอนที่ ${match[1]}`,
            access: coin ? { type: 'coin', label: 'coin' } : null,
            url: new URL(href, location.origin).href
          };
        })
        .filter(Boolean);
    }, source.platform);

    for (const row of rows) collected.set(row.chapterNo, row);
  }

  await collectCurrent();
  for (let currentPage = 2; currentPage <= 50; currentPage += 1) {
    const target = page.getByRole('button', { name: `pagination item ${currentPage}` });
    const clicked = await safeClick(page, target, { after: 900 });
    if (!clicked) {
      const plainTarget = page.getByRole('button', { name: String(currentPage), exact: true });
      const plainClicked = await safeClick(page, plainTarget, { after: 900 });
      if (!plainClicked) break;
    }
    await collectCurrent();
  }

  return [...collected.values()].sort((a, b) => a.chapterNo - b.chapterNo);
}

const scrapers = {
  mynovel: scrapeMyNovel,
  readrealm: scrapeReadRealm,
  readtoon: scrapeReadToon
};

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const browser = await chromium.launch({ headless: true });

  try {
    for (const series of config.series) {
      if (series.visible === false) continue;
      const scrapedByPlatform = [];

      for (const source of series.sources || []) {
        if (source.visible === false) continue;
        const scrape = scrapers[source.platform];
        if (!scrape) {
          console.warn(`No scraper for platform: ${source.platform}`);
          continue;
        }

        const page = await browser.newPage();
        try {
          console.log(`Sync ${series.id} / ${source.platform}`);
          const rows = await scrape(page, source);
          console.log(`  ${rows.length} chapters`);
          scrapedByPlatform.push(rows);
        } finally {
          await page.close().catch(() => {});
        }
      }

      series.chapters = mergeSourcesByChapter(scrapedByPlatform);
      series.latest = series.chapters.length ? String(series.chapters[series.chapters.length - 1].no) : '';
    }
  } finally {
    await browser.close();
  }

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    platforms: config.platforms,
    series: config.series
      .filter(series => series.visible !== false)
      .map(series => ({
        ...series,
        sources: (series.sources || []).filter(source => source.visible !== false),
        chapters: series.chapters || []
      }))
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
