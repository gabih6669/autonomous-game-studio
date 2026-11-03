# Autonomous Game Studio

A reusable workspace for developing browser games with Replit and GitHub.

## Project status

- GitHub repository: this repository (private).
- Replit workspace: https://replit.com/@haggergabriel/RedundantSlowFacts
- The Replit workspace and this GitHub repository are **not yet confirmed to be synchronized**. Connect the repository in Replit's Git/version-control interface, then verify a push appears here.
- This repository currently contains setup documentation and an automated CI workflow. The playable game source must be imported from Replit.

## Development loop

1. Describe a feature or game concept in ChatGPT.
2. Have the Replit agent implement it and run relevant checks.
3. Preview and playtest it in Replit.
4. Commit and push the code to GitHub.
5. GitHub Actions runs automated install, test and production build checks on pushes and pull requests, once the application source is present.
6. Review failures, fix, and repeat.

## Game starter expectations

A responsive 2D browser game with keyboard/touch controls, pause, restart, scoring, settings, modular gameplay logic, and testable components. Prefer locally generated or properly licensed assets.

## Connecting the Replit app

Open the Replit project above, open its Git/version-control panel, and follow its workflow to connect to `gabih6669/autonomous-game-studio`. If it prompts about importing an existing repository or conflicts because this repository now has a README and CI workflow, preserve the Replit project source and merge histories carefully rather than overwriting source files.

## CI scripts

The CI workflow installs dependencies and runs `npm test` (if defined) and `npm run build` (if defined). It will report when the repository does not yet have a `package.json`, rather than claiming that an empty repository was tested.

## Security

Do not commit credentials, API keys, secret tokens, or private configuration. Use project secrets/environment variables for sensitive values.
