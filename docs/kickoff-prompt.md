# SensorMind: Claude Code Kickoff Prompt

Paste everything below the line into Claude Code at the root of an empty repo.

---

You are helping me build **SensorMind**, an open-source (MIT) Industrial IoT Sensor Intelligence Platform. It is a portfolio project: a 3D plant view where clicking an asset shows its live sensor tags, alongside a RAG chat that answers questions about plant state, recent readings and equipment manuals. I'm a senior full-stack dev (.NET Core, React, Azure/AWS, IIoT background), so skip basics and make senior-level decisions. Keep the code clean and readable, because recruiters will read this repo.

## Stack (fixed)
- **Frontend:** React + TypeScript + Vite, Three.js (via @react-three/fiber and drei), Recharts, Tailwind CSS. Deployed to GitHub Pages.
- **Backend:** .NET 8 Web API (minimal APIs or controllers, your call, stay consistent). Deployed to Render.com free tier (Dockerfile).
- **Vector store:** Qdrant Cloud free tier (use the official .NET client). Provide a docker-compose with local Qdrant for dev.
- **LLM + embeddings:** OpenRouter (OpenAI-compatible API). Model names and API key come from config/env, never hardcoded.
- Keep hosting provider-agnostic where cheap to do so (config via env vars, Dockerized API), so moving to AWS later is easy.

## Repo layout
```
/frontend
/backend/SensorMind.Api
/backend/SensorMind.Tests
/data/plant.sample.json
/data/manuals/                  (public Grundfos and Atlas Copco PDFs, added by me)
/docs
docker-compose.yml
README.md
```

## Domain model
Equipment config is an importable JSON file with the hierarchy **Site → Floor → Group → Equipment → Tags**.
- Each Equipment has: id, name, type (pump, compressor, motor...), manufacturer, model, 3D position/size/shape hint, and a list of tags.
- Each Tag has: id, name, unit, nominal min/max, alarm thresholds.
- Support multiple floors. Validate the JSON on import and return clear errors.
- Ship `plant.sample.json` with 1 site, 2 floors, ~10 pieces of equipment (Grundfos pumps, Atlas Copco compressors, motors, a tank) and 3 to 5 tags each.

## UI layout and behavior
Three panels:
1. **Left:** collapsible asset tree (Site/Floor/Group/Equipment). Selecting a node highlights it in 3D.
2. **Center:** Three.js 3D floor view. A floor switcher, orbit controls, equipment as simple primitives colored by status (normal/warning/alarm). Clicking equipment selects it. Hovering shows a label.
3. **Right:** top = sensor panel for the selected asset (tags, live values, units, status, small sparkline); bottom = RAG chat.

Chat: streaming responses (SSE), markdown rendering, the selected asset is passed as context, and trend questions ("show temperature on pump 2 for the last hour") render an **inline Recharts graph** in the message.

## Simulated sensor data
- A backend background service generates realistic values per tag (smooth random walk around nominal, occasional drift/spikes, rare alarm events). Keep the generator deterministic-seedable for tests.
- Store a rolling window in memory (for example the last 24h at 5s resolution) behind an interface so it can be swapped for a real store.
- Expose current values via SSE/WebSocket and history via a REST endpoint.

## RAG pipeline
- On startup, ingest the PDFs in `/data/manuals`: extract text, chunk (~500 to 800 tokens, with overlap, keeping page numbers and source file as metadata), embed through OpenRouter, upsert to Qdrant. Skip ingestion if the collection already has the same document hash.
- At query time: embed the question, retrieve top-k chunks from Qdrant (optionally filtered by the selected equipment's manufacturer/model), then build the prompt from (a) retrieved chunks, (b) current readings and recent trend summary for the relevant assets, (c) the question.
- The answer must cite sources (file + page) when it uses manual content, and say so when it is working only from sensor data or has no relevant context. No guessing.
- Handle trend/chart questions by letting the model call a small tool/function that returns time-series for a tag, which the frontend renders as a chart.

## Limits and safety
- Rate limit: **10 free chat queries per IP per day**. Optional bring-your-own OpenRouter key sent in a header for unlimited use (never log or store it).
- CORS locked to the frontend origin. No secrets in the repo; provide `.env.example` files.

## Theme: warm brownish white
Light, warm, calm. Not stark white, not dark mode. Define these as CSS variables / Tailwind theme tokens and use them everywhere, including the Three.js scene (scene background, floor, lighting tone):
- `--bg`: #FAF6F0 (warm off-white page background)
- `--surface`: #F3ECE2 (panels, cards)
- `--surface-raised`: #FFFFFF at ~70% over bg, or #FCF9F4
- `--border`: #E2D6C6
- `--text`: #3B2F28 (espresso brown)
- `--text-muted`: #7A6A5D
- `--accent`: #A0714F (caramel brown, primary actions, selection)
- `--accent-hover`: #8A5E3F
- Status colors, kept readable on the warm background: normal #6B8F5E (sage), warning #D39B3A (amber), alarm #B5473A (brick red)
Typography: a clean humanist sans for UI (Inter or similar) and a monospace for tag values. Rounded corners (8 to 12px), soft shadows, generous spacing. 3D equipment should use muted earthy tones with status shown by an emissive tint or outline, not garish colors. Ensure text contrast meets WCAG AA.

## How to work
Work in phases. **Do Phase 1 now, then stop and summarize** before moving on.
1. **Phase 1, skeleton (no RAG yet):** repo scaffold, theme tokens, JSON config loader + validation, asset tree, 3D floor view with selection, simulated sensor stream, sensor panel with live values. Everything runs locally with one command (`docker compose up` or documented npm/dotnet commands).
2. **Phase 2, RAG:** PDF ingestion, Qdrant, OpenRouter embeddings, streaming chat with citations.
3. **Phase 3, intelligence:** selected-asset context, sensor data injected into prompts, chart tool-calling and inline Recharts.
4. **Phase 4, hardening:** rate limiting, BYO key, tests, CI (GitHub Actions), deploy to GitHub Pages + Render, README with architecture diagram and screenshots.

Ground rules: write unit tests for the config validator, the sensor generator, the chunker and the rate limiter. Ask me before adding any paid service or major dependency. Commit in small logical commits with clear messages. If something in this spec is ambiguous, pick the simplest sensible option, note it in `/docs/decisions.md`, and keep going.