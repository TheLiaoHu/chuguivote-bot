/*
 * app.js — loads the spreadsheet and draws the conversation on the page.
 * The answering logic lives in bot.js; this file is just plumbing and display.
 */
(function () {
  "use strict";
  var CFG = window.BOT_CONFIG;
  var Bot = window.MailBot;
  var index = null, loadedAt = 0, memory = {}, loading = null;
  var queue = Promise.resolve();

  var log = document.getElementById("log");
  var form = document.getElementById("ask");
  var input = document.getElementById("q");
  var status = document.getElementById("status");
  var chips = document.getElementById("chips");

  /* ---- Loading the data: live Google Sheet first, backup copy second ---- */
  function fetchText(url) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    return fetch(url, { cache: "no-store", signal: controller.signal }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).finally(function () { clearTimeout(timer); });
  }

  function useRows(rows, label, warn) {
    var validation = window.MailBotChecks.checkData(rows);
    if (validation.errors.length) throw new Error(validation.errors.join(" "));
    index = Bot.buildIndex(rows);
    loadedAt = Date.now();
    status.textContent = label + " · " + rows.length + " rows · loaded " +
      new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (validation.warnings.length) status.textContent += " · " + validation.warnings.join(" ");
    status.className = "status" + (warn || validation.warnings.length ? " warn" : "");
  }

  function loadData() {
    if (loading) return loading;
    var live = CFG.SHEET_CSV_URL;
    var hasLive = CFG.USE_GOOGLE_SHEET !== false && live && /^https:\/\/docs\.google\.com\//.test(live);
    var first = hasLive
      ? fetchText(live).then(function (t) { useRows(Bot.parseCSV(t), "Reading your Google Sheet directly"); })
      : Promise.reject(new Error("No Google Sheet link in config.js"));
    loading = first.catch(function (err) {
      console.warn("Google Sheet unavailable, using backup:", err.message);
      return fetchText(CFG.BACKUP_CSV).then(function (t) {
        useRows(Bot.parseCSV(t), hasLive ? "Reading the backup copy (your Google Sheet couldn't be reached)" : "Reading the tested backup copy in GitHub", hasLive);
      });
    }).catch(function (err) {
      status.textContent = "Couldn't load the voting data. Refresh the page to try again. (" + err.message + ")";
      status.className = "status warn";
    }).finally(function () { loading = null; });
    return loading;
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
    node.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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

  // Use the last state in a comparison, matching the state remembered for follow-ups.
  var backdrop = document.getElementById("flag-backdrop");
  var stateContext = document.getElementById("state-context");
  var flagRequest = 0;
  function updateFlag(blocks) {
    if (!backdrop || !blocks.length) return;
    var state = blocks[blocks.length - 1];
    var code = String(state.stateId).toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || !index.byId[code]) return;
    var request = ++flagRequest;
    stateContext.textContent = blocks.length > 1
      ? blocks.map(function (b) { return b.state; }).join(" / ") + " · " + state.state + " flag"
      : state.state + " · " + code;
    // Preload before switching, and ignore late loads from earlier questions.
    var image = new Image();
    image.onload = function () {
      if (request !== flagRequest) return;
      backdrop.style.backgroundImage = 'url("' + image.src + '")';
      backdrop.dataset.state = code;
      backdrop.classList.add("is-visible");
    };
    image.onerror = function () {
      if (request !== flagRequest) return;
      backdrop.style.backgroundImage = "none";
      delete backdrop.dataset.state;
      backdrop.classList.remove("is-visible");
    };
    image.src = "assets/flags/" + code + ".svg";
  }

  var Elections = window.ElectionResults;
  var racePanel = document.getElementById("race-results");
  var raceStatus = document.getElementById("race-status");
  var raceCards = document.getElementById("race-cards");
  var partyContext = document.getElementById("party-context");
  var refreshResults = document.getElementById("refresh-results");
  var selectedState = null, selectedOffice = "all";
  var resultsFeed = null, governorFeed = null, resultsError = "", governorError = "";
  var resultsLoading = null, governorsLoading = null;
  var parties = { DEM: "Democratic", REP: "Republican", IND: "Independent", OTHER: "Other party" };
  var staleMinutes = Math.max(1, Number(CFG.RESULTS_STALE_MINUTES) || 15);
  var governorDays = Math.max(1, Number(CFG.GOVERNORS_MAX_AGE_DAYS) || 30);

  function publicURL(value) {
    var url = new URL(value, document.baseURI);
    if (url.username || url.password || (url.protocol !== "https:" && !(url.origin === location.origin && url.protocol === "http:"))) throw Error("A public HTTPS feed URL is required.");
    return url.href;
  }
  function sourceLink(parent, label, url) {
    var link = el("a", null, label);
    link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
    parent.appendChild(link);
  }
  function renderRaces() {
    if (!selectedState) return;
    racePanel.hidden = false;
    document.getElementById("race-heading").textContent = selectedState.state + " · " + (selectedOffice === "all" ? "Senate & governor" : selectedOffice === "senate" ? "U.S. Senate" : "Governor");
    var governor = governorFeed && governorFeed.governors.find(function (g) { return g.state === selectedState.stateId; });
    var theme = Elections.governorTheme(governor, Date.now(), governorDays);
    document.documentElement.dataset.political = theme;
    partyContext.replaceChildren();
    if (selectedState.stateId === "DC") {
      partyContext.textContent = "D.C. has no governor. Theme: neutral.";
    } else if (theme === "neutral") {
      partyContext.textContent = "Theme: neutral · Sitting governor’s party is " + (governor ? "awaiting re-verification." : "not verified.") + (governorError ? " Governor directory is unavailable." : "");
    } else {
      partyContext.appendChild(el("span", "party-dot", ""));
      partyContext.appendChild(document.createTextNode("Theme: " + parties[governor.party] + " · Sitting governor " + governor.name + ". Verified " + new Date(governor.verified_at).toLocaleString() + ". "));
      sourceLink(partyContext, governor.source_name, governor.source_url);
      if (governorError) partyContext.appendChild(document.createTextNode(" Directory refresh failed; showing the last verified record."));
    }
    var races = resultsFeed ? resultsFeed.races.filter(function (r) { return r.state === selectedState.stateId && (selectedOffice === "all" || r.office === selectedOffice); }) : [];
    raceCards.replaceChildren();
    if (!CFG.RESULTS_URL) {
      raceStatus.textContent = "Live vote totals are not connected. The AP link below opens news coverage; it is not a data feed.";
    } else if (resultsError) {
      raceStatus.textContent = "Results update failed. " + (resultsFeed ? "Showing the last received snapshot; check its timestamp." : "No verified results are available.");
    } else if (!resultsFeed) {
      raceStatus.textContent = "Loading election results…";
    } else {
      raceStatus.textContent = "Source: " + resultsFeed.source.name + " · Election: " + resultsFeed.election_date + ". Refreshes every " + Math.max(30, Number(CFG.RESULTS_REFRESH_SECONDS) || 60) + " seconds while this tab is visible. Vote leads are not race calls.";
    }
    if (resultsFeed) sourceLink(raceCards, "Results source: " + resultsFeed.source.name, resultsFeed.source.url);
    if (!races.length && resultsFeed) raceCards.appendChild(el("p", "status", "No matching results were supplied for this state. This does not establish whether a race is scheduled."));
    races.forEach(function (r) {
      var card = el("article", "race-card");
      card.appendChild(el("h3", null, (r.office === "senate" ? "U.S. Senate" : "Governor") + (r.label ? " · " + r.label : "")));
      var stale = Elections.stale(r, Date.now(), staleMinutes);
      var label = { not_started: "No votes reported", reporting: "Counting · Uncalled", projected: "Projected winner (source call)", certified: "Certified result (source designation)" }[r.status];
      card.appendChild(el("p", "race-meta", label + (stale ? " · STALE UPDATE" : "") + " · Updated " + new Date(r.updated_at).toLocaleString()));
      card.appendChild(el("p", "status", r.reporting_percent == null ? "Reporting percentage unavailable" : r.reporting_percent + "% reporting (source estimate)"));
      var total = r.candidates.reduce(function (sum, c) { return sum + c.votes; }, 0);
      var leading = Elections.leader(r);
      r.candidates.slice().sort(function (a, b) { return b.votes - a.votes; }).forEach(function (c) {
        var row = el("div", "candidate");
        row.appendChild(el("span", null, c.name + " · " + parties[c.party] + (c.winner ? " · " + (r.status === "certified" ? "Certified winner" : "Projected winner") : leading && leading.id === c.id ? " · Leading" : "")));
        row.appendChild(el("strong", null, c.votes.toLocaleString() + " votes · " + (total ? (100 * c.votes / total).toFixed(1) : "0.0") + "%"));
        card.appendChild(row);
      });
      raceCards.appendChild(card);
    });
    sourceLink(raceCards, "Read AP election coverage ↗", CFG.RESULTS_NEWS_URL);
    refreshResults.disabled = !!resultsLoading || !!governorsLoading;
  }
  function loadGovernors() {
    if (governorsLoading) return governorsLoading;
    governorsLoading = Promise.resolve().then(function () { return fetchText(publicURL(CFG.GOVERNORS_URL)); }).then(function (text) {
      governorFeed = Elections.validateGovernors(JSON.parse(text)); governorError = "";
    }).catch(function () { governorError = "unavailable"; }).finally(function () { governorsLoading = null; renderRaces(); });
    return governorsLoading;
  }
  function loadResults() {
    if (resultsLoading) return resultsLoading;
    if (!CFG.RESULTS_URL) { renderRaces(); return Promise.resolve(); }
    resultsLoading = Promise.resolve().then(function () { return fetchText(publicURL(CFG.RESULTS_URL)); }).then(function (text) {
      resultsFeed = Elections.validate(JSON.parse(text), CFG.RESULTS_ELECTION_DATE); resultsError = "";
    }).catch(function () { resultsError = "unavailable"; }).finally(function () { resultsLoading = null; renderRaces(); });
    renderRaces();
    return resultsLoading;
  }
  function selectResults(blocks, office) {
    selectedState = blocks[blocks.length - 1]; selectedOffice = office || "all";
    renderRaces();
    return Promise.all([loadGovernors(), loadResults()]);
  }
  refreshResults.addEventListener("click", function () { Promise.all([loadGovernors(), loadResults()]); });
  setInterval(function () {
    if (!document.hidden && selectedState) Promise.all([loadGovernors(), loadResults()]);
  }, Math.max(30, Number(CFG.RESULTS_REFRESH_SECONDS) || 60) * 1000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && selectedState) Promise.all([loadGovernors(), loadResults()]);
  });

  function reply(result) {
    var wrap = el("div", "msg bot");
    if (result.type !== "answer") {
      wrap.appendChild(el("p", null, result.intro));
    } else {
      updateFlag(result.blocks);
      selectResults(result.blocks, "all");
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
    queue = queue.then(function () { return freshData(); }).then(function () {
      if (!index) {
        reply({ type: "error", intro: "I couldn't load the voting data. Please try your question again shortly." });
        return;
      }
      if (Elections.intent(q)) {
        var states = Bot.findStates(q, index).slice(0, 3);
        if (!states.length && memory.lastState) states = [memory.lastState];
        if (!states.length) { reply({ type: "need_state", intro: "Which state’s Senate or governor results would you like?" }); return; }
        memory.lastState = states[states.length - 1];
        var blocks = states.map(function (id) { return { stateId: id, state: index.byId[id].state_name }; });
        updateFlag(blocks);
        reply({ type: "results", intro: "Showing " + blocks[blocks.length - 1].state + " results in the election panel. Colors reflect the sitting governor’s party, when verified—not race leads or a projected successor." });
        return selectResults(blocks, Elections.office(q)).then(function () {
          racePanel.scrollIntoView({ block: "nearest", behavior: "auto" });
        });
      }
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
    reply({ type: "help", intro: "Hi! Ask me how, when or where to vote by mail in any state, plus D.C. I answer only from our newsroom's fact-checked spreadsheet, and ballot answers link to the state's official site. You can also ask for Senate and governor race results." });
  });
})();
