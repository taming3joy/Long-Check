const useMockLlmValue = process.env.USE_MOCK_LLM;

module.exports = {
  port: Number(process.env.PORT || 3000),
  useMockLlm: useMockLlmValue === undefined ? true : useMockLlmValue === "true",
  line: {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || ""
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini"
  },
  localLlm: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    model: process.env.OLLAMA_MODEL || "qwen3:8b"
  }
};
