# SI2TRANS manga list

Static public site with generated chapter data.

## Data flow

```text
Google Sheet
  -> Apps Script menu
  -> GitHub Actions workflow_dispatch
  -> Playwright chapter sync
  -> data/site-data.json
  -> Vercel static site
```

The public website only reads `data/site-data.json`. It does not expose admin or sync controls.

## Local files

- `data/source-config.json` - editable source config for sample/local sync.
- `data/site-data.json` - generated public data consumed by the frontend.
- `tools/sync-chapters.mjs` - Playwright sync runner.
- `apps-script/Code.gs` - Google Sheet menu template.
- `.github/workflows/sync-chapters.yml` - manual/API-triggered GitHub Actions sync.
- `_legacy/` - backup of the previous static implementation.

## Commands

```bash
npm install
npm run sync:chapters
npm run check:data
```

## Sheet schema

Recommended tabs:

- `Series`: `seriesId`, `title`, `slug`, `status`, `cover`, `description`, `powerLevel`, `sortOrder`, `visible`
- `Sources`: `seriesId`, `platform`, `url`, `visible`
- `Platforms`: `platform`, `label`, `icon`, `profileUrl`, `sortOrder`, `visible`
- `SyncLog`: `timestamp`, `status`, `message`

For now the sample config lives in `data/source-config.json`.
