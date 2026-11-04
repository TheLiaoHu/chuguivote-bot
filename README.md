# Mail Ballot Answers

A question-and-answer bot about voting by mail in all 50 states and D.C.
It runs on **GitHub Pages** and gets every answer from a **Google Sheet** that reporters keep up to date.
No servers, no paid tools, no API keys, no AI model. Edit the sheet and the bot's answers change.

```
Google Sheet  ──(Publish to web, CSV)──▶  index.html on GitHub Pages  ──▶  reader
      │                                          ▲
      └──(GitHub Action every 30 min)──▶ data/voting.csv (tested backup copy)
```

## Files

| File | What it does | Who edits it |
|---|---|---|
| `config.js` | Sheet link, newsroom name, example questions, direct vs. tested-copy mode | Everyone |
| `bot.js` | Finds the state and topic in a question, builds the answer from the sheet | Students improving the bot |
| `app.js` | Loads the data and draws the chat | Rarely |
| `index.html`, `style.css` | The reader-facing page | Designers |
| `tests.html` | Test report: checks the sheet and asks the bot 23 test questions | Open it after every edit |
| `tests/test-cases.js` | The test questions | Add one for every question the bot fumbles |
| `tests/checks.js` | The rules the sheet and the answers must follow | Rarely |
| `scripts/check.js` | Runs the same tests on GitHub Actions | Rarely |
| `.github/workflows/sync-sheet.yml` | Copies the sheet into `data/voting.csv` every 30 minutes after it passes the tests | Rarely |
| `data/voting.csv` | Backup copy of the sheet | The Action (don't edit by hand) |

## Setup in five steps

1. **Sheet**: Import `data/voting.csv` into a new Google Sheet (File > Import > Upload). Keep the header row exactly as is.
2. **Publish**: File > Share > Publish to web > choose the tab > *Comma-separated values (.csv)* > Publish. Copy the link (it ends in `output=csv`).
3. **Config**: In this repo, edit `config.js` and paste the link into `SHEET_CSV_URL`. Commit.
4. **Pages**: Settings > Pages > Source: *Deploy from a branch* > `main` / `(root)` > Save. Your bot appears at `https://YOUR-USERNAME.github.io/REPO-NAME/` in a minute or two.
5. **Action**: Settings > Secrets and variables > Actions > *Variables* tab > New repository variable named `SHEET_CSV_URL` with the same link. Then Actions tab > *Sync sheet and test bot* > Run workflow.

## Updating a fact

1. Change the cell in the Google Sheet. Update `last_updated` (YYYY-MM-DD) and add the source link in `sources`.
2. Open `tests.html` on your site. Fix anything red.
3. Ask the bot. Published-to-web CSVs can take up to about 5 minutes to reflect edits.

## Spreadsheet rules

- Don't rename, reorder or delete the headers in row 1. Add new columns at the end.
- One row per state. `state_id` is the two-letter code.
- `official_link` must start with `https://`.
- `last_updated` uses the format `2026-10-06`.
- Optional: add a `return_where` column and the bot will use it to answer "where" questions.
- Never put anything in the sheet you wouldn't publish. A published sheet is public.
