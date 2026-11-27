# Working with RAY PHOTO source

- The current native editor source is `source/editor/`. Its manifest assembles the JS parts and CSS into `dist/darkroom/index.html`; edit the source parts/template rather than the generated inline block.
- Existing independent feature engines/adapters remain editable at the paths listed in `source/module-map.json` (mostly `dist/darkroom/`). The root `dist/` also contains actual static source and bundled model/font/media assets. `dist/client`, `dist/server`, and `dist/.openai` are generated hosting output.
- Run `npm run source:build` after changing native source, then `npm run source:check`. Use the relevant tests and `npm test` for shared runtime changes. Existing classic-script globals and initialization order are part of the compatibility contract.
- `source/buong-toi-original.html`, `source/rolls.literal.js`, and `source/engine-sha256.json` are historical reference inputs, not the current app entry point.
- The independent local workflow is `npm ci` followed by `npm run dev:local`. `npm run build:web` produces a clean `build/web` for a different hosting provider. The existing `npm run build` retains the Sites deployment workflow.
- Source handoff instructions are in `docs/SOURCE-HANDOFF.md`. Keep exports versioned; package with `scripts/package-source.mjs` and verify its manifest. Stage new files before exporting from Git. Keep credentials, signing keys, local databases, scratch photos, dependencies and generated build copies out of source archives.
