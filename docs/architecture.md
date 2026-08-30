# Architecture

Kuato is a Next.js App Router app. Almost every request is gated by a shared password. After sign-in, the live room is a client that polls a JSON snapshot of one Sleeper draft.

## Request path

```
Browser
  → src/proxy.ts          session cookie, or 401 / redirect to /login
  → src/app/*             pages
  → /api/drafts/:id/live  buildLiveState()
  → /api/drafts/:id/ai    optional LLM tools
```

`src/proxy.ts` is the Next.js 16 [proxy](https://nextjs.org/docs) file (the old middleware convention). Unsigned visitors hit `/login`. `/api/*` returns JSON 401 instead of a redirect. Sessions are HMAC cookies derived from `SITE_PASSWORD` (`src/lib/auth.ts`); there is no user database.

## Live snapshot

`GET /api/drafts/:draftId/live?username=` calls `buildLiveState` in `src/lib/live.ts`:

1. Resolve the Sleeper user, draft, league, picks, traded picks, and player universe (`src/lib/sleeper.ts`).
2. Reject auction drafts and dynasty / taxi leagues.
3. Load Fantasy Football Calculator ADP for the league's scoring and team count (`src/lib/ffc.ts`, ~1 day cache).
4. Load last-season nflverse stats and snap share (`src/lib/nflverse.ts`, ~1 day cache).
5. Map ADP, bye, injury, depth, and production onto each remaining player (`src/lib/enrich.ts`).
6. Score the board (`src/lib/recommend.ts`) and attach a handful of news headlines (`src/lib/news.ts`, ~30 minute cache).
7. If an LLM key is present and you are on the clock or within two picks, generate a short coach note (`src/lib/coach.ts`).

The client (`src/components/live-room.tsx`) re-fetches that snapshot on an interval so the top-5 and remaining board track the room without writing back to Sleeper.

## Scoring

`recommend()` keeps the top five remaining players. The total is a weighted sum of:

- ADP versus current pick (shrunk when FFC spread is wide)
- starter-hole need (Superflex treats QB as a skill seat)
- how many of the next managers still need the position
- last player before an ADP gap
- same-team stack with a player already rostered
- last-season points, snap share, and depth-chart role
- penalty for stacking byes with current starters
- injury penalty from Sleeper status

Kickers and team defenses are held until the last two rounds. Players ranked worse than 400 (and inactive non-DST) are dropped. Reasons shown in the UI are derived from those same terms, not a second model.

## AI tools

`POST /api/drafts/:draftId/ai?username=` is a no-op 503 until `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set. The body is `{ action, question?, playerId?, playerIds? }` with actions `ask`, `scout`, `compare`, `review`, `briefing`, `board`, and `injury`. Prompts are built in `src/lib/ai.ts` from the same live snapshot; `src/lib/llm.ts` calls OpenAI first when both keys exist. `AI_MODEL` overrides the default id (`gpt-4o-mini` or `claude-3-5-haiku-latest`).

## Caching

`src/lib/cache.ts` keeps JSON under `.cache/` (gitignored). ADP, Sleeper players, and nflverse refresh about daily. News refreshes about every 30 minutes. Writes are best-effort so a read-only filesystem still serves a previous snapshot.

## UI map

| Route | Component |
| --- | --- |
| `/login` | Shared password form |
| `/` | Username lookup |
| `/?tab=mock` | Mock draft ID |
| `/draft/[draftId]?username=` | Live room |
| `/debug` | Redirect to the mock tab |

## Tests

Vitest + Testing Library cover helpers, API routes, and components. Coverage include is `src/**/*.{ts,tsx}` minus tests, `types.ts`, and the root layout. Thresholds are 80% across statements, branches, functions, and lines (`vitest.config.mts`).
