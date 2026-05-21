# Sister Workspace: Risk Analyzer

This workspace owns the Long-Check risk analysis logic.

## Main Interface

`riskAnalyzer.js` exports:

```js
async function analyzeRisk(userText, options = {})
```

The LINE integration calls this function with a pasted user message plus recent conversation context. It returns:

```js
{
  mode: "ASK_FOLLOW_UP" | "FINAL_SUMMARY" | "ANSWER_AND_CONTINUE" | "OUT_OF_SCOPE",
  reply: "text to send to LINE",
  riskLevel: "Low Risk" | "Medium Risk" | "High Risk" | null,
  shouldEndSession: true | false
}
```

## Files

- `prompt.js`: controlled conversation prompt for the local Qwen version.
- `knowledgeBase.json`: small keyword knowledge base for demo context.
- `retrieval.js`: simple keyword retrieval.
- `rules.json`: deterministic rule engine patterns and weights.
- `redactor.js`: local secret redaction before model calls.
- `localQwenClient.js`: Ollama/OpenAI-compatible client for Qwen3.
- `riskAnalyzer.js`: conversation mode selector, rule engine, fallback reply builder, and local Qwen wrapper.
- `testRiskAnalyzer.js`: manual test runner.

## Run Tests

```bash
npm run test:analyzer
```

Mock mode is enabled by default with `USE_MOCK_LLM=true`, so this workspace works without API keys.

## Run With Local Qwen

Install Ollama and pull the model:

```bash
ollama pull qwen3:8b
```

Set:

```env
USE_MOCK_LLM=false
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen3:8b
```

Then run:

```bash
npm run test:analyzer:llm
```

The LLM receives the redacted user message, recent history, session limits, rule-engine score, detected flags, and relevant knowledge-base notes. If Ollama fails or returns invalid JSON, the analyzer falls back to deterministic conversation logic.
