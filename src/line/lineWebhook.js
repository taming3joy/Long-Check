const { replyText } = require("./lineClient");
const { formatForLine } = require("../shared/messageFormatter");
const { analyzeRisk } = require("../../workspaces/sister-risk-analyzer/riskAnalyzer");

async function handleMessageEvent(event) {
  if (event.type !== "message" || !event.replyToken) {
    return;
  }

  if (!event.message || event.message.type !== "text") {
    await replyText(event.replyToken, "Long-Check MVP รองรับข้อความตัวอักษรเท่านั้นในตอนนี้");
    return;
  }

  const userText = event.message.text || "";
  const analysis = await analyzeRisk(userText);
  await replyText(event.replyToken, formatForLine(analysis));
}

async function handleWebhook(req, res, next) {
  try {
    const events = Array.isArray(req.body.events) ? req.body.events : [];
    console.log(`[long-check] Received ${events.length} LINE event(s).`);

    await Promise.all(events.map(handleMessageEvent));
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleWebhook
};
