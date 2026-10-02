# Security

SATistics stores accounts, profiles and study history. If you find a vulnerability, please report it privately.

## Reporting

Use GitHub's private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. Do not open a public issue for security problems.

Include what you found, how to reproduce it, and what data or accounts it could affect. You will get an acknowledgement within a few days, and a fix or a plan within two weeks for anything that exposes user data.

## What counts

- Any way to read or change another user's profile, sessions, stats or uploaded material through the API.
- Any route under `/api/` that accepts a request without a valid token when it should not, or that trusts a user id sent by the client.
- Weaknesses in how the backend verifies Supabase access tokens.
- The Supabase service-role key, the OpenRouter key or a search API key reaching the browser, a build artifact, a log or the repository.
- Stored cross-site scripting through question, passage or uploaded-material HTML.
- Prompt injection through uploaded material that makes the model leak another user's data.

## Out of scope

- Rate limiting and cost controls on your own self-hosted deployment.
- Findings in third-party services (Supabase, Vercel, OpenRouter, Google, Serper) that are not caused by this code.
- The Supabase project URL and anon key. They are designed to be public.

## Supported versions

Only the latest code on `main` receives security fixes.
