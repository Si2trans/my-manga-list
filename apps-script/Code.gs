const DEFAULT_GITHUB_OWNER = 'Si2trans';
const DEFAULT_GITHUB_REPO = 'my-manga-list';
const DEFAULT_GITHUB_BRANCH = 'main';
const DEFAULT_WORKFLOW_FILE = 'sync-chapters.yml';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SI2TRANS')
    .addItem('Sync chapters', 'syncChapters')
    .addItem('Show setup help', 'showSetupHelp')
    .addToUi();
}

function syncChapters() {
  const config = getGitHubConfig();
  if (!config.token) {
    throw new Error('Missing GITHUB_TOKEN in Apps Script Properties.');
  }

  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflowFile}/dispatches`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    contentType: 'application/json',
    payload: JSON.stringify({
      ref: config.branch,
      inputs: {
        reason: `apps-script:${new Date().toISOString()}`
      }
    })
  });

  const status = response.getResponseCode();
  const message = `GitHub response ${status}: ${response.getContentText()}`;
  appendSyncLog(status >= 200 && status < 300 ? 'triggered' : 'failed', message);

  if (status < 200 || status >= 300) {
    throw new Error(`GitHub workflow dispatch failed: ${status} ${response.getContentText()}`);
  }

  SpreadsheetApp.getUi().alert('Triggered GitHub chapter sync.');
}

function getGitHubConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    owner: props.getProperty('GITHUB_OWNER') || DEFAULT_GITHUB_OWNER,
    repo: props.getProperty('GITHUB_REPO') || DEFAULT_GITHUB_REPO,
    branch: props.getProperty('GITHUB_BRANCH') || DEFAULT_GITHUB_BRANCH,
    workflowFile: props.getProperty('WORKFLOW_FILE') || DEFAULT_WORKFLOW_FILE,
    token: props.getProperty('GITHUB_TOKEN')
  };
}

function appendSyncLog(status, message) {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet.getSheetByName('SyncLog') || spreadsheet.insertSheet('SyncLog');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['timestamp', 'status', 'message']);
  }
  sheet.appendRow([new Date(), status, message]);
}

function showSetupHelp() {
  SpreadsheetApp.getUi().alert([
    'Setup:',
    '1. This script defaults to Si2trans/my-manga-list on main.',
    '2. Create a GitHub token with Actions workflow permission.',
    '3. Store it in Apps Script Properties as GITHUB_TOKEN.',
    '4. Optional: override GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, or WORKFLOW_FILE in Script Properties.',
    '5. Keep this script private to your Google account.'
  ].join('\n'));
}
