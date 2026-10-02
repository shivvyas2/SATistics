# SATistics backend

The FastAPI app: auth, profiles, the question engine, lesson videos, materials, scores and stats, on Supabase.

```sh
cp .env.example .env          # Supabase values are required; AI and video keys are optional
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
curl http://localhost:8000/api/health/
```

Interactive API docs run at http://localhost:8000/docs.

| Path | What lives there |
| --- | --- |
| `src/main.py` | App, CORS and router registration |
| `src/api/` | One router per area: auth, profile, questions, learn, games, stats, materials, health |
| `src/services/` | Question agent and sources, videos, material parsing, auth, scores |
| `src/models/schemas.py` | Pydantic request and response models |
| `database/reset.sql`, `database/add_materials.sql` | Run both, in that order, on a new Supabase project. `reset.sql` drops tables and users, so never on production |
| `api/index.py`, `vercel.json` | Vercel entry point |

See the [engineering handbook](../docs/handbook/index.html): chapter 3 for setup and every environment variable, chapter 7 for the question engine, chapters 13 and 14 for the data model and API.
