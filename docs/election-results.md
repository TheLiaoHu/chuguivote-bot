# Election results and governor-party themes

## What is connected now

The AP news link supplied by the site owner appears in the footer and election panel:
https://apnews.com/live/midterm-election-2026

It opens coverage on AP's site. It is **not** an API or permission to scrape or republish AP results. There is currently no live results subscription or feed URL configured. The website explicitly says live totals are not connected. No demonstration vote totals or governor affiliations ship to readers.

## Connecting a live feed

1. Obtain an authorized results source (for AP, licensed Elections API access and its current documentation). Check publication rights and update limits.
2. Deploy a small server-side adapter or edge function that calls the provider. Store provider credentials in that service's secret settings, never in this repository, `config.js`, a URL query string, or browser JavaScript. GitHub Pages cannot keep secrets or run this adapter.
3. Transform the provider response into the schema below. Preserve the provider's update timestamps and race-call designations. Do not invent a winner from vote totals or from 100% reporting. Support special elections with distinct race IDs.
4. Expose only the normalized public JSON over HTTPS with CORS permission for the Pages origin. Use appropriate cache settings and comply with provider rate limits. Configure `RESULTS_URL` in `config.js` to that public endpoint and redeploy.
5. The browser checks the feed election date, source URL, state/office, unique identifiers, vote totals, timestamps, and call status before using it. It polls every 60 seconds while visible (minimum configurable interval 30 seconds), refreshes when returning to the tab, and times out after eight seconds. The source must supply actual fresh data; polling cannot make upstream data real time.

Example contract below is **schema illustration only**, with fictional names and counts. Do not publish it as actual results:

```json
{
  "election_date": "2026-11-03",
  "source": {"name": "Licensed source name", "url": "https://example.com/results"},
  "races": [{
    "id": "TX-governor-2026-general",
    "state": "TX",
    "office": "governor",
    "label": "General election",
    "status": "reporting",
    "updated_at": "2026-11-04T05:00:00Z",
    "reporting_percent": 42.5,
    "candidates": [
      {"id": "candidate-a", "name": "Example Candidate A", "party": "DEM", "votes": 123, "winner": false},
      {"id": "candidate-b", "name": "Example Candidate B", "party": "REP", "votes": 120, "winner": false}
    ]
  }]
}
```

`office` is `senate` or `governor`. `party` is `DEM`, `REP`, `IND`, or `OTHER` (normalize provider codes). `status` is `not_started`, `reporting`, `projected`, or `certified`. Only the last two may have a `winner: true`, with exactly one winner. `reporting_percent` can be null when unavailable. Keep the original candidate and race IDs stable. Times require a timezone. Updates more than five minutes in the future are rejected. All races belong to `RESULTS_ELECTION_DATE`; change that setting for a different election.

The UI labels estimates, uncalled leads, projected winners, certification, and stale timestamps separately. A failed refresh retains the last validated snapshot with a failure notice. Updates older than `RESULTS_STALE_MINUTES` (15 by default) show a stale warning. An absent race means no data supplied, not that there is no contest.

## Sitting governor data and site colors

Theme colors **never follow vote leads or the governor-elect**. The owner chose the party of the sitting governor. A successor should only replace a record after taking office.

`GOVERNORS_URL` defaults to the locally served `data/governors.json`. It currently contains an empty list because affiliations could not be verified against current sources. Add records only after checking the sitting officeholder and party against authoritative sources (for example https://www.nga.org/governors/ and state governor offices). Alternatively point it at a maintained public HTTPS JSON endpoint using this contract:

```json
{
  "governors": [{
    "state": "TX",
    "name": "Verified sitting governor name",
    "party": "REP",
    "source_name": "Authoritative directory",
    "source_url": "https://example.com/governor",
    "verified_at": "2026-11-04T12:00:00Z"
  }]
}
```

This example is a format illustration, not a verified officeholder record. Each state may occur once. D.C. has no governor and stays neutral. Missing, unverified, or older-than-30-day records stay neutral. Verification dates must reflect an actual editorial check; refreshing a file is not verification. `GOVERNORS_MAX_AGE_DAYS` controls this limit. Blue means Democratic, red Republican, purple Independent, green another party; the panel also names the party in text. Monochrome is the fallback. Flags retain their original colors and the chat remains high contrast. Comparisons use the last state mentioned, as with conversation memory.

## Validation

```sh
node scripts/check.js data/voting.csv
node tests/regressions.cjs
node --test tests/results.cjs
```

Browser checks should cover no connection, invalid/stale feeds, network failures, governor colors independent of race winners, state switching, follow-ups, mobile layouts, and keyboard interaction. Test fixtures must stay out of the public site artifact.
