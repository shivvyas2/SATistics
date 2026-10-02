# Changelog

All notable changes to SATistics are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com).

## Unreleased

### Added
- Open-source setup: README, contributing guide, code of conduct, security policy, issue and pull request templates, CI, and `.env.example` files.
- The SATistics Engineering Handbook in `docs/handbook/`.
- Developer page at `/developer`, sitemap and robots file, and author metadata.

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
