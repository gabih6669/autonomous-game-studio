# THE LAST LIGHT

**A playable, fictional WWI-inspired top-down artillery-command strategy game.** Fight across seven contested sectors. You command the battery; your allied infantry acts independently. Winning is never guaranteed.

## Play

- **Online (after GitHub Pages is enabled):** `https://gabih6669.github.io/autonomous-game-studio/`
- **Offline double-click:** Download `PLAY_OFFLINE.html` from this repository (or build `dist/offline.html` with `npm run build`), then open it in your browser. This single file contains the complete game. No installation, Replit account, CDN, or external game assets are needed.
- **Development server:** `npm start` then open `http://localhost:4173`.

## Controls

| Action | Control |
|---|---|
| Mark target | Click/tap battlefield |
| Choose shell | Q (HE), W (Smoke), E (Airburst), R (Illumination) |
| Select gun | 1–4 |
| Fire | Space or **FIRE BATTERY** |
| Pause/resume | P or Pause button |
| Accelerate battle | Speed button cycles 1x / 2x / 3x |
| Respond to radio call | Select a request in the left panel, then fire |

The coordinates and effects are abstract fictional game mechanics, **not real-world artillery calculations**.

## Features

- Live top-down pixel-style trench battlefield, with procedurally drawn textures, infantry, craters, trenches, ruins, and smoke.
- Autonomous allied and enemy infantry, morale, variable combat strength, enemy counterfire, fluctuating frontline.
- Four shell types: high explosive, smoke, airburst, and illumination, each with distinct roles, ammunition and effects.
- Radio requests with deadlines and scoring; you can also choose your own targets.
- Multiple selectable guns, reloads, and ammunition logistics.
- Seven-sector campaign front map; results adjust territorial control and may shift the active sector.
- Five upgrade tracks: field guns, heavy shells, forward observers, veteran crews, supply train.
- After-action reports with performance metrics, allied initiative, and tactical feedback.
- Automatic/local save and resume; optional manual save and new campaign.
- Generated sound effects through the browser Audio API; mute button.
- Responsive interface and touch-targeting support.

## Development

No third-party runtime or npm packages are needed.

```
npm test
npm run build
npm start
```

The build creates `dist/` including a standalone `offline.html` for double-click play. Tests use Node's built-in test runner. GitHub Actions validates the game on push and pull request. A second workflow deploys the static build via **GitHub Pages** once Pages has been enabled in repository settings.

## GitHub Pages setup

1. Open **Settings → Pages** in the repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Actions → Publish browser game to GitHub Pages** to see deployment results.
4. If Pages isn't available for a **private repository** under your plan, either change repository visibility to public *after reviewing its contents* or use a plan that supports private-repo Pages. Do not expose private repository contents without intending to do so.

## Files

- `index.html` — complete accessible layout and HUD
- `style.css` — responsive war-room theme
- `src/sim.js` — pure rules for battle, AI, shells, requests, upgrades, campaign
- `src/main.js` — canvas pixel rendering, inputs, audio, persistence and UI
- `assets/crest.svg` — original pixel-style game insignia
- `PLAY_OFFLINE.html` — complete one-file playable edition (generated artifact)
- `tests/sim.test.js` — simulation/unit tests
- `tools/build.mjs` — zero-dependency production bundling
- `tools/serve.mjs` — optional local server

This project is not synchronized with any Replit project; GitHub is the canonical source of truth for this game. All fictional teams and locations are original to the game. Art is procedurally generated using canvas primitives and SVG.
