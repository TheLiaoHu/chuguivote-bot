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
3. **Config**: In this repo, edit `config.js` and paste the link into `SHEET_CSV_URL`. Commit. Keep `USE_GOOGLE_SHEET: false` to serve the tested local copy, or set it to `true` to enable direct live-sheet loading.
4. **Pages**: Settings > Pages > Source: *GitHub Actions* > Save. Your bot appears at `https://YOUR-USERNAME.github.io/REPO-NAME/` in a minute or two.
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

## Local development and publishing

No npm install, API keys, or build tools are needed. Use Node 24 and Python 3:

```sh
node scripts/check.js data/voting.csv
node --test tests/regressions.cjs
python3 -m http.server 8000 --bind 127.0.0.1
```

Open the local site and `tests.html` in your browser. The default uses the tested CSV in this repository so a Google outage cannot delay initial loading. Live mode times out after eight seconds and falls back to the validated backup.

In repository Settings > Pages, choose **GitHub Actions**. Push these changes to `main`, then check **Test and deploy website** in Actions. It tests the data and code and uploads only the website files. The separate **Sync sheet and test bot** workflow validates the published sheet before committing an updated backup every 30 minutes. Its successful completion triggers deployment so automated CSV commits also reach Pages. No npm publishing or Jekyll build is needed.

This guide describes the **Nov. 3, 2026 election**. The current CSV's dates require editorial re-verification before presenting it as current voting guidance. Do not change `last_updated` without checking the official sources. For a later election, update and verify the spreadsheet, election labels, and question cases together.

## Theme and flag backgrounds

The interface starts with a black-and-white theme; verified sitting-governor records can change its accents as described below. After an answer, the page background shows that state's locally bundled flag; a dark overlay keeps the white chat panel readable. All 50 states and D.C. are included in `assets/flags/` and packaged by the Pages workflow. No image API or network access is needed. Follow-ups retain the state; comparisons show the last state in the answer, identified above the chat. An unavailable flag falls back to the plain dark background. Reduced-motion preferences disable decorative animation.

## Election results and governor-party colors

Ask “Who is leading the Senate race in Pennsylvania?” or “Governor results in Texas.” A separate panel displays results, timestamps, source links, reporting estimates and explicit call status when a live source is configured. An AP coverage link is available now; the AP news page is not a results API. `RESULTS_URL` is intentionally empty until an authorized public JSON adapter is connected.

Site accents follow the **party of the sitting governor**, independently of election leads or projected successors: blue for Democratic, red for Republican, purple for Independent, green for another party. The panel names the party in text. The current governor directory is intentionally empty pending source verification, so all states stay neutral initially. Missing, stale and unverified records also stay neutral. D.C. stays neutral because it has no governor.

See [the feed and governor-directory setup guide](docs/election-results.md) for contracts, source requirements, refresh behavior and validation. Do not put provider credentials in browser code. Run `node tests/results.cjs` for the election integration's unit checks.
