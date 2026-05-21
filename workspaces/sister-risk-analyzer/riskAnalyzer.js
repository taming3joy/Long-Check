require("dotenv").config();

const OpenAI = require("openai");
const config = require("../../src/shared/config");
const { RISK_LEVELS } = require("../../src/shared/riskLevels");
const { SYSTEM_PROMPT, buildUserPrompt } = require("./prompt");
const { redactSecrets } = require("./redactor");
const rules = require("./rules.json");

// Helper to determine risk level based on score & flags
function calculateRiskLevel(score, forceHigh) {
  if (forceHigh || score >= 7) {
    return RISK_LEVELS.HIGH;
  } else if (score >= 3) {
    return RISK_LEVELS.MEDIUM;
  } else {
    return RISK_LEVELS.LOW;
  }
}

// Deterministic Rule Engine
function evaluateRules(text) {
  let score = 0;
  let forceHigh = false;
  const matchedFlags = [];
  const normalizedText = String(text || "").toLowerCase();

  // Run through rules.json
  for (const rule of rules) {
    let matched = false;
    if (rule.pattern_type === "regex") {
      matched = rule.patterns.some((pattern) => {
        try {
          return new RegExp(pattern, "i").test(normalizedText);
        } catch (e) {
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

  // Synergy Calculations
  const hasAirdrop = matchedFlags.some(f => f.category === "airdrop");
  const hasApproval = matchedFlags.some(f => f.category === "approval" && f.id !== "R008");
  const hasUnlimitedApproval = matchedFlags.some(f => f.id === "R008");
  const hasUrgency = matchedFlags.some(f => f.category === "urgency");
  const hasSecret = matchedFlags.some(f => f.category === "secret");
  const hasSupport = matchedFlags.some(f => f.category === "support" && f.id === "R010");
  const hasSafeTransfer = matchedFlags.some(f => f.id === "R011");
  const hasInvestment = matchedFlags.some(f => f.category === "investment");
  const hasDomain = matchedFlags.some(f => f.category === "domain");

  // Airdrop + Wallet Approval (Common scam setup)
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

  // Airdrop + Urgency
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

  // Support DM + Secret Request
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

  // Guaranteed Investment + Deposit/Safe Transfer
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

  // Airdrop + Approval + Unknown Domain
  if (hasAirdrop && hasApproval && hasDomain) {
    forceHigh = true;
  }

  const riskLevel = calculateRiskLevel(score, forceHigh);

  return {
    risk_score: Math.min(score, 20),
    risk_level: riskLevel,
    flags: matchedFlags
  };
}

// Fallback response compiler
function buildMockAnalysis(redactedText, ruleResult) {
  const riskSymbol = ruleResult.risk_level === RISK_LEVELS.HIGH ? "⚠️ ลองเช็คพบความเสี่ยงสูงมากครับ" : (ruleResult.risk_level === RISK_LEVELS.MEDIUM ? "🔍 ลองเช็คพบความเสี่ยงปานกลางครับ" : "✅ ลองเช็คแล้วปลอดภัยในเบื้องต้นครับ");
  
  let lines = [];
  lines.push(`${riskSymbol}`);
  lines.push("");
  
  if (ruleResult.flags.length > 0) {
    lines.push("สาเหตุที่ทำให้ดูน่าสงสัยนะครับ/คะ:");
    ruleResult.flags.forEach(f => {
      lines.push(`• ${f.explanation_th}`);
    });
  } else {
    lines.push("จากข้อความ ไม่พบสัญญาณอันตรายที่ชัดเจนครับ");
  }
  
  lines.push("");
  lines.push("💡 สิ่งที่แนะนำให้ทำเพื่อความปลอดภัย:");
  if (ruleResult.risk_level === RISK_LEVELS.HIGH) {
    lines.push("• ขอแนะนำให้หยุดทำรายการทุกอย่างบนกระเป๋าเงินทันทีครับ");
    lines.push("• รบกวนตรวจสอบประกาศแจ้งเตือนจากช่องทางที่เป็นทางการเท่านั้นนะครับ");
  } else if (ruleResult.risk_level === RISK_LEVELS.MEDIUM) {
    lines.push("• รบกวนตรวจสอบความถูกต้องของเว็บไซต์และผู้ส่งก่อนดำเนินการต่อนะครับ");
    lines.push("• อย่าเพิ่งด่วนเชื่อมต่อ wallet หรือกดยืนยันใดๆ นะครับ");
  } else {
    lines.push("• ควรสังเกตชื่อโดเมน URL ให้แน่ใจก่อนกรอกข้อมูลหรือกดลิงก์ครับ");
    lines.push("• เพื่อความชัวร์ แนะนำให้ยืนยันข้อมูลผ่านช่องทางการของโปรเจกต์เสมอนะครับ");
  }
  
  lines.push("");
  lines.push("🛑 สิ่งที่ควรหลีกเลี่ยงอย่างยิ่ง:");
  lines.push("• ไม่ส่ง seed phrase หรือ private key ให้ผู้ใดในทุกกรณีครับ");
  if (ruleResult.risk_level === RISK_LEVELS.HIGH || ruleResult.risk_level === RISK_LEVELS.MEDIUM) {
    lines.push("• หลีกเลี่ยงการเซ็นอนุมัติ token approval หรือเซ็นธุรกรรมที่ไม่น่าไว้วางใจครับ");
  }

  return lines.join("\n");
}

// Main Analyze Risk function called by Express webhook
async function analyzeRisk(userText) {
  // 1. Secret Redaction
  const redaction = redactSecrets(userText);

  // 2. Run Deterministic Rule Engine
  const ruleResult = evaluateRules(redaction.redactedText);

  // If secret detected, trigger immediate High Risk override response bypass
  if (redaction.secretDetected) {
    const criticalResult = {
      risk_score: 20,
      risk_level: RISK_LEVELS.HIGH,
      flags: [{
        id: "R000",
        explanation_th: `ตรวจพบข้อมูลลับส่วนตัวในข้อความ (${redaction.secretsFound.join(", ")})`,
        explanation_en: `Detected sensitive wallet secrets in the text (${redaction.secretsFound.join(", ")})`
      }]
    };
    
    return `⚠️ ลองเช็คพบความเสี่ยงขั้นสูงสุดครับ!\n\n` +
           `ด้วยความเป็นห่วงจากเรา ขอเตือนความปลอดภัยสูงสุดดังนี้ครับ:\n` +
           `• ระบบตรวจพบว่าคุณอาจพิมพ์ข้อมูลความลับของกระเป๋าเงิน (${redaction.secretsFound.join(", ")})\n` +
           `• รบกวนอย่าส่งข้อมูลนี้ในแชทให้ใครเด็ดขาดเลยนะครับ\n` +
           `• หากคุณเผลอส่งข้อมูลนี้ไปในเว็บอื่นหรือให้คนอื่นแล้ว ขอให้ถือว่ากระเป๋าเงินนั้นไม่ปลอดภัยและเสี่ยงถูกขโมยสินทรัพย์ทันทีครับ\n` +
           `• ขอแนะนำให้โอนสินทรัพย์ทั้งหมดไปยังกระเป๋าเงินใหม่ที่ปลอดภัยโดยด่วนที่สุด และเลิกใช้กระเป๋าเงินเดิมครับ`;
  }

  // 3. Determine if we should call LLM
  // Fallback to mock mode if explicitly configed or OpenAI API details are missing
  const isOllamaMockMode = config.useMockLlm;
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
  const ollamaModel = process.env.OLLAMA_MODEL || "qwen3:4b";

  if (isOllamaMockMode) {
    return buildMockAnalysis(redaction.redactedText, ruleResult);
  }

  try {
    // Connect to Local Ollama using OpenAI JS SDK compatibility
    const client = new OpenAI({
      baseURL: ollamaBaseUrl,
      apiKey: "ollama" // Non-empty key for the SDK
    });

    const userPrompt = buildUserPrompt(redaction.redactedText, ruleResult);

    const response = await client.chat.completions.create({
      model: ollamaModel,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    const responseText = response.choices[0] && response.choices[0].message
      ? response.choices[0].message.content.trim()
      : "";

    if (responseText) {
      const resultObj = JSON.parse(responseText);
      
      // Update/Ensure the final reply text is populated
      if (resultObj.line_reply_text) {
        return resultObj.line_reply_text;
      }
    }
    
    return buildMockAnalysis(redaction.redactedText, ruleResult);
  } catch (error) {
    console.warn("[long-check] Local LLM connection failed. Falling back to deterministic rule engine.", error.message);
    // Silent recovery: use deterministic engine output
    return buildMockAnalysis(redaction.redactedText, ruleResult);
  }
}

// Detailed analysis export for simulator/debugging
async function analyzeRiskDetailed(userText) {
  const redaction = redactSecrets(userText);
  const ruleResult = evaluateRules(redaction.redactedText);

  if (redaction.secretDetected) {
    const summary = `⚠️ CRITICAL RISK: Detected secret leakage (${redaction.secretsFound.join(", ")})`;
    return {
      intent: "check_message",
      language: "mixed",
      risk_level: RISK_LEVELS.HIGH,
      risk_score: 20,
      summary: summary,
      detected_flags: [{
        flag_id: "secret_leakage",
        label: "ข้อมูลความลับรั่วไหล",
        evidence: "[REDACTED_SECRET]",
        score: 10
      }],
      recommended_actions: [
        "โอนสินทรัพย์ทั้งหมดไปยังกระเป๋าเงินใหม่ทันที",
        "ห้ามกรอกข้อมูลลับนี้ในหน้าเว็บใดๆ อีก"
      ],
      do_not_do: [
        "อย่าส่งรหัสหรือคีย์ให้ผู้อื่นเด็ดขาด"
      ],
      follow_up_question: null,
      line_reply_text: `⚠️ ลองเช็คพบความเสี่ยงขั้นสูงสุดครับ!\n\n` +
        `ด้วยความเป็นห่วงจากเรา ขอเตือนความปลอดภัยสูงสุดดังนี้ครับ:\n` +
        `• ระบบตรวจพบว่าคุณอาจพิมพ์ข้อมูลความลับของกระเป๋าเงิน (${redaction.secretsFound.join(", ")})\n` +
        `• รบกวนอย่าส่งข้อมูลนี้ในแชทให้ใครเด็ดขาดเลยนะครับ\n` +
        `• หากคุณเผลอส่งข้อมูลนี้ไปในเว็บอื่นหรือให้คนอื่นแล้ว ขอให้ถือว่ากระเป๋าเงินนั้นไม่ปลอดภัยและเสี่ยงถูกขโมยสินทรัพย์ทันทีครับ\n` +
        `• ขอแนะนำให้โอนสินทรัพย์ทั้งหมดไปยังกระเป๋าเงินใหม่ที่ปลอดภัยโดยด่วนที่สุด และเลิกใช้กระเป๋าเงินเดิมครับ`
    };
  }

  const isOllamaMockMode = config.useMockLlm;
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
  const ollamaModel = process.env.OLLAMA_MODEL || "qwen3:4b";

  if (isOllamaMockMode) {
    return {
      intent: "check_message",
      language: "th",
      risk_level: ruleResult.risk_level,
      risk_score: ruleResult.risk_score,
      summary: `วิเคราะห์โดยใช้กลไกตรวจสอบเงื่อนไข (Rule Engine). พบสัญญาณความเสี่ยง ${ruleResult.flags.length} รายการ`,
      detected_flags: ruleResult.flags.map(f => ({
        flag_id: f.id,
        label: f.explanation_th,
        evidence: "matched pattern",
        score: f.weight
      })),
      recommended_actions: ruleResult.risk_level === RISK_LEVELS.HIGH 
        ? ["หยุดทำธุรกรรม", "เช็คช่องทางทางการหลัก"] 
        : ["ตรวจโดเมนก่อนกด", "เช็คประกาศทางการ"],
      do_not_do: ["ห้ามแชร์ seed phrase หรือ private key"],
      follow_up_question: null,
      quick_replies: ["Check another message", "Safety checklist"],
      line_reply_text: buildMockAnalysis(redaction.redactedText, ruleResult)
    };
  }

  try {
    const client = new OpenAI({
      baseURL: ollamaBaseUrl,
      apiKey: "ollama"
    });

    const userPrompt = buildUserPrompt(redaction.redactedText, ruleResult);

    const response = await client.chat.completions.create({
      model: ollamaModel,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    const responseText = response.choices[0] && response.choices[0].message
      ? response.choices[0].message.content.trim()
      : "";

    if (responseText) {
      const parsed = JSON.parse(responseText);
      // Ensure risk_level matches rule engine
      parsed.risk_level = ruleResult.risk_level;
      parsed.risk_score = ruleResult.risk_score;
      parsed.detected_flags = ruleResult.flags.map(f => ({
        flag_id: f.id,
        label: f.explanation_th,
        evidence: f.explanation_en,
        score: f.weight
      }));
      return parsed;
    }
  } catch (error) {
    console.warn("[long-check] Local LLM connection failed. Falling back.", error.message);
  }

  return {
    intent: "check_message",
    language: "th",
    risk_level: ruleResult.risk_level,
    risk_score: ruleResult.risk_score,
    summary: `Local LLM ไม่พร้อมใช้งาน จึงวิเคราะห์ผ่านกฎประเมิน (Rule Engine)`,
    detected_flags: ruleResult.flags.map(f => ({
      flag_id: f.id,
      label: f.explanation_th,
      evidence: f.explanation_en,
      score: f.weight
    })),
    recommended_actions: ["ระมัดระวังเป็นพิเศษ", "เช็คผ่าน official website เท่านั้น"],
    do_not_do: ["ห้ามบอก seed phrase หรือรหัสลับกับใคร"],
    follow_up_question: null,
    quick_replies: ["Check another message", "Safety checklist"],
    line_reply_text: buildMockAnalysis(redaction.redactedText, ruleResult)
  };
}

module.exports = {
  analyzeRisk,
  analyzeRiskDetailed,
  evaluateRules,
  buildMockAnalysis
};
