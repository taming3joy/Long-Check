require("dotenv").config();

const config = require("../../src/shared/config");
const {
  MAX_FOLLOW_UP_QUESTIONS,
  MAX_USER_MESSAGES
} = require("../../src/shared/sessionStore");
const { RISK_LEVELS } = require("../../src/shared/riskLevels");
const { SYSTEM_PROMPT, buildUserPrompt } = require("./prompt");
const { redactSecrets } = require("./redactor");
const { retrieveKnowledge } = require("./retrieval");
const { callLocalQwen } = require("./localQwenClient");
const rules = require("./rules.json");

const MODES = {
  ASK_FOLLOW_UP: "ASK_FOLLOW_UP",
  FINAL_SUMMARY: "FINAL_SUMMARY",
  ANSWER_AND_CONTINUE: "ANSWER_AND_CONTINUE",
  OUT_OF_SCOPE: "OUT_OF_SCOPE"
};

const FOLLOW_UP_QUESTIONS = [
  "ลิงก์หรือข้อความนี้มาจากช่องทาง official ของโปรเจกต์ หรือมาจาก DM/คนแปลกหน้าครับ?",
  "เขาขอให้ connect wallet, sign message, หรือ approve token ไหมครับ?",
  "มีการเร่งให้ทำทันที หรือบอกว่ารางวัลจะหมดเวลาไหมครับ?",
  "เขาขอ seed phrase, private key, recovery phrase, password หรือ OTP ไหมครับ?"
];

function calculateRiskLevel(score, forceHigh) {
  if (forceHigh || score >= 7) {
    return RISK_LEVELS.HIGH;
  }

  if (score >= 3) {
    return RISK_LEVELS.MEDIUM;
  }

  return RISK_LEVELS.LOW;
}

function evaluateRules(text) {
  let score = 0;
  let forceHigh = false;
  const matchedFlags = [];
  const normalizedText = String(text || "").toLowerCase();

  for (const rule of rules) {
    let matched = false;
    if (rule.pattern_type === "regex") {
      matched = rule.patterns.some((pattern) => {
        try {
          return new RegExp(pattern, "i").test(normalizedText);
        } catch (error) {
          return normalizedText.includes(pattern.toLowerCase());
        }
      });
    } else {
      matched = rule.patterns.some((pattern) =>
        normalizedText.includes(pattern.toLowerCase())
      );
    }

    if (matched) {
      score += rule.weight;
      matchedFlags.push({
        id: rule.id,
        category: rule.category,
        explanation_th: rule.explanation_th,
        explanation_en: rule.explanation_en,
        recommended_action_th: rule.recommended_action_th,
        recommended_action_en: rule.recommended_action_en,
        weight: rule.weight
      });

      if (rule.force_high) {
        forceHigh = true;
      }
    }
  }

  const hasAirdrop = matchedFlags.some((flag) => flag.category === "airdrop");
  const hasApproval = matchedFlags.some((flag) => flag.category === "approval" && flag.id !== "R008");
  const hasUnlimitedApproval = matchedFlags.some((flag) => flag.id === "R008");
  const hasUrgency = matchedFlags.some((flag) => flag.category === "urgency");
  const hasSecret = matchedFlags.some((flag) => flag.category === "secret");
  const hasSupport = matchedFlags.some((flag) => flag.category === "support" && flag.id === "R010");
  const hasSafeTransfer = matchedFlags.some((flag) => flag.id === "R011");
  const hasInvestment = matchedFlags.some((flag) => flag.category === "investment");
  const hasDomain = matchedFlags.some((flag) => flag.category === "domain");

  if (hasAirdrop && (hasApproval || hasUnlimitedApproval)) {
    score += 4;
    matchedFlags.push({
      id: "SYN_AIRDROP_APPROVAL",
      category: "synergy",
      explanation_th: "พบการอ้างแอร์ดรอป/แจกรางวัล คู่กับการขออนุมัติโทเคน มีความเสี่ยงสูญเสียทรัพย์สิน",
      explanation_en: "Airdrop claim combined with token approval request is high risk.",
      weight: 4
    });
  }

  if (hasAirdrop && hasUrgency) {
    score += 2;
    matchedFlags.push({
      id: "SYN_AIRDROP_URGENCY",
      category: "synergy",
      explanation_th: "พบข้อความเร่งรัดเวลาควบคู่กับการแจกแอร์ดรอปเพื่อกดดันให้กดยืนยัน",
      explanation_en: "Urgency pressure combined with airdrop claim.",
      weight: 2
    });
  }

  if (hasSupport && hasSecret) {
    forceHigh = true;
    matchedFlags.push({
      id: "SYN_SUPPORT_SECRET",
      category: "synergy",
      explanation_th: "ทีมงานจำแลงหรือฝ่ายช่วยเหลือขอข้อมูลความลับกระเป๋าเงิน",
      explanation_en: "Support impersonation requesting wallet secret keys/phrase.",
      weight: 0
    });
  }

  if (hasInvestment && (hasSafeTransfer || hasSupport)) {
    forceHigh = true;
    matchedFlags.push({
      id: "SYN_INVESTMENT_PHISHING",
      category: "synergy",
      explanation_th: "ข้อเสนอนำเสนอการลงทุนหรือการย้ายสินทรัพย์ที่มีการอ้างสิทธิ์ผลตอบแทนเกินจริง",
      explanation_en: "High-yield investment scheme combined with support or transfer requests.",
      weight: 0
    });
  }

  if (hasAirdrop && hasApproval && hasDomain) {
    forceHigh = true;
  }

  return {
    risk_score: Math.min(score, 20),
    risk_level: calculateRiskLevel(score, forceHigh),
    flags: matchedFlags
  };
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

function includesAny(text, keywords) {
  const normalizedText = normalize(text);
  return keywords.some((keyword) => normalizedText.includes(normalize(keyword)));
}

function getUserHistoryText(history, userText) {
  const userMessages = (history || [])
    .filter((message) => message.role === "user")
    .map((message) => message.content);

  if (!userMessages.length || userMessages[userMessages.length - 1] !== userText) {
    userMessages.push(userText);
  }

  return userMessages.join("\n");
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function detectSignals(combinedText, redaction) {
  const seedOrKey = redaction.secretDetected || includesAny(combinedText, [
    "seed phrase",
    "private key",
    "recovery phrase",
    "mnemonic",
    "password",
    "otp",
    "วลีกู้คืน",
    "คำกู้คืน",
    "คีย์ส่วนตัว",
    "ไพรเวทคีย์",
    "รหัสผ่าน",
    "รหัส otp"
  ]);
  const suspiciousLink = includesAny(combinedText, [
    "bit.ly",
    "tinyurl",
    "short link",
    "suspicious domain",
    "strange domain",
    "http://",
    "link",
    "ลิงก์",
    "เว็บแปลก",
    "โดเมนแปลก"
  ]);
  const urgency = includesAny(combinedText, [
    "urgent",
    "urgent airdrop",
    "limited time",
    "last chance",
    "claim now",
    "within 10 minutes",
    "ภายใน 10 นาที",
    "รีบ",
    "ด่วน",
    "หมดเวลา",
    "หมดเขต",
    "โอกาสสุดท้าย"
  ]);
  const walletAction = includesAny(combinedText, [
    "approve token",
    "token approval",
    "approve allowance",
    "approve unlimited",
    "sign message",
    "sign transaction",
    "wallet signature",
    "connect wallet",
    "wallet connect",
    "connect metamask",
    "อนุมัติโทเคน",
    "อนุมัติเหรียญ",
    "เซ็นข้อความ",
    "เซ็นธุรกรรม",
    "เชื่อมกระเป๋า",
    "เชื่อมต่อ wallet"
  ]);
  const officialYes = includesAny(combinedText, [
    "official source",
    "official website",
    "verified announcement",
    "checking official source",
    "verifying announcement",
    "แหล่งทางการ",
    "เว็บทางการ",
    "ประกาศทางการ",
    "ตรวจสอบจาก official",
    "official"
  ]);
  const officialNo = includesAny(combinedText, [
    "discord dm",
    "unknown source",
    "stranger",
    "คนแปลกหน้า",
    "dm",
    "ไม่แน่ใจว่า official ไหม",
    "ไม่รู้แหล่งที่มา",
    "แอดมินทัก",
    "admin dm"
  ]);
  const reward = includesAny(combinedText, [
    "airdrop",
    "urgent airdrop",
    "free nft",
    "free token",
    "reward",
    "claim",
    "too good",
    "รับแอร์ดรอป",
    "แอร์ดรอป",
    "แจก nft",
    "แจกเหรียญ",
    "รับรางวัล",
    "รางวัล"
  ]);

  return {
    seedOrKey,
    suspiciousLink,
    urgency,
    walletAction,
    officialSource: officialYes ? "Yes" : officialNo ? "No" : "Unclear",
    reward
  };
}

function hasHighRiskKeywords(combinedText, signals) {
  return signals.seedOrKey || signals.walletAction || signals.urgency || includesAny(combinedText, [
    "seed phrase",
    "private key",
    "recovery phrase",
    "approve token",
    "sign message",
    "connect wallet",
    "urgent airdrop",
    "ภายใน 10 นาที",
    "รีบ",
    "ด่วน",
    "bit.ly",
    "short link",
    "tinyurl",
    "impersonation",
    "ปลอมตัว",
    "แอบอ้าง",
    "dm คนแปลกหน้า",
    "คนแปลกหน้า",
    "stranger dm",
    "dm from stranger"
  ]);
}

function hasMediumRiskKeywords(combinedText) {
  return includesAny(combinedText, [
    "airdrop",
    "free nft",
    "discord dm",
    "dm",
    "unknown source",
    "link",
    "เว็บแปลก",
    "ไม่แน่ใจว่า official ไหม",
    "แอร์ดรอป",
    "ลิงก์",
    "ไม่รู้แหล่งที่มา"
  ]);
}

function hasLowRiskKeywords(combinedText) {
  return includesAny(combinedText, [
    "checking official source",
    "verifying announcement",
    "not connecting wallet",
    "asking how to stay safe",
    "official source",
    "ตรวจสอบจากแหล่งทางการ",
    "เช็กประกาศ",
    "ไม่เชื่อมกระเป๋า",
    "อยากรู้วิธีปลอดภัย",
    "ทำยังไงให้ปลอดภัย"
  ]);
}

function hasRiskContext(combinedText) {
  return includesAny(combinedText, [
    "web3",
    "crypto",
    "wallet",
    "airdrop",
    "nft",
    "token",
    "transaction",
    "approve",
    "signature",
    "connect",
    "scam",
    "phishing",
    "marketplace",
    "link",
    "seed",
    "private key",
    "กระเป๋า",
    "คริปโต",
    "เหรียญ",
    "แอร์ดรอป",
    "ธุรกรรม",
    "ลิงก์",
    "สแกม",
    "หลอก",
    "โกง",
    "โอนเงิน",
    "โทเคน"
  ]);
}

function isRelevantSafetyQuestion(userText) {
  return includesAny(userText, [
    "safe",
    "safety",
    "protect",
    "avoid",
    "revoke",
    "what should i do",
    "is this safe",
    "ปลอดภัย",
    "ควรทำยังไง",
    "ทำยังไง",
    "ป้องกัน",
    "ยกเลิก approval",
    "ถอนสิทธิ์",
    "เช็กยังไง",
    "คลิกแล้ว",
    "โดนหลอก"
  ]);
}

function determineRiskLevel(combinedText, signals, forceSummary) {
  if (hasHighRiskKeywords(combinedText, signals)) {
    return RISK_LEVELS.HIGH;
  }

  if (hasMediumRiskKeywords(combinedText)) {
    return RISK_LEVELS.MEDIUM;
  }

  if (hasLowRiskKeywords(combinedText)) {
    return RISK_LEVELS.LOW;
  }

  return forceSummary ? RISK_LEVELS.MEDIUM : RISK_LEVELS.LOW;
}

function buildReason(riskLevel, signals) {
  if (riskLevel === RISK_LEVELS.HIGH) {
    return "ข้อความมีสัญญาณเสี่ยงสูง เช่น การเร่งให้ทำรายการ ลิงก์ที่ไม่น่าไว้ใจ หรือการขอให้เชื่อมกระเป๋า/เซ็น/อนุมัติโทเคน. การกระทำเหล่านี้อาจทำให้เสียทรัพย์สินได้. ลองเช็คไม่สามารถยืนยัน scam ได้ 100% แต่สัญญาณตอนนี้ควรหยุดก่อน.";
  }

  if (riskLevel === RISK_LEVELS.MEDIUM) {
    return "ข้อความมีบางสัญญาณที่ควรระวัง แต่ยังมีข้อมูลไม่ครบพอให้ยืนยันได้ชัดเจน. แหล่งที่มา ลิงก์ และคำขอจากกระเป๋าเงินควรถูกตรวจสอบก่อน. หากข้อมูลใดไม่ชัดเจน ให้ถือว่า Unclear.";
  }

  if (signals.officialSource === "Yes") {
    return "ข้อความเน้นการตรวจสอบจากแหล่งทางการและยังไม่พบคำขอให้ทำธุรกรรมเสี่ยง. อย่างไรก็ตาม ไม่ควรกดลิงก์หรือเชื่อมกระเป๋าหากยังไม่ตรวจสอบโดเมนเอง. ลองเช็คเป็นเพียงผู้ช่วยเช็กลิสต์ความเสี่ยง.";
  }

  return "จากข้อมูลที่มี ยังไม่พบสัญญาณอันตรายชัดเจน. แต่ข้อมูลบางส่วนอาจยังไม่ครบ จึงควรตรวจสอบแหล่งที่มาอีกครั้ง. ลองเช็คไม่สามารถรับประกันความปลอดภัยได้ 100%.";
}

function buildSuggestion(riskLevel) {
  if (riskLevel === RISK_LEVELS.HIGH) {
    return "หยุดกดลิงก์ เชื่อมกระเป๋า เซ็นข้อความ หรือ approve token ก่อน. เปิดประกาศจากช่องทาง official ด้วยตัวเองและอย่าส่ง seed phrase/private key/OTP ให้ใคร.";
  }

  if (riskLevel === RISK_LEVELS.MEDIUM) {
    return "ตรวจสอบแหล่งที่มาและโดเมนจากช่องทาง official ก่อนดำเนินการ. หากมีการขอเชื่อมกระเป๋าหรือเซ็นธุรกรรม ให้หยุดและตรวจซ้ำ.";
  }

  return "ตรวจสอบจาก official website หรือประกาศทางการต่อไป. หากมีคำขอข้อมูลลับหรือคำขอเซ็น/approve เกิดขึ้น ให้หยุดก่อน.";
}

function buildFinalSummary({ riskLevel, signals }) {
  return {
    mode: MODES.FINAL_SUMMARY,
    reply: `ลองเช็ค Risk Summary

Risk Level: ${riskLevel}

Checklist:
- Seed phrase or private key requested: ${yesNo(signals.seedOrKey)}
- Suspicious link or strange domain: ${yesNo(signals.suspiciousLink)}
- Urgency or pressure: ${yesNo(signals.urgency)}
- Token approval or wallet signature requested: ${yesNo(signals.walletAction)}
- Official source verified: ${signals.officialSource}
- Too-good-to-be-true reward: ${yesNo(signals.reward)}

Reason:
${buildReason(riskLevel, signals)}

Suggestion:
${buildSuggestion(riskLevel)}

Commands:
- "สรุป" = สรุปความเสี่ยงอีกครั้ง
- "เริ่มใหม่" = เริ่มเคสใหม่
- "ช่วยเหลือ" = ดูวิธีใช้`,
    riskLevel,
    shouldEndSession: true
  };
}

function buildAnswerAndContinue() {
  return {
    mode: MODES.ANSWER_AND_CONTINUE,
    reply: "โดยทั่วไปให้ตรวจสอบจากช่องทาง official เองก่อนเสมอ อย่ากดลิงก์จาก DM และอย่า connect wallet, sign message หรือ approve token ถ้ายังไม่แน่ใจครับ\n\nพิมพ์ \"ช่วยเหลือ\" เพื่อดูรายละเอียดเพิ่มเติมได้ครับ",
    riskLevel: null,
    shouldEndSession: false
  };
}

function buildOutOfScope() {
  return {
    mode: MODES.OUT_OF_SCOPE,
    reply: `ลองเช็คโฟกัสที่การตรวจสอบความเสี่ยงจาก Web3, crypto, wallet, เว็บไซต์ที่น่าสงสัย หรือข้อความที่อาจเป็นการหลอกลวงครับ

คุณสามารถส่งข้อความหรือลิงก์ที่น่าสงสัยมาให้ตรวจสอบได้ครับ

คำสั่งที่ใช้ได้:
- "สรุป" = สรุปความเสี่ยงตอนนี้
- "เริ่มใหม่" = เริ่มเคสใหม่
- "ช่วยเหลือ" = ดูวิธีใช้`,
    riskLevel: null,
    shouldEndSession: false
  };
}

function selectFollowUpQuestion(signals) {
  if (signals.officialSource === "Unclear") {
    return FOLLOW_UP_QUESTIONS[0];
  }

  if (!signals.walletAction) {
    return FOLLOW_UP_QUESTIONS[1];
  }

  if (!signals.urgency) {
    return FOLLOW_UP_QUESTIONS[2];
  }

  if (!signals.seedOrKey) {
    return FOLLOW_UP_QUESTIONS[3];
  }

  return null;
}

function buildMockConversationResult(userText, options, ruleResult, redaction) {
  const history = options.history || [];
  const questionCount = options.questionCount ?? 0;
  const userMessageCount = options.userMessageCount ?? 1;
  const maxFollowUpQuestions = options.maxFollowUpQuestions ?? MAX_FOLLOW_UP_QUESTIONS;
  const maxUserMessages = options.maxUserMessages ?? MAX_USER_MESSAGES;
  const combinedText = getUserHistoryText(history, userText);
  const signals = detectSignals(combinedText, redaction);
  const forcedByLimit = userMessageCount >= maxUserMessages || questionCount >= maxFollowUpQuestions;
  const forceSummary = Boolean(options.forceSummary || forcedByLimit);
  const riskLevel = determineRiskLevel(combinedText, signals, forceSummary);
  const hasHighRisk = riskLevel === RISK_LEVELS.HIGH;
  const hasContext = hasRiskContext(combinedText);

  if (forceSummary || hasHighRisk) {
    return buildFinalSummary({ riskLevel, signals });
  }

  if (!hasContext && !isRelevantSafetyQuestion(userText)) {
    return buildOutOfScope();
  }

  if (!forceSummary && !hasHighRisk && isRelevantSafetyQuestion(userText)) {
    return buildAnswerAndContinue();
  }

  const question = selectFollowUpQuestion(signals);
  if (question && questionCount < maxFollowUpQuestions) {
    return {
      mode: MODES.ASK_FOLLOW_UP,
      reply: question,
      riskLevel: null,
      shouldEndSession: false
    };
  }

  return buildFinalSummary({ riskLevel, signals });
}

function normalizeAnalyzerResult(result, fallback, options) {
  const validModes = Object.values(MODES);

  if (!result || typeof result !== "object" || !validModes.includes(result.mode)) {
    return fallback;
  }

  const questionCount = options.questionCount ?? 0;
  const maxFollowUpQuestions = options.maxFollowUpQuestions ?? MAX_FOLLOW_UP_QUESTIONS;
  const forceSummary = Boolean(options.forceSummary || options.userMessageCount >= (options.maxUserMessages ?? MAX_USER_MESSAGES));

  if (result.mode === MODES.ASK_FOLLOW_UP && (forceSummary || questionCount >= maxFollowUpQuestions)) {
    return fallback.mode === MODES.FINAL_SUMMARY ? fallback : {
      ...fallback,
      mode: MODES.FINAL_SUMMARY,
      shouldEndSession: true
    };
  }

  if (result.mode === MODES.FINAL_SUMMARY) {
    const riskLevel = Object.values(RISK_LEVELS).includes(result.riskLevel)
      ? result.riskLevel
      : fallback.riskLevel || RISK_LEVELS.MEDIUM;

    return {
      mode: MODES.FINAL_SUMMARY,
      reply: String(result.reply || fallback.reply),
      riskLevel,
      shouldEndSession: true
    };
  }

  return {
    mode: result.mode,
    reply: String(result.reply || fallback.reply),
    riskLevel: null,
    shouldEndSession: Boolean(result.shouldEndSession)
  };
}

async function analyzeRisk(userText, options = {}) {
  const redaction = redactSecrets(userText);
  const combinedText = getUserHistoryText(options.history || [], redaction.redactedText);
  const ruleResult = evaluateRules(combinedText);
  const fallback = buildMockConversationResult(redaction.redactedText, options, ruleResult, redaction);

  if (config.useMockLlm) {
    return fallback;
  }

  try {
    const knowledgeNotes = retrieveKnowledge(combinedText);
    const result = await callLocalQwen({
      baseUrl: config.localLlm.baseUrl,
      model: config.localLlm.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(redaction.redactedText, ruleResult, {
        history: options.history || [],
        knowledgeNotes,
        questionCount: options.questionCount ?? 0,
        userMessageCount: options.userMessageCount ?? 1,
        maxFollowUpQuestions: options.maxFollowUpQuestions ?? MAX_FOLLOW_UP_QUESTIONS,
        maxUserMessages: options.maxUserMessages ?? MAX_USER_MESSAGES,
        forceSummary: Boolean(options.forceSummary)
      })
    });

    return normalizeAnalyzerResult(result, fallback, options);
  } catch (error) {
    console.warn("[long-check] Local LLM connection failed. Falling back to deterministic conversation logic.", error.message);
    return fallback;
  }
}

async function analyzeRiskDetailed(userText, options = {}) {
  const result = await analyzeRisk(userText, options);
  return {
    intent: result.mode,
    language: "th",
    risk_level: result.riskLevel,
    risk_score: result.riskLevel === RISK_LEVELS.HIGH ? 20 : result.riskLevel === RISK_LEVELS.MEDIUM ? 10 : 1,
    summary: result.reply,
    detected_flags: [],
    recommended_actions: [],
    do_not_do: [],
    follow_up_question: result.mode === MODES.ASK_FOLLOW_UP ? result.reply : null,
    quick_replies: ["สรุป", "เริ่มใหม่", "ช่วยเหลือ"],
    line_reply_text: result.reply
  };
}

function buildMockAnalysis(userText, ruleResult = null) {
  const redaction = redactSecrets(userText);
  const result = ruleResult
    ? buildFinalSummary({
        riskLevel: ruleResult.risk_level,
        signals: detectSignals(userText, redaction)
      })
    : buildMockConversationResult(userText, { forceSummary: true }, evaluateRules(userText), redaction);
  return result.reply;
}

module.exports = {
  MODES,
  analyzeRisk,
  analyzeRiskDetailed,
  evaluateRules,
  buildMockAnalysis
};
