# Sister Workspace: Risk Analyzer

This workspace owns the Long-Check risk analysis logic.

## Main Interface

`riskAnalyzer.js` exports:

```js
async function analyzeRisk(userText)
```

The LINE integration calls this function with a pasted user message. It returns plain text that is ready to send back to LINE.

## Files

- `prompt.js`: system prompt for the LLM version.
- `knowledgeBase.json`: small keyword knowledge base for demo context.
- `retrieval.js`: simple keyword retrieval.
- `riskAnalyzer.js`: mock analyzer and OpenAI analyzer wrapper.
- `testRiskAnalyzer.js`: manual test runner.

## Run Tests

```bash
npm run test:analyzer
```

Mock mode is enabled by default with `USE_MOCK_LLM=true`, so this workspace works without API keys.
