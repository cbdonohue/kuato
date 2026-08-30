# Sleeper Draft Assistant

Password-gated live redraft pick recommendations for a Sleeper username. Look up your drafts, open a room, and get a top-5 board from FFC ADP vs pick number, your roster holes, who still needs the position before you pick, ADP tier cliffs, and same-team stacks.

Sleeper's API is read-only. This app cannot make picks. Auction drafts and dynasty leagues are unsupported.

![Live draft room with top-5 recommendations, roster holes, and remaining board](docs/live-room.png)

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `SITE_PASSWORD`. Open [http://localhost:3000](http://localhost:3000), sign in, then pick **Your drafts** (Sleeper username) or **Mock draft** (paste a Sleeper mock ID). `/debug` still redirects to the mock tab.

![Sign-in](docs/login.png)

![Username lookup with a pre-draft league](docs/drafts.png)

## Live room

Recommendations show FFC ADP (PPR / half-PPR / standard, or 2QB when the league is Superflex), bye week, injury, depth chart, and last-season nflverse stats. The top-5 score uses those same signals — last-season points, snap share, depth-chart role, ADP spread, and bye-week clusters — not just ADP vs pick. Reasons call out starter holes, demand from the next managers, the last player before an ADP gap, stacks, injury notes, production, snaps, and stacked byes. A news strip above the board shows a few recent stories for those recs. With an API key you can ask the coach, scout a remaining player, compare two names, review the roster, or get a news / sleepers / injury read.

The remaining board lists ADP, name, bye, and last-season points. Filter by position or search a name:

![Filtering the remaining board to a WR search](docs/live-room.gif)

## Data

- [Sleeper](https://docs.sleeper.com/) public API for drafts, picks, and players
- [Fantasy Football Calculator](https://fantasyfootballcalculator.com) ADP (free with attribution; cached about once a day)
- [nflverse](https://github.com/nflverse) last-season stats and snap share (CC-BY 4.0)
- [ESPN](https://www.espn.com) unofficial player news and [Google News](https://news.google.com) RSS for top-5 rec headlines (cached about 30 minutes)

Sleeper `search_rank` is the fallback when a player has no FFC ADP. Rankings are not FantasyPros.

## Optional AI coach

Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env.local`. Without a key, you still get the top-5 and reasons.

When a key is set, the live room adds:

- A 2–3 sentence pick note when you are on the clock or within two picks
- **Ask** — freeform questions about this board, with suggested prompts from your holes
- **Scout** — a fit / risk / take-now note for any remaining player
- **Compare** — head-to-head for two players on this roster
- **Review roster** — holes, bye clusters, and the next-pick plan
- **News briefing**, **Sleepers & fades**, and **Injury analysis** from the current recs, remaining ADP board, and Sleeper injury flags

## Tests

```bash
npm test
npm run test:coverage
```

Coverage must stay at 80% or higher (statements, branches, functions, and lines).
