/*
 * scripts/check.js — run by GitHub Actions (see .github/workflows/).
 * Usage: node scripts/check.js data/voting.csv
 * Exits with an error (a red X on GitHub) if the data is broken or a test question fails.
 */
const fs = require("fs");
const path = require("path");
const bot = require("../bot.js");
const checks = require("../tests/checks.js");
const suite = require("../tests/test-cases.js");

const file = process.argv[2] || path.join(__dirname, "..", "data", "voting.csv");
const rows = bot.parseCSV(fs.readFileSync(file, "utf8"));
const index = bot.buildIndex(rows);

let failed = false;

console.log(`\n== Data check: ${rows.length} rows from ${file}`);
const data = checks.checkData(rows);
data.errors.forEach((e) => { console.log("::error::" + e); failed = true; });
data.warnings.forEach((w) => console.log("::warning::" + w));
if (!data.errors.length) console.log("Data looks complete.");

console.log("\n== Question check");
const results = checks.checkQuestions(bot, index, suite);
results.forEach((r) => {
  console.log((r.pass ? "PASS  " : "FAIL  ") + r.q);
  r.problems.forEach((p) => console.log("        - " + p));
  if (!r.pass) failed = true;
});
// Update test: change a cell, and the answer must change with it.
const copy = rows.map((r) => Object.assign({}, r));
const oh = copy.find((r) => r.state_id === "OH");
if (oh) {
  oh.mail_in_deadline = "TEST EDIT: received by noon, Nov. 3";
  const t = bot.toText(bot.answer("When is my ballot due in Ohio?", bot.buildIndex(copy), {}));
  const ok = t.includes("TEST EDIT");
  console.log((ok ? "PASS  " : "FAIL  ") + "An edited cell shows up in the next answer");
  results.push({ pass: ok });
  if (!ok) failed = true;
}
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} questions passed.`);

process.exit(failed ? 1 : 0);
