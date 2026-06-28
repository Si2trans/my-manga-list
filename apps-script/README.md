# SI2TRANS Apps Script

This folder is a template for the Google Sheet menu.

It does not store secrets. Put the GitHub token in Apps Script Properties:

- Key: `GITHUB_TOKEN`
- Value: GitHub personal access token with permission to dispatch workflows

Update these constants in `Code.gs` after the real GitHub repo is confirmed:

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`

The public website never sees this token.
