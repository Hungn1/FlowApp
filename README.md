# ApplyFlow

Save job postings, tailor your resume and cover letter to each one, and track every application from Saved to Offer.
Single user, runs locally, all data in one SQLite file (`prisma/applyflow.db`).

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first `npm run dev` creates the database and loads sample data.

## Turn on AI features

1. Get an API key at https://console.anthropic.com
2. Open `.env.local` in this folder and set `ANTHROPIC_API_KEY=sk-ant-...`
3. Restart `npm run dev`

Without a key the app still works: resume parsing falls back to basic rules, and the rule-based features (entry-level check, match score, skill gaps) run offline.
The default model is `claude-sonnet-5-5`; change `ANTHROPIC_MODEL` in `.env.local` to use another.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app (creates/updates the database first) |
| `npm run seed` | Add any missing sample data (never overwrites yours) |
| `npm run db:reset` | Wipe the database and reload sample data |

## Your data

Profile page → **Export all** downloads everything as JSON. **Delete all** wipes the database.
Nothing leaves your computer except the text sent to the Anthropic API for AI features.
ApplyFlow never scrapes job sites or submits applications for you.
