# Long-Check

Long-Check is a hackathon MVP for a LINE chatbot that analyzes pasted Web3 or Thai transaction messages. It replies with a simple checklist, a Low / Medium / High risk level, and practical safety advice.

Long-Check is not a guaranteed scam detector. It is a checklist assistant that helps users pause before clicking links, connecting wallets, signing messages, approving tokens, or sharing sensitive information.

## Features

- LINE webhook endpoint with Express.
- Text message analysis for Web3, wallet, NFT, airdrop, and Thai transaction messages.
- Mock analyzer enabled by default, so the app runs without API keys.
- Optional OpenAI analyzer through a clean `analyzeRisk(userText)` wrapper.
- Simple keyword knowledge base for demo context.
- LINE-safe response formatter.

## Architecture

```text
LINE User
→ LINE Official Account
→ Webhook to Express backend
→ analyzeRisk(userText)
→ LLM or mock analyzer
→ LINE reply
```

Key files:

- `src/index.js`: Express server.
- `src/line/lineWebhook.js`: LINE event handling.
- `src/line/lineClient.js`: LINE reply wrapper.
- `workspaces/sister-risk-analyzer/riskAnalyzer.js`: analyzer interface.
- `workspaces/sister-risk-analyzer/prompt.js`: LLM system prompt.
- `workspaces/sister-risk-analyzer/knowledgeBase.json`: small demo knowledge base.

## Setup

```bash
npm install
cp .env.example .env
```

Mock mode is enabled by default:

```env
USE_MOCK_LLM=true
```

## Environment Variables

```env
PORT=3000
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
OPENAI_API_KEY=
USE_MOCK_LLM=true
```

- `PORT`: local server port.
- `LINE_CHANNEL_ACCESS_TOKEN`: LINE Messaging API channel access token.
- `LINE_CHANNEL_SECRET`: LINE Messaging API channel secret.
- `OPENAI_API_KEY`: optional OpenAI API key.
- `USE_MOCK_LLM`: use deterministic mock analysis when `true`.

## Run Locally

```bash
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{ "status": "ok", "project": "long-check" }
```

Development mode:

```bash
npm run dev
```

## Test Analyzer

```bash
npm run test:analyzer
```

This runs manual examples for High Risk, Medium Risk, and Low Risk. It works without API keys because mock mode is the default.

## LINE Webhook Setup Notes

1. Create a LINE Official Account and Messaging API channel.
2. Add `LINE_CHANNEL_ACCESS_TOKEN` and `LINE_CHANNEL_SECRET` to `.env`.
3. Deploy the Express server or expose local development with a tool such as ngrok.
4. Set the webhook URL to:

```text
https://YOUR_DOMAIN/webhook
```

5. Enable webhook usage in the LINE Developers Console.
6. Send text messages to the LINE Official Account and check the server logs.

If LINE keys are missing, the server still starts and logs mock replies locally.

## Team Workflow

Taming works mainly in `src/line`, `src/index.js`, and `workspaces/taming-line-integration`.

Sister works mainly in `workspaces/sister-risk-analyzer`.

Shared integration happens through:

```js
analyzeRisk(userText)
```

Both sides can work independently and merge later because the interface is simple: text in, plain text result out.

## Demo Examples

High Risk:

```text
ด่วน! รับแอร์ดรอปภายใน 10 นาที คลิก bit.ly/claim แล้ว connect wallet จากนั้น approve token เพื่อรับรางวัล
```

Medium Risk:

```text
มี Discord DM บอกว่าได้ free NFT จาก unknown source ให้กดลิงก์แปลกเพื่อ claim
```

Low Risk:

```text
ควรตรวจสอบจากแหล่งทางการและ official website ก่อนทำรายการทุกครั้ง
```

## Limitations

- Long-Check is not a guaranteed scam detector.
- It does not inspect blockchain transactions.
- It does not connect to wallets.
- It does not verify official domains automatically yet.
- It does not implement image upload, wallet connection, payment, login, database, scraping, or blockchain scanning.
