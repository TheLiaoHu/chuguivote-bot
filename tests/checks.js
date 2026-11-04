/*
 * checks.js — two kinds of checks, shared by tests.html (in the browser)
 * and scripts/check.js (on GitHub Actions).
 *
 *   checkData(rows)              is the spreadsheet complete and well-formed?
 *   checkQuestions(bot, index)   does the bot answer our test questions correctly?
 */
(function (root) {
  var REQUIRED = ["state_id", "state_name", "mail_in_deadline", "request_process",
    "id_required", "official_link", "last_updated", "request_deadline"];
  var MUST_BE_FILLED = ["state_id", "state_name", "mail_in_deadline", "request_process",
    "id_required", "official_link", "last_updated", "request_deadline"];
  var STALE_AFTER_DAYS = 7;

  function checkData(rows, today) {
    today = today || new Date();
    var errors = [], warnings = [];
    if (!rows.length) return { errors: ["The sheet has no rows."], warnings: [] };

    var cols = Object.keys(rows[0]);
    REQUIRED.forEach(function (c) {
      if (cols.indexOf(c) === -1) errors.push('Missing column "' + c + '". Did someone rename a header?');
    });
    if (rows.length !== 51) {
      warnings.push("Expected 51 rows (50 states + DC) but found " + rows.length + ".");
    }

    var seen = {}, stale = [];
    rows.forEach(function (r, i) {
      var line = "Row " + (i + 2) + " (" + (r.state_name || "no name") + ")";
      MUST_BE_FILLED.forEach(function (c) {
        if (cols.indexOf(c) > -1 && !String(r[c] || "").trim()) errors.push(line + ': "' + c + '" is empty.');
      });
      var id = String(r.state_id || "").toUpperCase();
      if (id && !/^[A-Z]{2}$/.test(id)) errors.push(line + ': state_id "' + r.state_id + '" should be two letters.');
      if (seen[id]) errors.push(line + ": duplicate state_id " + id + ".");
      seen[id] = true;
      if (r.official_link && !/^https:\/\/\S+$/.test(r.official_link)) {
        errors.push(line + ": official_link should start with https:// and have no spaces.");
      }
      if (r.last_updated) {
        var d = new Date(r.last_updated + "T12:00:00");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.last_updated) || isNaN(d)) {
          errors.push(line + ': last_updated "' + r.last_updated + '" should look like 2026-10-06.');
        } else {
          var age = Math.floor((today - d) / 86400000);
          if (age > STALE_AFTER_DAYS) stale.push(r.state_id);
          if (age < -1) errors.push(line + ": last_updated is in the future.");
        }
      }
    });
    if (stale.length) {
      warnings.push(stale.length + " state(s) not re-checked in over " + STALE_AFTER_DAYS +
        " days: " + stale.join(", ") + ". Re-verify and update last_updated.");
    }
    return { errors: errors, warnings: warnings };
  }

  function sameList(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }

  function checkOne(bot, index, c, memory) {
    var res = bot.answer(c.q, index, memory);
    var text = bot.toText(res);
    var problems = [];
    var gotStates = res.states || [];
    if (!sameList(gotStates, c.states)) {
      problems.push("expected states [" + c.states.join(", ") + "] but got [" + gotStates.join(", ") + "]");
    }
    if (c.expectType && res.type !== c.expectType) {
      problems.push('expected a "' + c.expectType + '" reply but got "' + res.type + '"');
    }
    (c.columns || []).forEach(function (col) {
      c.states.forEach(function (id) {
        var row = index.byId[id];
        var cell = row && row[col];
        if (cell && text.indexOf(cell) === -1) problems.push("answer is missing the " + id + " " + col + " cell");
      });
    });
    (c.mustInclude || []).forEach(function (s) {
      if (text.indexOf(s) === -1) problems.push('answer should include "' + s + '"');
    });
    if (res.type === "answer") {
      res.blocks.forEach(function (b) {
        if (!b.link) problems.push(b.state + " answer has no official link");
      });
    }
    return { q: c.q, pass: problems.length === 0, problems: problems, text: text };
  }

  function checkQuestions(bot, index, suite) {
    var results = suite.CASES.map(function (c) { return checkOne(bot, index, c, {}); });
    var memory = {};
    suite.FOLLOW_UP.forEach(function (c, i) {
      var r = checkOne(bot, index, c, memory);
      r.q = "(follow-up " + (i + 1) + ") " + r.q;
      results.push(r);
    });
    return results;
  }

  var api = { checkData: checkData, checkQuestions: checkQuestions };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MailBotChecks = api;
})(this);
