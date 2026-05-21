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
  }
};
