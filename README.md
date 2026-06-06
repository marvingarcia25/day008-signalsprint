# day8_SignalSprint — Daily Memory Sprint

A new sequence to memorise every day. Watch the tiles, repeat the pattern, climb the board.

A Simon-style memory game with a twist: the daily challenge is deterministic. Everyone gets the same tile sequence on a given date — it's seeded from the date with SHA-256 — so the day's scores are actually comparable.

## What it does

- Daily, date-seeded tile sequence (identical for everyone that day)
- Levels that lengthen the pattern; score from level, accuracy, and mistakes
- Top-10 leaderboard persisted to a JSON file

## Stack

- ASP.NET Core (minimal API, .NET 8)
- React + Vite (ClientApp builds into `wwwroot`)
- JSON-file score storage

## Running it

```
cd ClientApp && npm install && npm run build && cd ..
dotnet run
```

---

Day 8 of building a small thing every day.
