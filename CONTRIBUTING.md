# Contributing to SATistics

Thanks for being here. SATistics is a study app first and a game second: every change should make practice either more effective or more fun, ideally both. The codebase is split so you can work on one area (a game, the question engine, lessons, the dashboard) without learning the rest.

## Before you start

- **Open an issue for anything bigger than a fix.** Say what you want to change and why. Agreeing on the idea first is much cheaper than reworking a finished pull request. Small fixes, typos and docs can go straight to a pull request.
- **Read the handbook chapter for your area.** Open `docs/handbook/index.html` in a browser. The README has a table mapping each area to its chapter, and every feature chapter ends with the files to read first.
- **Set up locally** as described in the README and handbook chapter 3. You need a free Supabase project for accounts and saving. The AI and video keys are optional: without them, SAT questions still come from the College Board bank, GRE questions from the offline bank, and lesson videos from DuckDuckGo.

## Ground rules

**One branch per change.** Branch from `main`, open a pull request, and let CI run. Pushing to `main` deploys to production, so nobody commits to it directly.

**Small, focused commits** with an imperative subject that says what changed for the user: `Add a hint button to Pac-Man`, not `updated files`. A prefix such as `fix(learn):` or `feat(games):` is welcome. Do not add AI co-author trailers.

**Questions must match the real exams.** SAT and GRE content follows the official domains in `frontend/lib/courses.ts`. A new question type, topic or exam section starts as an issue.

**Every game uses the shared contract.** Questions come in through `frontend/lib/api/questions.ts`, answers and analytics go out through `apiClient.saveScore`, and the in-game question UI comes from `frontend/components/exam/`. A game that invents its own question pipeline is hard to maintain. Handbook chapters 8 and 9 describe the contract and the steps for adding a game.

**Keys stay on the server.** The Supabase service-role key, the OpenRouter key and the search keys are read only by the backend. The only variable the frontend reads is `NEXT_PUBLIC_API_URL`. If your change needs a secret in the browser, stop and open an issue.

**Secrets never enter the repo.** Not in code, docs, test fixtures or screenshots. `.env` and `.env.local` are gitignored. Document new variables in `backend/.env.example` or `frontend/.env.example` with a placeholder value.

**Schema changes are SQL files.** Add a new file under `backend/database/` and update `reset.sql` so a fresh project gets the full schema. Every new table needs Row Level Security enabled and policies, even though the backend uses the service-role key.

**Follow the design system.** Use the tokens in `frontend/tailwind.config.js` and the component classes in `frontend/app/globals.css` (`.btn`, `.brutal`, `.glass`, `.field`, `.chip`). Copy is sentence case with plain verbs and no emoji. Handbook chapter 4 covers the rules.

## Checks to run before you push

There is no automated test suite yet, and adding one is a great first contribution. Until then, run what CI runs:

```sh
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

For backend changes, start the server and confirm it boots and serves your route:

```sh
cd backend
uvicorn src.main:app --reload --port 8000
curl http://localhost:8000/api/health/
```

Then click through the screens your change touches, on a desktop and a phone-width window.

## Pull requests

- One change per pull request. A refactor and a feature are two pull requests.
- Fill in the template: what changed, why, and how you verified it. Add screenshots or a short recording for anything visual.
- Add a line to `CHANGELOG.md` under "Unreleased" if a user would notice the change.
- If behavior changed, update the handbook chapter in `docs/handbook/src/chapters/` and rebuild with `docs/handbook/make-book.sh` (see `docs/handbook/src/WRITING.md`).

## Good first contributions

- Add or improve a lesson in `frontend/lib/lessons.ts`.
- Add questions to the offline bank in `frontend/lib/questionBank.ts`.
- Write tests for pure functions such as `frontend/lib/exam.ts`, `frontend/lib/sessions.ts` or `backend/src/services/videos.py`.
- Improve accessibility: keyboard play, focus states, screen-reader labels in game overlays.
- Fix an issue labelled `good first issue`.

## Code of conduct

Be kind and be direct. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
