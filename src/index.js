require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const config = require("./shared/config");
const { handleWebhook } = require("./line/lineWebhook");

const app = express();

app.get("/health", (req, res) => {
  res.json({ status: "ok", project: "long-check" });
});

const webhookParser = config.line.channelSecret
  ? line.middleware({ channelSecret: config.line.channelSecret })
  : express.json();

if (!config.line.channelSecret) {
  console.warn("[long-check] LINE_CHANNEL_SECRET is missing. /webhook will accept unsigned JSON for local testing.");
}

app.post("/webhook", webhookParser, handleWebhook);

app.use((err, req, res, next) => {
  console.error("[long-check] Request error:", err);
  res.status(err.status || 500).json({
    status: "error",
    message: "Internal server error"
  });
});

app.listen(config.port, () => {
  console.log(`[long-check] Server running on http://localhost:${config.port}`);
  console.log("[long-check] Health check: GET /health");
  console.log("[long-check] LINE webhook: POST /webhook");
  if (config.useMockLlm) {
    console.log("[long-check] Mock LLM mode is enabled.");
  }
});
