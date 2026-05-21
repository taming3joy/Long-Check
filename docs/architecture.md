# Architecture

Long-Check is intentionally small for a hackathon MVP.

```text
LINE User
→ LINE Official Account
→ Webhook to Express backend
→ analyzeRisk(userText)
→ LLM or mock analyzer
→ LINE reply
```

## Components

- `src/index.js`: Express server, health route, and LINE webhook route.
- `src/line/lineWebhook.js`: receives LINE events and passes text messages to the analyzer.
- `src/line/lineClient.js`: sends LINE replies or logs mock replies locally.
- `workspaces/sister-risk-analyzer/riskAnalyzer.js`: single analyzer interface used by the backend.
- `workspaces/sister-risk-analyzer/retrieval.js`: simple keyword retrieval over `knowledgeBase.json`.

## MVP Choice

The backend and analyzer communicate through one simple function:

```js
analyzeRisk(userText)
```

This lets the LINE integration and LLM analyzer workstreams move in parallel.
