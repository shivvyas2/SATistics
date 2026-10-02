# SATistics frontend

The Next.js 14 app: landing page, accounts, dashboard, Learn, games, mock exams, materials and profile.

```sh
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, defaults to http://localhost:8000
npm install
npm run dev                  # http://localhost:3000
```

Before you push: `npm run lint`, `npx tsc --noEmit` and `npm run build`.

| Folder | What lives there |
| --- | --- |
| `app/` | Routes (App Router). `middleware.ts` protects the signed-in pages. |
| `components/` | UI: `brand/`, `arcade/`, `exam/`, `learn/`, `profile/`, `auth/`, and one container per game |
| `games/` | Game engines, one folder per game |
| `lib/` | API client, exams and courses, lessons, question bank, sessions, site metadata |
| `public/` | 3D models, textures and audio |

How it all works is in the [engineering handbook](../docs/handbook/index.html): chapter 4 for the design system, chapters 8 and 9 for games, chapter 10 for Learn.
