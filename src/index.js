require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const config = require("./shared/config");
const { handleWebhook } = require("./line/lineWebhook");
const { unloadLocalModel } = require("../workspaces/sister-risk-analyzer/localQwenClient");

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

const server = app.listen(config.port, () => {
  console.log(`[long-check] Server running on http://localhost:${config.port}`);
  console.log("[long-check] Health check: GET /health");
  console.log("[long-check] LINE webhook: POST /webhook");
  if (config.useMockLlm) {
    console.log("[long-check] Mock LLM mode is enabled.");
  } else {
    console.log(`[long-check] Local LLM mode enabled: ${config.localLlm.model} at ${config.localLlm.baseUrl}`);
  }
});

let isShuttingDown = false;

async function unloadModelOnShutdown() {
  if (config.useMockLlm) {
    return;
  }

  try {
    await unloadLocalModel({
      baseUrl: config.localLlm.baseUrl,
      model: config.localLlm.model
    });
    console.log(`[long-check] Unloaded local model from Ollama: ${config.localLlm.model}`);
  } catch (error) {
    console.warn("[long-check] Could not unload local model from Ollama:", error.message);
  }
}

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[long-check] Received ${signal}. Shutting down...`);

  server.close(async () => {
    await unloadModelOnShutdown();
    process.exit(0);
  });

  setTimeout(() => {
    console.warn("[long-check] Shutdown timed out. Exiting.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
