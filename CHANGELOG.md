# Changelog

All notable changes to SATistics are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com).

## Unreleased

### Added
- Open-source setup: README, contributing guide, code of conduct, security policy, issue and pull request templates, CI, and `.env.example` files.
- The SATistics Engineering Handbook in `docs/handbook/`.
- Developer page at `/developer`, sitemap and robots file, and author metadata.
- AI-written questions follow each exam's skill blueprint, use real College Board questions of the same skill and difficulty as models, explain every wrong option, and are dropped if they break the skill's format rules or copy an example. Options are ordered like the real test.
- Answer keys of AI-written and web-extracted questions are checked before use: math answers against their stated value, and every key by blind re-solving (`VERIFIER_MODEL`).
- Claude through the Anthropic API (`ANTHROPIC_API_KEY`): Claude Opus 5.5 writes questions and Claude Sonnet 5.5 checks their keys. OpenRouter still works when no Anthropic key is set.
- Every game ends with a full answer review: each question with the correct answer, a step-by-step solution, and why the chosen wrong answer is wrong. Whack-a-Mole and Carnival now have the review too, and past games can be reviewed from Statistics (needs `add_review_and_pool.sql`).
- Math in AI-written questions and explanations renders as formatted math (fractions, roots, exponents) through MathML.
- Checked AI-written questions are kept in a shared pool and served to students who haven't seen them, so each is written once. The answer check skips solves that can't change its decision.

- Privacy Policy, Terms and Conditions and Credits pages, linked with the contact address and a trademark notice from every page footer. Signup asks people to confirm they are 13 or older and agree to the terms, and records it on the account.
- Download my data and Delete my account on the Profile page (`GET /api/profile/export`, `DELETE /api/profile`).

### Security
- The API now verifies every sign-in token with Supabase. It used to read tokens without checking their signature, so a forged token could act as any user.
- Sign-in, sign-up and session refresh run on separate Supabase clients. Signing in on the shared client switched all later database queries to that user's token.

### Changed
- Red Light, Green Light always starts with 5 lives.
- Sessions renew themselves: login keeps a refresh token, the app refreshes shortly before the access token expires or after a 401, and tabs share one session. If a session can't be renewed, the app signs out and returns to sign-in with a notice instead of showing empty pages.
- The web question finder identifies itself as SATisticsBot, obeys robots.txt, and links each question's source page.
- Saved game reviews keep no College Board question text; official questions show the answers and link to the question bank.
- The materials page says uploads are processed by an AI provider.

## 2026-10-02

### Added
- Full redesign in a neo-brutalist and glass style: landing page, login, a three-step signup that creates a profile, dashboard, profile page, games catalogue with custom cover art, and game setup screen.
- Profiles with exam, target score, test date and daily goal (`/api/profile`, `profiles` table).
- Learn: a lesson for every SAT and GRE topic with key ideas, a worked example, traps and a quick check.
- Lesson videos per topic (`/api/learn/videos`) from the YouTube Data API, Serper or DuckDuckGo.
- GRE support alongside the SAT, with four courses organized by the official domains.
- Mock exams, uploading your own material, hints, a pause menu, a calculator and an arcade frame for the games.

### Fixed
- Backend deployment on Vercel, CORS for the production domain, and the Supabase service-role key name.

## 2025-11

### Added
- First version built at NYU Hacks: arcade games with SAT questions, accounts, score tracking and an AI agent that adapts questions to weak topics.
