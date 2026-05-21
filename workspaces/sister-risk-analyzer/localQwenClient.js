const OpenAI = require("openai");

function getNativeOllamaUrl(baseUrl) {
  return String(baseUrl || "http://localhost:11434/v1").replace(/\/v1\/?$/, "");
}

function stripThinkingText(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function parseJsonFromModel(text) {
  const cleanText = stripThinkingText(text);

  try {
    return JSON.parse(cleanText);
  } catch (error) {
    const firstBrace = cleanText.indexOf("{");
    const lastBrace = cleanText.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw error;
    }

    return JSON.parse(cleanText.slice(firstBrace, lastBrace + 1));
  }
}

async function createJsonCompletion(client, params) {
  try {
    return await client.chat.completions.create({
      ...params,
      response_format: { type: "json_object" }
    });
  } catch (error) {
    if (!error.status || error.status >= 500) {
      throw error;
    }

    console.warn("[long-check] Local LLM JSON mode failed. Retrying without response_format.", error.message);
    return client.chat.completions.create(params);
  }
}

async function callLocalQwen({ baseUrl, model, systemPrompt, userPrompt }) {
  const client = new OpenAI({
    baseURL: baseUrl,
    apiKey: "ollama"
  });

  const response = await createJsonCompletion(client, {
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `/no_think\n${userPrompt}` }
    ]
  });

  const responseText = response.choices[0] && response.choices[0].message
    ? response.choices[0].message.content
    : "";

  return parseJsonFromModel(responseText);
}

async function unloadLocalModel({ baseUrl, model }) {
  const ollamaUrl = getNativeOllamaUrl(baseUrl);
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [],
      keep_alive: 0
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to unload ${model}: ${response.status} ${body}`);
  }
}

module.exports = {
  callLocalQwen,
  unloadLocalModel,
  parseJsonFromModel,
  stripThinkingText
};
