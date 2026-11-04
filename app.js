/*
 * app.js — loads the spreadsheet and draws the conversation on the page.
 * The answering logic lives in bot.js; this file is just plumbing and display.
 */
(function () {
  "use strict";
  var CFG = window.BOT_CONFIG;
  var Bot = window.MailBot;
  var index = null, loadedAt = 0, memory = {};

  var log = document.getElementById("log");
  var form = document.getElementById("ask");
  var input = document.getElementById("q");
  var status = document.getElementById("status");
  var chips = document.getElementById("chips");

  /* ---- Loading the data: live Google Sheet first, backup copy second ---- */
  function fetchText(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    });
  }

  function useRows(rows, label, warn) {
    if (!rows.length || !("state_id" in rows[0])) throw new Error("No state_id column");
    index = Bot.buildIndex(rows);
    loadedAt = Date.now();
    status.textContent = label + " · " + rows.length + " rows · loaded " +
      new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    status.className = "status" + (warn ? " warn" : "");
  }

  function loadData() {
    var live = CFG.SHEET_CSV_URL;
    var hasLive = CFG.USE_GOOGLE_SHEET !== false && live && /^https:\/\/docs\.google\.com\//.test(live);
    var first = hasLive
      ? fetchText(live).then(function (t) { useRows(Bot.parseCSV(t), "Reading your Google Sheet directly"); })
      : Promise.reject(new Error("No Google Sheet link in config.js"));
    return first.catch(function (err) {
      console.warn("Google Sheet unavailable, using backup:", err.message);
      return fetchText(CFG.BACKUP_CSV).then(function (t) {
        useRows(Bot.parseCSV(t), hasLive ? "Reading the backup copy (your Google Sheet couldn't be reached)" : "Reading the tested backup copy in GitHub", hasLive);
      });
    }).catch(function (err) {
      status.textContent = "Couldn't load the voting data. Refresh the page to try again. (" + err.message + ")";
      status.className = "status warn";
    });
  }

  function freshData() {
    var stale = Date.now() - loadedAt > CFG.REFRESH_MINUTES * 60000;
    return (!index || stale) ? loadData() : Promise.resolve();
  }

  /* ---- Drawing messages. Sheet text is always inserted as text, never as HTML. ---- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function add(node) {
    log.appendChild(node);
    node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function formatDate(iso) {
    var d = new Date(iso + "T12:00:00");
    if (isNaN(d)) return { line: iso, day: "" };
    return {
      line: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    };
  }

  function stateCard(b) {
    var card = el("article", "state-card");
    card.appendChild(el("h2", null, b.state));

    var pm = el("div", "postmark");
    pm.setAttribute("aria-hidden", "true");
    pm.appendChild(el("span", null, "Checked"));
    pm.appendChild(el("b", null, formatDate(b.lastUpdated).day));
    card.appendChild(pm);

    var dl = el("dl");
    b.parts.forEach(function (p) {
      var row = el("div");
      row.appendChild(el("dt", null, p.label));
      row.appendChild(el("dd", null, p.text));
      dl.appendChild(row);
    });
    card.appendChild(dl);

    var foot = el("div", "foot");
    if (/^https:\/\//.test(b.link)) {
      var a = el("a", null, "Official " + b.state + " election site");
      a.href = b.link; a.target = "_blank"; a.rel = "noopener";
      foot.appendChild(a);
    }
    foot.appendChild(el("span", null, "Last checked by our reporters: " + formatDate(b.lastUpdated).line));
    card.appendChild(foot);
    return card;
  }

  function reply(result) {
    var wrap = el("div", "msg bot");
    if (result.type !== "answer") {
      wrap.appendChild(el("p", null, result.intro));
    } else {
      if (result.usedMemory) wrap.appendChild(el("p", null, "Still talking about " + result.blocks[0].state + ":"));
      result.blocks.forEach(function (b) { wrap.appendChild(stateCard(b)); });
    }
    add(wrap);
  }

  function ask(q) {
    q = q.trim();
    if (!q) return;
    add(el("div", "msg you", q));
    input.value = "";
    freshData().then(function () {
      if (!index) return;
      reply(Bot.answer(q, index, memory));
    });
  }

  /* ---- Wiring ---- */
  document.querySelectorAll("[data-newsroom]").forEach(function (n) { n.textContent = CFG.NEWSROOM; });
  document.querySelectorAll("[data-election]").forEach(function (n) { n.textContent = CFG.ELECTION; });
  CFG.SUGGESTIONS.forEach(function (s) {
    var b = el("button", null, s);
    b.type = "button";
    b.addEventListener("click", function () { ask(s); });
    chips.appendChild(b);
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });

  loadData().then(function () {
    reply({ type: "help", intro: "Hi! Ask me how, when or where to vote by mail in any state, plus D.C. I answer only from our newsroom's fact-checked spreadsheet, and every answer links to the state's official site." });
  });
})();
