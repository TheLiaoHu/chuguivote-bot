/*
 * bot.js — the "brain" of the mail-in voting bot.
 *
 * Everything in this file is plain JavaScript with no libraries, so it runs
 * the same way in a web browser (on GitHub Pages) and in the automated tests
 * (on GitHub Actions). It does four jobs:
 *
 *   1. parseCSV()      turn the spreadsheet's CSV text into rows
 *   2. findStates()    figure out which state(s) a question is about
 *   3. findTopics()    figure out what the person wants to know
 *   4. answer()        build a reply using ONLY what is in the spreadsheet
 *
 * The bot never makes anything up. If a cell is empty, it says so and
 * points to the official state election website.
 */
(function (root) {
  "use strict";

  /* ---------------------------------------------------------------------
   * 1. CSV PARSING
   * Handles quoted cells, commas inside quotes, and line breaks inside
   * quotes (our "sources" column has several links per cell).
   * ------------------------------------------------------------------- */
  function parseCSV(text) {
    text = String(text || "").replace(/^﻿/, ""); // strip invisible BOM
    var rows = [], row = [], cell = "", inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }

    var header = (rows.shift() || []).map(function (h) { return h.trim(); });
    return rows
      .filter(function (r) { return r.some(function (c) { return c.trim() !== ""; }); })
      .map(function (r) {
        var obj = {};
        header.forEach(function (h, idx) { obj[h] = (r[idx] || "").trim(); });
        return obj;
      });
  }

  /* ---------------------------------------------------------------------
   * 2. FINDING THE STATE
   * Full names are matched first, longest first, so "West Virginia" wins
   * over "Virginia" and "Arkansas" never matches "Kansas".
   * Two-letter codes (TX, NC) only count when typed in CAPITALS, so the
   * words "in", "or", "me", "hi" and "ok" are not mistaken for states.
   * ------------------------------------------------------------------- */
  var ALIASES = {
    "washington dc": "DC", "washington d.c.": "DC", "d.c.": "DC",
    "the district": "DC", "dc": "DC",
    "jersey": "NJ", "cali": "CA", "mass": "MA", "penn": "PA",
    "n. carolina": "NC", "s. carolina": "SC", "n. dakota": "ND", "s. dakota": "SD"
  };

  var AMBIGUOUS_CODES = ["ID", "OK", "IN", "OR", "ME", "HI"];

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function buildIndex(rows) {
    var byId = {}, names = [];
    rows.forEach(function (r) {
      var id = (r.state_id || "").toUpperCase();
      if (!id) return;
      byId[id] = r;
      names.push({ name: r.state_name.toLowerCase(), id: id });
    });
    Object.keys(ALIASES).forEach(function (a) {
      if (byId[ALIASES[a]]) names.push({ name: a, id: ALIASES[a] });
    });
    names.sort(function (a, b) { return b.name.length - a.name.length; });
    return { byId: byId, names: names, rows: rows };
  }

  function findStates(question, index) {
    var found = [], seen = {};
    var lower = " " + question.toLowerCase().replace(/[’']/g, "'") + " ";
    index.names.forEach(function (n) {
      var re = new RegExp("(^|[^a-z.])" + escapeRe(n.name) + "(?![a-z])");
      var m = re.exec(lower);
      if (m && !seen[n.id]) {
        seen[n.id] = true;
        found.push({ id: n.id, pos: m.index });
        // blank out the match so "Virginia" can't re-match inside "West Virginia"
        lower = lower.slice(0, m.index + m[1].length) +
          " ".repeat(n.name.length) +
          lower.slice(m.index + m[1].length + n.name.length);
      }
    });
    // two-letter codes, capitals only, and only if the whole message isn't shouted
    var shouting = question === question.toUpperCase();
    if (!shouting) {
      var codeRe = /\b([A-Z]{2})\b/g, m2;
      while ((m2 = codeRe.exec(question))) {
        var code = m2[1];
        // Skip codes that are also everyday words: "ID", "OK", "IN", "OR", "ME", "HI"
        if (AMBIGUOUS_CODES.indexOf(code) > -1) continue;
        if (index.byId[code] && !seen[code]) {
          seen[code] = true;
          found.push({ id: code, pos: m2.index });
        }
      }
    }
    found.sort(function (a, b) { return a.pos - b.pos; });
    return found.map(function (f) { return f.id; });
  }

  /* ---------------------------------------------------------------------
   * 3. FINDING THE TOPIC
   * Each topic has a list of trigger words. Students: this is the easiest
   * place to improve the bot. Read your test failures, then add words.
   * ------------------------------------------------------------------- */
  var TOPICS = [
    { key: "return",
      words: ["due", "postmark", "return", "send it back", "send back", "mail it",
              "mail back", "turn in", "arrive", "received", "late", "count",
              "grace period", "deadline to vote", "last day to vote", "when must"] },
    { key: "request",
      words: ["request", "apply", "application", "sign up", "get a ballot",
              "get my ballot", "get an absentee", "ask for", "order", "receive a ballot"] },
    { key: "eligibility",
      words: ["excuse", "eligible", "qualify", "who can", "anyone", "allowed",
              "reason", "automatic", "automatically", "do i need to apply"] },
    { key: "id",
      words: ["id", "identification", "witness", "notary", "notarize", "notarized",
              "signature", "signed", "sign the", "ssn", "social security", "license", "proof"] },
    { key: "where",
      words: ["where", "drop box", "dropbox", "drop off", "drop it", "location",
              "polling place", "clerk", "office"] },
    { key: "news",
      words: ["new", "change", "changed", "law", "court", "lawsuit", "update",
              "different this year", "this year"] },
    { key: "source",
      words: ["source", "official", "website", "link", "learn more", "more info",
              "verify", "how do you know"] }
  ];

  function findTopics(question) {
    var q = " " + question.toLowerCase().replace(/[^a-z0-9.' ]/g, " ") + " ";
    var hits = [];
    TOPICS.forEach(function (t) {
      var hit = t.words.some(function (w) {
        return new RegExp("(^|\\W)" + escapeRe(w) + "(\\W|$)").test(q);
      });
      if (hit) hits.push(t.key);
    });
    // "when do I need to request" is a request question, not a return question
    if (hits.indexOf("request") > -1 && hits.indexOf("return") > -1 &&
        !/postmark|due|return|send|mail it|arrive|received|count/.test(q)) {
      hits.splice(hits.indexOf("return"), 1);
    }
    // Broad question words, used only when nothing more specific matched
    if (!hits.length) {
      if (/\bwhen\b|\bdeadline|\bdate/.test(q)) hits.push("return", "request");
      else if (/\bhow\b/.test(q)) hits.push("eligibility", "request", "id");
    }
    return hits;
  }

  /* ---------------------------------------------------------------------
   * 4. BUILDING THE ANSWER
   * Every sentence comes from a spreadsheet cell. Change the cell,
   * and the answer changes. No cell, no claim.
   * ------------------------------------------------------------------- */
  var LABELS = {
    return: "Ballot return deadline",
    request: "Deadline to request a ballot",
    eligibility: "Who can vote by mail",
    id: "ID, witness and signature rules",
    where: "Where to return it",
    news: "What's new for 2026",
    source: "Official source"
  };

  function field(row, col) { return (row && row[col] ? row[col] : "").trim(); }

  function sectionFor(topic, row) {
    var missing = "Our spreadsheet doesn't have this yet. Please check the official site below.";
    switch (topic) {
      case "return":
        return field(row, "mail_in_deadline") || missing;
      case "request":
        return field(row, "request_deadline") || missing;
      case "eligibility":
        return field(row, "request_process") || missing;
      case "id":
        return field(row, "id_required") || missing;
      case "where":
        // Optional column: add "return_where" to your sheet and the bot uses it automatically.
        var where = field(row, "return_where");
        if (where) return where;
        var notes = field(row, "notes_2026");
        var deadline = field(row, "mail_in_deadline");
        var hint = /drop box|in person|hand delivery|clerk|office|polls|vote center/i.test(deadline + " " + notes)
          ? "From our notes: " + [deadline, notes].filter(Boolean).join(" ") + " "
          : "";
        return hint + "Return locations (mail, drop boxes, local election office) vary by county, " +
          "so check the official site below for the places that accept ballots where you live.";
      case "news":
        return field(row, "notes_2026") || "We have no 2026 changes noted for this state.";
      case "source":
        return field(row, "official_link") || missing;
    }
    return missing;
  }

  function stateBlock(row, topics) {
    var parts = [];
    var list = topics.length ? topics
      : ["eligibility", "request", "return", "id"]; // no topic = quick overview
    list.forEach(function (t) {
      if (t === "source") return; // link is always added at the bottom
      parts.push({ label: LABELS[t], text: sectionFor(t, row) });
    });
    if (!topics.length && field(row, "notes_2026")) {
      parts.push({ label: LABELS.news, text: field(row, "notes_2026") });
    }
    return {
      state: row.state_name,
      stateId: row.state_id,
      parts: parts,
      link: field(row, "official_link"),
      lastUpdated: field(row, "last_updated")
    };
  }

  /**
   * answer(question, index, memory)
   * memory remembers the last state so follow-ups like "what about ID?" work.
   * Returns { type, intro, blocks, states, topics } — the page decides how to draw it.
   */
  function answer(question, index, memory) {
    memory = memory || {};
    var q = String(question || "").trim();
    if (!q) return { type: "help", intro: helpText() };

    if (/^(hi|hello|hey|help|what can you do|\?)\b/i.test(q) && !findStates(q, index).length) {
      return { type: "help", intro: helpText() };
    }

    var states = findStates(q, index).slice(0, 3);
    // Remove state names first so "New York" doesn't trigger the "new" topic
    var qNoStates = q;
    index.names.forEach(function (n) {
      qNoStates = qNoStates.replace(new RegExp("\\b" + escapeRe(n.name) + "\\b", "ig"), " ");
    });
    var topics = findTopics(qNoStates);
    var usedMemory = false;

    if (!states.length && memory.lastState && topics.length) {
      states = [memory.lastState];
      usedMemory = true;
    }
    if (!states.length) {
      return {
        type: "need_state",
        topics: topics,
        intro: "Which state are you asking about? Try something like \"When is my ballot due in Ohio?\""
      };
    }

    memory.lastState = states[states.length - 1];
    return {
      type: "answer",
      states: states,
      topics: topics,
      usedMemory: usedMemory,
      blocks: states.map(function (id) { return stateBlock(index.byId[id], topics); })
    };
  }

  function helpText() {
    return "I answer questions about voting by mail in the Nov. 3, 2026, general election, " +
      "using a spreadsheet our newsroom keeps up to date. Name a state and ask about deadlines, " +
      "how to request a ballot, ID or witness rules, or where to return it.";
  }

  /* Plain-text version of an answer, used by the tests and for copying */
  function toText(result) {
    if (result.type !== "answer") return result.intro;
    return result.blocks.map(function (b) {
      return b.state + "\n" + b.parts.map(function (p) {
        return p.label + ": " + p.text;
      }).join("\n") + "\nOfficial source: " + b.link + "\nLast checked: " + b.lastUpdated;
    }).join("\n\n");
  }

  var api = {
    parseCSV: parseCSV, buildIndex: buildIndex, findStates: findStates,
    findTopics: findTopics, answer: answer, toText: toText, TOPICS: TOPICS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MailBot = api;
})(this);
