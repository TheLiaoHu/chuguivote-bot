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
  SHEET_CSV_URL: "PASTE_YOUR_PUBLISHED_CSV_LINK_HERE",
  BACKUP_CSV: "data/voting.csv",

  // true  = the bot reads your Google Sheet directly, so readers see
  //         edits within about 5 minutes (fastest)
  // false = the bot reads only the tested backup copy in GitHub, which
  //         updates after the automatic tests pass (safer: a typo in the
  //         sheet never reaches readers)
  USE_GOOGLE_SHEET: true,

  // Re-download the sheet if the page has been open longer than this
  REFRESH_MINUTES: 5,

  // Shown in the page header and the bot's first message
  NEWSROOM: "Your Newsroom",
  ELECTION: "Nov. 3, 2026, general election",

  // Buttons readers can tap to get started
  SUGGESTIONS: [
    "When is my ballot due in Pennsylvania?",
    "How do I get a mail ballot in Texas?",
    "Do I need a witness in Wisconsin?",
    "Where can I drop off my ballot in California?"
  ]
};
