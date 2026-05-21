require("dotenv").config();

const config = require("../../src/shared/config");
const { unloadLocalModel } = require("./localQwenClient");

async function main() {
  await unloadLocalModel({
    baseUrl: config.localLlm.baseUrl,
    model: config.localLlm.model
  });

  console.log(`[long-check] Unloaded local model from Ollama: ${config.localLlm.model}`);
}

main().catch((error) => {
  console.error("[long-check] Failed to unload local model:", error.message);
  process.exit(1);
});
