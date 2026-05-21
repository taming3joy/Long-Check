# Sister Workspace: Risk Analyzer

This workspace owns the Long-Check risk analysis logic.

## Main Interface

`riskAnalyzer.js` exports:

```js
async function analyzeRisk(userText)
```

The LINE integration calls this function with a pasted user message. It returns plain text that is ready to send back to LINE.

## Files

- `prompt.js`: system prompt for the local Qwen3 4B version.
- `knowledgeBase.json`: small keyword knowledge base for demo context.
- `retrieval.js`: simple keyword retrieval.
- `rules.json`: deterministic rule engine patterns and weights.
- `redactor.js`: local secret redaction before model calls.
- `localQwenClient.js`: Ollama/OpenAI-compatible client for Qwen3.
- `riskAnalyzer.js`: rule engine, fallback reply builder, and local Qwen wrapper.
- `testRiskAnalyzer.js`: manual test runner.

## Run Tests

```bash
npm run test:analyzer
```

Mock mode is enabled by default with `USE_MOCK_LLM=true`, so this workspace works without API keys.

## Run With Local Qwen3 4B

Install Ollama and pull the model:

```bash
ollama pull qwen3:4b
```

Set:

```env
USE_MOCK_LLM=false
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen3:4b
```

Then run:

```bash
npm run test:analyzer:llm
```

The LLM receives the redacted user message, rule-engine score, detected flags, and relevant knowledge-base notes. If Ollama fails or returns invalid JSON, the analyzer falls back to the deterministic rule-engine reply.
