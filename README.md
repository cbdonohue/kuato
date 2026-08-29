# Sleeper Draft Assistant

Live redraft pick recommendations for a Sleeper username. Look up your drafts, open a room, and get a top-5 board from value (Sleeper `search_rank` vs pick number), roster need, scarcity, and how soon you pick again.

Sleeper's API is read-only. This app cannot make picks.

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `SITE_PASSWORD`. Open [http://localhost:3000](http://localhost:3000), sign in, enter a Sleeper username, and open a `drafting` or `pre_draft` league.

To test a Sleeper mock draft, open [http://localhost:3000/debug](http://localhost:3000/debug), paste draft IDs, and open the live room.

## Optional AI coach

Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env.local`. When you are on the clock or within two picks, the live room adds a 2–3 sentence note. Without a key, you still get the score breakdown.

## Tests

```bash
npm test
```
