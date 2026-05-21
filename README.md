# Long-Check

Long-Check is a hackathon MVP for a LINE chatbot that checks pasted Web3, wallet, airdrop, NFT, or Thai transaction messages. It replies with a simple risk level, warning signs, and safety advice.

Long-Check is not a guaranteed scam detector. It is a checklist assistant that helps users pause before clicking links, connecting wallets, signing messages, approving tokens, or sharing sensitive information.

## What It Does

- Receives messages from a LINE Official Account webhook.
- Analyzes text messages with a deterministic rule engine.
- Optionally uses a local Qwen model through Ollama to write more natural Thai replies.
- Redacts obvious secrets before LLM calls.
- Falls back to rule-engine replies if the local model is unavailable.
- Supports mock/rule mode for stable demos.

## Architecture

```text
LINE User
→ LINE Official Account
→ Express webhook /webhook
→ analyzeRisk(userText)
→ secret redactor + rule engine + knowledge notes
→ local Qwen/Ollama reply or rule-engine fallback
→ LINE reply
```

Key files:

- `src/index.js`: Express server.
- `src/line/lineWebhook.js`: LINE event handling.
- `src/line/lineClient.js`: LINE reply wrapper.
- `workspaces/sister-risk-analyzer/riskAnalyzer.js`: main analyzer interface.
- `workspaces/sister-risk-analyzer/rules.json`: risk rules and scoring.
- `workspaces/sister-risk-analyzer/prompt.js`: local LLM prompt.
- `workspaces/sister-risk-analyzer/localQwenClient.js`: Ollama client.

## 1. Install Project Dependencies

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Do not commit `.env`; it contains secrets.

## 2. Configure Environment Variables

For LINE + local Qwen mode:

```env
PORT=3000
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
USE_MOCK_LLM=false
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen3:8b
```

For fast demo/mock mode:

```env
USE_MOCK_LLM=true
```

When `USE_MOCK_LLM=true`, Long-Check does not call Ollama. It uses the deterministic rule engine only.

## 3. Install and Run Ollama

Install Ollama:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Pull the local model:

```bash
ollama pull qwen3:8b
```

Check that Ollama can see the model:

```bash
ollama list
```

You should see `qwen3:8b`.

Ollama should serve locally at:

```text
http://localhost:11434
```

## 4. Test the Analyzer

Rule-engine/mock test:

```bash
npm run test:analyzer
```

Local Qwen/Ollama test:

```bash
npm run test:analyzer:llm
```

This test unloads the model from Ollama after it finishes so GPU memory is released. If you want to keep the model loaded for faster repeated testing, run:

```bash
OLLAMA_UNLOAD_AFTER_TEST=false npm run test:analyzer:llm
```

If Ollama is unavailable, the test should not crash. It should log a warning and fall back to the rule-engine reply.

## 5. Start the Server

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

If local LLM mode is enabled, startup logs should include:

```text
[long-check] Local LLM mode enabled: qwen3:8b at http://localhost:11434/v1
```

When you stop the server normally with Ctrl+C, Long-Check asks Ollama to unload the configured local model so GPU memory is released:

```text
[long-check] Unloaded local model from Ollama: qwen3:8b
```

If the process is killed forcefully, this cleanup may not run. In that case, unload manually with `npm run ollama:unload` or `ollama stop qwen3:8b`.

## 6. Expose Local Server to LINE

If using the local ngrok binary in this repo:

```bash
./tools/ngrok http 3000
```

Copy the HTTPS forwarding URL, then add `/webhook`.

Example:

```text
https://your-ngrok-url.ngrok-free.dev/webhook
```

Use that as the webhook URL in the LINE Developers Console.

## 7. LINE Setup

In LINE Developers Console:

1. Create or open your Messaging API channel.
2. Copy the Channel secret into `LINE_CHANNEL_SECRET`.
3. Issue a Channel access token and copy it into `LINE_CHANNEL_ACCESS_TOKEN`.
4. Set the webhook URL to your ngrok/deployed URL ending in `/webhook`.
5. Click Verify.
6. Turn Use webhook on.

In LINE Official Account Manager:

- Turn webhook/bot mode on.
- Turn greeting messages and auto-response messages off for a cleaner demo.

## 8. Demo Messages

High Risk:

```text
ด่วน! รับแอร์ดรอปภายใน 10 นาที คลิก bit.ly/claim แล้ว connect wallet จากนั้น approve token เพื่อรับรางวัล
```

High Risk wallet signature:

```text
โปรด connect wallet และ sign message เพื่อ verify account ของคุณ ห้ามพลาด reward รอบนี้
```

Suspicious NFT message:

```text
มี Discord DM บอกว่าได้ free NFT จาก unknown source ให้กดลิงก์แปลกเพื่อ claim
```

Low Risk:

```text
ควรตรวจสอบจากแหล่งทางการและ official website ก่อนทำรายการทุกครั้ง
```

## Team Workflow

Taming works mainly in:

- `src/index.js`
- `src/line/`
- `workspaces/taming-line-integration/`

Sister works mainly in:

- `workspaces/sister-risk-analyzer/`

The shared interface is:

```js
analyzeRisk(userText)
```

It accepts plain text and returns plain text ready to send to LINE.

## Useful Scripts

```bash
npm start
npm run dev
npm run test:analyzer
npm run test:analyzer:llm
npm run test:simulator:demo
npm run test:simulator:llm
```

## Troubleshooting

If you see `model not found`, check:

```bash
ollama list
```

Make sure `.env` has the same model name:

```env
OLLAMA_MODEL=qwen3:8b
```

If you see `Connection error`, make sure Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

If LINE does not reply:

- Confirm `npm start` is still running.
- Confirm ngrok is still running.
- Confirm the LINE webhook URL ends in `/webhook`.
- Confirm Use webhook is enabled.
- Check the server terminal logs.

If replies are too slow during the demo, switch to:

```env
USE_MOCK_LLM=true
```

If GPU memory stays occupied after a local model run, unload it manually:

```bash
npm run ollama:unload
```

You can also use Ollama directly:

```bash
ollama stop qwen3:8b
```

## Limitations

- Long-Check is not a guaranteed scam detector.
- It does not inspect blockchain transactions.
- It does not connect to wallets.
- It does not verify official domains automatically yet.
- It does not implement image upload, wallet connection, payment, login, database, scraping, or blockchain scanning.
- Local model quality and speed depend on the machine running Ollama.
