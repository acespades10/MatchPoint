# Changelog

## [0.1.0] — 2026-11-03

First packaged release of the MatchPoint OJT matching prototype for fourth-year FEU students.

### Highlights

- PDF résumé intake with AI-assisted extraction of skills, experience, and course information.
- Four-phase matching: profile intake, six eligibility filters, deterministic industry relevance, and bilateral scoring with visible score components.
- Up to 20 ranked industry partners, with preference re-ranking for location, work setup, allowance, and active-partner selection.
- Configurable AI provider presets and custom connections supporting Chat Completions, Responses, Anthropic Messages, and Gemini formats.
- A sample-profile mode that runs locally without an AI key.
- A green-and-gold career workspace and a standalone interactive GitHub Pages guide using fictional examples.
- Branded README with the existing MatchPoint logo, setup instructions, configuration reference, and API documentation.

### Scope and limitations

- This is a prototype; authentication, persistent student accounts, application-document generation, and application tracking are not included.
- Real résumé parsing requires a compatible provider key and a text-based PDF of up to 10 MB. Résumé text is sent to the selected provider; saved connection keys are stored in browser local storage.
- Matching sessions live in server memory and are lost on restart or eviction. Re-ranking only uses the pool retained by the initial run.
- Company data needs verification with the institution or employer. Match scores are heuristics, not hiring probabilities or placement guarantees.
- The GitHub Pages guide is an illustrative walkthrough. The matching application requires a local Node.js server.
- Package metadata retains the original `ojt-scout` name at version `0.1.0`.

### Run this release

Use Node.js 22 or newer (recommended), then run `npm ci` and `npm start`. Open `http://localhost:3000` and choose **Explore with a demo résumé** for the no-key workflow. Run `npm test` for the automated suite.

[0.1.0]: https://github.com/acespades10/MatchPoint/releases/tag/v0.1.0
