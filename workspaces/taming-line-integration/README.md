# Taming Workspace: LINE Integration

This workspace is for LINE setup notes, webhook testing, and backend integration work.

Taming mainly owns:

- `src/index.js`
- `src/line/lineClient.js`
- `src/line/lineWebhook.js`
- Files in `workspaces/taming-line-integration/`

The integration point with Sister's analyzer is:

```js
const { analyzeRisk } = require("../../workspaces/sister-risk-analyzer/riskAnalyzer");
```

Keep that interface simple: input is user text, output is a plain text reply.
