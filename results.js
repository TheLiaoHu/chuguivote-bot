/* Public, normalized election feed. No credentials belong in browser code. */
(function (root) {
  'use strict';
  var STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
  function https(url) { try { return new URL(url).protocol === 'https:'; } catch (_) { return false; } }
  function validate(feed, electionDate, now) {
    now = now == null ? Date.now() : now;
    if (!feed || feed.election_date !== electionDate || !feed.source || typeof feed.source.name !== 'string' || !feed.source.name.trim() || !https(feed.source.url) || !Array.isArray(feed.races)) throw Error('Results feed has an invalid source, election date or race list.');
    var ids = new Set();
    feed.races.forEach(function (r) {
      if (!r || typeof r.id !== 'string' || !r.id || ids.has(r.id) || STATES.indexOf(r.state) < 0 || ['senate', 'governor'].indexOf(r.office) < 0) throw Error('Invalid or duplicate race.');
      ids.add(r.id);
      if (['not_started', 'reporting', 'projected', 'certified'].indexOf(r.status) < 0 || !Array.isArray(r.candidates)) throw Error('Invalid race status or candidates.');
      var date = Date.parse(r.updated_at);
      if (!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(r.updated_at || '') || !Number.isFinite(date) || date > now + 300000) throw Error('Invalid or future results timestamp.');
      if (r.reporting_percent != null && (typeof r.reporting_percent !== 'number' || !Number.isFinite(r.reporting_percent) || r.reporting_percent < 0 || r.reporting_percent > 100)) throw Error('Invalid reporting percentage.');
      var candidates = new Set();
      r.candidates.forEach(function (c) {
        if (!c || typeof c.id !== 'string' || !c.id || candidates.has(c.id) || typeof c.name !== 'string' || !c.name.trim() || ['DEM', 'REP', 'IND', 'OTHER'].indexOf(c.party) < 0 || !Number.isSafeInteger(c.votes) || c.votes < 0 || (c.winner != null && typeof c.winner !== 'boolean')) throw Error('Invalid candidate or vote count.');
        candidates.add(c.id);
      });
      if (!Number.isSafeInteger(r.candidates.reduce(function (sum, c) { return sum + c.votes; }, 0))) throw Error('Vote total is too large.');
      var winners = r.candidates.filter(function (c) { return c.winner; });
      if (winners.length > 1 || ((r.status === 'projected' || r.status === 'certified') && winners.length !== 1) || ((r.status === 'reporting' || r.status === 'not_started') && winners.length)) throw Error('Winner and race status disagree.');
      if (r.status === 'not_started' && r.candidates.some(function (c) { return c.votes > 0; })) throw Error('Unstarted race contains votes.');
    });
    return feed;
  }
  function stale(race, now, minutes) { return (now == null ? Date.now() : now) - Date.parse(race.updated_at) > minutes * 60000; }
  function leader(race) {
    var sorted = race.candidates.slice().sort(function (a, b) { return b.votes - a.votes; });
    if (race.status === 'projected' || race.status === 'certified') return sorted.find(function (c) { return c.winner; }) || null;
    if (race.status === 'not_started' || !sorted.length || sorted[0].votes === 0 || (sorted[1] && sorted[0].votes === sorted[1].votes)) return null;
    return sorted[0];
  }
  function validateGovernors(feed, now) {
    now = now == null ? Date.now() : now;
    if (!feed || !Array.isArray(feed.governors)) throw Error('Invalid governor directory.');
    var seen = new Set();
    feed.governors.forEach(function (g) {
      if (!g || STATES.indexOf(g.state) < 0 || g.state === 'DC' || seen.has(g.state) || typeof g.name !== 'string' || !g.name.trim() || ['DEM', 'REP', 'IND', 'OTHER'].indexOf(g.party) < 0 || !https(g.source_url) || (typeof g.source_name !== 'string' || !g.source_name.trim())) throw Error('Invalid governor entry.');
      if (!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(g.verified_at || '') || !Number.isFinite(Date.parse(g.verified_at)) || Date.parse(g.verified_at) > now + 300000) throw Error('Invalid governor verification time.');
      seen.add(g.state);
    });
    return feed;
  }
  function governorTheme(governor, now, days) {
    if (!governor || (now == null ? Date.now() : now) - Date.parse(governor.verified_at) > days * 86400000) return 'neutral';
    return { DEM: 'democratic', REP: 'republican', IND: 'independent', OTHER: 'other' }[governor.party] || 'neutral';
  }
  function intent(q) {
    return /\b(senate|senator|governor|gubernatorial|results?|winning|winner|won|leading|race|races|political standing)\b/i.test(q);
  }
  function office(q) { var s = /\b(senate|senator)\b/i.test(q), g = /\b(governor|gubernatorial)\b/i.test(q); return s && !g ? 'senate' : g && !s ? 'governor' : 'all'; }
  var api = { validate: validate, stale: stale, leader: leader, validateGovernors: validateGovernors, governorTheme: governorTheme, intent: intent, office: office };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ElectionResults = api;
})(this);
