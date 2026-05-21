const { replyText } = require("./lineClient");
const { formatForLine } = require("../shared/messageFormatter");
const {
  MAX_FOLLOW_UP_QUESTIONS,
  MAX_USER_MESSAGES,
  MAX_HISTORY_MESSAGES_SENT_TO_LLM,
  addMessage,
  cleanupOldSessions,
  getRecentHistory,
  getSession,
  incrementQuestionCount,
  resetSession,
  shouldForceSummary
} = require("../shared/sessionStore");
const { analyzeRisk } = require("../../workspaces/sister-risk-analyzer/riskAnalyzer");

const HELP_MESSAGE = `ลองเช็กช่วยวิเคราะห์ความเสี่ยงของข้อความหรือธุรกรรมที่น่าสงสัยครับ

วิธีใช้:
1. วางข้อความหรือลิงก์ที่อยากให้ช่วยเช็ก
2. ตอบคำถามเพิ่มเติมถ้ามี
3. พิมพ์ "สรุป" เพื่อขอสรุปความเสี่ยง
4. พิมพ์ "เริ่มใหม่" เพื่อเริ่มเคสใหม่

ข้อจำกัด:
ลองเช็กเป็นผู้ช่วยเช็กลิสต์ความเสี่ยง ไม่สามารถยืนยันได้ 100% ว่าเป็น scam หรือไม่`;

const START_MESSAGE = "เริ่มเคสใหม่แล้วครับ วางข้อความหรือลิงก์ที่อยากให้ลองเช็กได้เลย";
const EMPTY_MESSAGE = "ส่งข้อความหรือลิงก์ที่อยากให้ลองเช็กได้เลยครับ หรือพิมพ์ \"ช่วยเหลือ\" เพื่อดูวิธีใช้";

function getSessionKey(event) {
  const source = event.source || {};
  return source.userId || source.groupId || source.roomId || event.webhookEventId || event.replyToken || "temporary-line-user";
}

async function handleMessageEvent(event) {
  if (event.type !== "message" || !event.replyToken) {
    return;
  }

  if (!event.message || event.message.type !== "text") {
    await replyText(event.replyToken, "Long-Check MVP รองรับข้อความตัวอักษรเท่านั้นในตอนนี้");
    return;
  }

  const userId = getSessionKey(event);
  const userText = String(event.message.text || "").trim();

  if (!userText) {
    await replyText(event.replyToken, EMPTY_MESSAGE);
    return;
  }

  if (userText === "เริ่มใหม่") {
    resetSession(userId);
    await replyText(event.replyToken, START_MESSAGE);
    return;
  }

  if (userText === "ช่วยเหลือ") {
    await replyText(event.replyToken, HELP_MESSAGE);
    return;
  }

  getSession(userId);
  addMessage(userId, "user", userText);

  const session = getSession(userId);
  const forceSummary = userText === "สรุป" || shouldForceSummary(session);
  const result = await analyzeRisk(userText, {
    history: getRecentHistory(userId, MAX_HISTORY_MESSAGES_SENT_TO_LLM),
    questionCount: session.questionCount,
    userMessageCount: session.userMessageCount,
    forceSummary,
    maxFollowUpQuestions: MAX_FOLLOW_UP_QUESTIONS,
    maxUserMessages: MAX_USER_MESSAGES
  });
  const reply = formatForLine(result.reply);

  await replyText(event.replyToken, reply);
  addMessage(userId, "assistant", reply);

  if (result.mode === "ASK_FOLLOW_UP") {
    incrementQuestionCount(userId);
  }

  if (result.shouldEndSession) {
    resetSession(userId);
  }
}

async function handleWebhook(req, res, next) {
  try {
    cleanupOldSessions();
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
