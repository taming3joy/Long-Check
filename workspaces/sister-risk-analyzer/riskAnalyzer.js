require("dotenv").config();

const OpenAI = require("openai");
const config = require("../../src/shared/config");
const { RISK_LEVELS } = require("../../src/shared/riskLevels");
const { SYSTEM_PROMPT } = require("./prompt");
const { retrieveKnowledge, formatKnowledgeNotes } = require("./retrieval");

const highRiskKeywords = [
  "seed phrase",
  "private key",
  "recovery phrase",
  "approve token",
  "token approval",
  "approve unlimited",
  "sign message",
  "signature",
  "connect wallet",
  "urgent airdrop",
  "วลีกู้คืน",
  "คำกู้คืน",
  "คีย์ส่วนตัว",
  "ไพรเวทคีย์",
  "อนุมัติโทเคน",
  "อนุมัติไม่จำกัด",
  "เซ็นข้อความ",
  "เซ็นธุรกรรม",
  "เชื่อมกระเป๋า",
  "แอร์ดรอปด่วน"
];

const mediumRiskKeywords = [
  "suspicious link",
  "strange domain",
  "discord dm",
  "free nft",
  "airdrop",
  "unknown source",
  "bit.ly",
  "tinyurl",
  "ลิงก์แปลก",
  "โดเมนแปลก",
  "แจก nft",
  "แอร์ดรอป",
  "แหล่งที่ไม่รู้จัก"
];

const lowRiskKeywords = [
  "official source",
  "official website",
  "verify from official",
  "ตรวจสอบจากแหล่งทางการ",
  "เว็บทางการ",
  "ประกาศทางการ"
];

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function checklistValue(text, keywords) {
  return includesAny(text, keywords) ? "Yes" : "No";
}

function buildMockAnalysis(userText) {
  const text = String(userText || "").toLowerCase();
  const hasHighRisk = includesAny(text, highRiskKeywords);
  const hasMediumRisk = includesAny(text, mediumRiskKeywords);
  const onlyOfficialCheck =
    !hasHighRisk && !hasMediumRisk && includesAny(text, lowRiskKeywords);

  let riskLevel = RISK_LEVELS.LOW;
  if (hasHighRisk) {
    riskLevel = RISK_LEVELS.HIGH;
  } else if (hasMediumRisk && !onlyOfficialCheck) {
    riskLevel = RISK_LEVELS.MEDIUM;
  }

  const seedOrKey = checklistValue(text, [
    "seed phrase",
    "private key",
    "recovery phrase",
    "วลีกู้คืน",
    "คำกู้คืน",
    "คีย์ส่วนตัว",
    "ไพรเวทคีย์"
  ]);
  const suspiciousLink = checklistValue(text, [
    "suspicious link",
    "strange domain",
    "bit.ly",
    "tinyurl",
    "http://",
    "ลิงก์แปลก",
    "โดเมนแปลก"
  ]);
  const urgency = checklistValue(text, [
    "urgent",
    "last chance",
    "claim now",
    "limited time",
    "ด่วน",
    "หมดเขต",
    "โอกาสสุดท้าย"
  ]);
  const walletAction = checklistValue(text, [
    "approve token",
    "token approval",
    "approve unlimited",
    "sign message",
    "signature",
    "connect wallet",
    "อนุมัติโทเคน",
    "เซ็นข้อความ",
    "เซ็นธุรกรรม",
    "เชื่อมกระเป๋า"
  ]);
  const officialSource = includesAny(text, lowRiskKeywords) ? "Yes" : "Unclear";
  const reward = checklistValue(text, [
    "free nft",
    "airdrop",
    "claim reward",
    "แจก nft",
    "แอร์ดรอป",
    "รับรางวัล",
    "แจกเหรียญ"
  ]);

  const reasonByRisk = {
    [RISK_LEVELS.HIGH]:
      "ข้อความมีสัญญาณเสี่ยงสูง เช่น การขอให้เชื่อมกระเป๋า เซ็นข้อความ อนุมัติโทเคน หรือให้ข้อมูลลับ. การกระทำเหล่านี้อาจทำให้สูญเสียสินทรัพย์ได้. Long-Check ไม่สามารถยืนยันว่าเป็นสแกมได้ 100%.",
    [RISK_LEVELS.MEDIUM]:
      "ข้อความมีสัญญาณที่ควรระวัง เช่น ลิงก์ แอร์ดรอป หรือข้อเสนอรางวัล. ยังไม่มีข้อมูลพอจะยืนยันแหล่งที่มาได้ชัดเจน. ควรตรวจสอบจากช่องทางทางการก่อนดำเนินการ.",
    [RISK_LEVELS.LOW]:
      "ข้อความดูเหมือนเน้นการตรวจสอบจากแหล่งทางการมากกว่าการเร่งให้ทำธุรกรรม. ยังควรตรวจสอบโดเมนและรายละเอียดก่อนกดลิงก์หรือทำรายการ. หากมีการขอข้อมูลลับ ให้หยุดทันที."
  };

  const suggestionByRisk = {
    [RISK_LEVELS.HIGH]:
      "อย่าใส่ seed phrase/private key และอย่าเซ็นหรือ approve จนกว่าจะตรวจสอบแหล่งที่มาชัดเจน. เปิดเว็บจากช่องทางทางการด้วยตัวเองแทนการกดลิงก์ในข้อความ.",
    [RISK_LEVELS.MEDIUM]:
      "อย่ารีบกดลิงก์หรือเชื่อมกระเป๋า. ตรวจสอบประกาศจากเว็บไซต์หรือโซเชียลทางการก่อน.",
    [RISK_LEVELS.LOW]:
      "ตรวจสอบต่อจากเว็บไซต์หรือประกาศทางการ. หากมีหน้าต่างให้เซ็น อนุมัติโทเคน หรือใส่ข้อมูลลับ ให้หยุดก่อน."
  };

  return `Long-Check Risk Analysis

Risk Level: ${riskLevel}

Checklist:
- Seed phrase or private key requested: ${seedOrKey}
- Suspicious link or strange domain: ${suspiciousLink}
- Urgency or pressure: ${urgency}
- Token approval or wallet signature requested: ${walletAction}
- Official source verified: ${officialSource}
- Too-good-to-be-true reward: ${reward}

Reason:
${reasonByRisk[riskLevel]}

Suggestion:
${suggestionByRisk[riskLevel]}`;
}

async function analyzeRisk(userText) {
  const shouldUseMock = config.useMockLlm || !config.openai.apiKey;

  if (shouldUseMock) {
    return buildMockAnalysis(userText);
  }

  const openai = new OpenAI({ apiKey: config.openai.apiKey });
  const retrievedNotes = retrieveKnowledge(userText);

  const response = await openai.chat.completions.create({
    model: config.openai.model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Knowledge base notes:\n${formatKnowledgeNotes(retrievedNotes)}\n\nUser message:\n${userText}`
      }
    ]
  });

  return response.choices[0] && response.choices[0].message
    ? response.choices[0].message.content.trim()
    : buildMockAnalysis(userText);
}

module.exports = {
  analyzeRisk,
  buildMockAnalysis
};
