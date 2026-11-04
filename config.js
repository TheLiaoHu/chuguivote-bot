/*
 * config.js — the ONLY file most students need to edit.
 *
 * SHEET_CSV_URL: In Google Sheets choose File > Share > Publish to web,
 * pick your tab, choose "Comma-separated values (.csv)", click Publish,
 * and paste the link here. It ends in  output=csv
 *
 * BACKUP_CSV: a copy of the sheet saved inside this GitHub repo. A GitHub
 * Action refreshes it automatically (see .github/workflows/sync-sheet.yml).
 * The bot uses it if Google can't be reached.
 */
window.BOT_CONFIG = {
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR4UdEQ-BLwGZwRzp7nvExdTNrdGDP7jhn9eZHHkK45fjLr6S1p-vjbZw_fqXTc-Rf5-_LH7-EzudC5/pub?output=csv",
  BACKUP_CSV: "data/voting.csv",

  // A public HTTPS JSON endpoint following docs/election-results.md.
  // Leave empty until a real results provider is connected. Never put API keys here.
  RESULTS_URL: "",
  RESULTS_NEWS_URL: "https://apnews.com/live/midterm-election-2026",
  GOVERNORS_URL: "data/governors.json",
  GOVERNORS_MAX_AGE_DAYS: 30,
  RESULTS_ELECTION_DATE: "2026-11-03",
  RESULTS_REFRESH_SECONDS: 60,
  RESULTS_STALE_MINUTES: 15,

  // true  = the bot reads your Google Sheet directly, so readers see
  //         edits within about 5 minutes (fastest)
  // false = the bot reads only the tested backup copy in GitHub, which
  //         updates after the automatic tests pass (safer: a typo in the
  //         sheet never reaches readers)
  USE_GOOGLE_SHEET: false,

  // Re-download the sheet if the page has been open longer than this
  REFRESH_MINUTES: 5,

  // Shown in the page header and the bot's first message
  NEWSROOM: "Mail Ballot Answers",
  ELECTION: "Nov. 3, 2026, general election",

  // Buttons readers can tap to get started
  SUGGESTIONS: [
    "Who is leading the Senate race in Pennsylvania?",
    "Governor results in Texas",
    "When is my ballot due in Pennsylvania?",
    "How do I get a mail ballot in Texas?",
    "Do I need a witness in Wisconsin?",
    "Where can I drop off my ballot in California?"
  ]
};
