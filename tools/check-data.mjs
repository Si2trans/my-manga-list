import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../data/site-data.json', import.meta.url), 'utf8'));

if (!Array.isArray(data.platforms)) throw new Error('site-data.json: platforms must be an array');
if (!Array.isArray(data.series)) throw new Error('site-data.json: series must be an array');

const platformIds = new Set(data.platforms.map(platform => platform.id));
for (const platform of data.platforms) {
  if (!platform.id || !platform.label) throw new Error('platform requires id and label');
}

for (const series of data.series) {
  if (!series.id || !series.title) throw new Error('series requires id and title');
  if (!Array.isArray(series.chapters)) throw new Error(`${series.id}: chapters must be an array`);

  const seenChapters = new Set();
  for (const chapter of series.chapters) {
    if (!Number.isFinite(Number(chapter.no))) throw new Error(`${series.id}: chapter.no must be numeric`);
    if (seenChapters.has(String(chapter.no))) throw new Error(`${series.id}: duplicate chapter ${chapter.no}`);
    seenChapters.add(String(chapter.no));

    if (!Array.isArray(chapter.sources) || !chapter.sources.length) {
      throw new Error(`${series.id} chapter ${chapter.no}: requires at least one source`);
    }

    for (const source of chapter.sources) {
      if (!platformIds.has(source.platform)) {
        throw new Error(`${series.id} chapter ${chapter.no}: unknown platform ${source.platform}`);
      }
      if (!/^https?:\/\//.test(source.url || '')) {
        throw new Error(`${series.id} chapter ${chapter.no}: invalid source url`);
      }
    }
  }
}

console.log(`site-data ok: ${data.series.length} series`);
