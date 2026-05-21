# Architecture

Long-Check is intentionally small for a hackathon MVP.

```text
LINE User
→ LINE Official Account
→ Webhook to Express backend
→ analyzeRisk(userText)
→ Local Qwen3 4B LLM or mock analyzer
→ LINE reply
```

## Components

- `src/index.js`: Express server, health route, and LINE webhook route.
- `src/line/lineWebhook.js`: receives LINE events and passes text messages to the analyzer.
- `src/line/lineClient.js`: sends LINE replies or logs mock replies locally.
- `workspaces/sister-risk-analyzer/riskAnalyzer.js`: single analyzer interface used by the backend.
- `workspaces/sister-risk-analyzer/retrieval.js`: simple keyword retrieval over `knowledgeBase.json`.
- `workspaces/sister-risk-analyzer/rules.json`: deterministic risk flags and scoring.
- `workspaces/sister-risk-analyzer/localQwenClient.js`: local Ollama client for `qwen3:4b`.

## MVP Choice

The backend and analyzer communicate through one simple function:

```js
analyzeRisk(userText)
```

This lets the LINE integration and LLM analyzer workstreams move in parallel.

## Local LLM Mode

When `USE_MOCK_LLM=false`, the analyzer calls Ollama at `OLLAMA_BASE_URL` using model `OLLAMA_MODEL`, defaulting to `qwen3:4b`.

The deterministic rule engine still runs first. Its score, matched flags, and retrieved knowledge-base notes are sent to the model so Qwen can focus on writing a natural Thai LINE reply instead of inventing the risk level.
