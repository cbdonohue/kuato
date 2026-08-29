# Sleeper Draft Assistant

Live redraft pick recommendations for a Sleeper username. Look up your drafts, open a room, and get a top-5 board from value (Sleeper `search_rank` vs pick number), roster need, scarcity, and how soon you pick again.

Sleeper's API is read-only. This app cannot make picks.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a Sleeper username, and open a `drafting` or `pre_draft` league.

## Optional AI coach

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`. When you are on the clock or within two picks, the live room adds a 2–3 sentence note. Without a key, you still get the score breakdown.

## Tests

```bash
npm test
```
