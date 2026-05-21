const assert = require("assert");
const { analyzeRisk } = require("./riskAnalyzer");
const config = require("../../src/shared/config");
const { unloadLocalModel } = require("./localQwenClient");

async function runCase(name, userText, options, expectedMode) {
  console.log(`\n--- ${name} ---`);
  console.log(`Input: ${userText}\n`);
  const result = await analyzeRisk(userText, options);
  console.log(result.reply);
  console.log(`\nMode: ${result.mode}`);
  assert.strictEqual(result.mode, expectedMode);
  return result;
}

async function main() {
  console.log("Long-Check conversational analyzer tests");
  console.log("========================================");

  await runCase(
    "High-risk message produces FINAL_SUMMARY immediately",
    "ด่วน! รับแอร์ดรอปภายใน 10 นาที คลิก bit.ly/claim แล้ว connect wallet จากนั้น approve token เพื่อรับรางวัล",
    {
      history: [
        {
          role: "user",
          content: "ด่วน! รับแอร์ดรอปภายใน 10 นาที คลิก bit.ly/claim แล้ว connect wallet จากนั้น approve token เพื่อรับรางวัล"
        }
      ],
      questionCount: 0,
      userMessageCount: 1
    },
    "FINAL_SUMMARY"
  );

  await runCase(
    "Incomplete airdrop message asks one follow-up",
    "มีคนบอกว่าได้ airdrop แต่ยังไม่แน่ใจ",
    {
      history: [
        {
          role: "user",
          content: "มีคนบอกว่าได้ airdrop แต่ยังไม่แน่ใจ"
        }
      ],
      questionCount: 0,
      userMessageCount: 1
    },
    "ASK_FOLLOW_UP"
  );

  await runCase(
    "User answer after follow-up produces FINAL_SUMMARY",
    "มาจาก DM คนแปลกหน้าครับ",
    {
      history: [
        {
          role: "user",
          content: "มีคนบอกว่าได้ airdrop แต่ยังไม่แน่ใจ"
        },
        {
          role: "assistant",
          content: "ลิงก์หรือข้อความนี้มาจากช่องทาง official ของโปรเจกต์ หรือมาจาก DM/คนแปลกหน้าครับ?"
        },
        {
          role: "user",
          content: "มาจาก DM คนแปลกหน้าครับ"
        }
      ],
      questionCount: 1,
      userMessageCount: 2
    },
    "FINAL_SUMMARY"
  );

  await runCase(
    "User types สรุป and gets FINAL_SUMMARY",
    "สรุป",
    {
      history: [
        {
          role: "user",
          content: "มีคนบอกว่าได้ airdrop แต่ยังไม่แน่ใจ"
        },
        {
          role: "user",
          content: "สรุป"
        }
      ],
      questionCount: 1,
      userMessageCount: 2,
      forceSummary: true
    },
    "FINAL_SUMMARY"
  );

  await runCase(
    "Relevant safety question gets ANSWER_AND_CONTINUE",
    "ควรเช็กเว็บ official ยังไงให้ปลอดภัยครับ",
    {
      history: [
        {
          role: "user",
          content: "ควรเช็กเว็บ official ยังไงให้ปลอดภัยครับ"
        }
      ],
      questionCount: 0,
      userMessageCount: 1
    },
    "ANSWER_AND_CONTINUE"
  );

  await runCase(
    "Unrelated message gets OUT_OF_SCOPE",
    "วันนี้กินอะไรดีครับ",
    {
      history: [
        {
          role: "user",
          content: "วันนี้กินอะไรดีครับ"
        }
      ],
      questionCount: 0,
      userMessageCount: 1
    },
    "OUT_OF_SCOPE"
  );

  await runCase(
    "MAX_USER_MESSAGES forces FINAL_SUMMARY",
    "ยังไม่แน่ใจครับ",
    {
      history: [
        {
          role: "user",
          content: "ยังไม่แน่ใจครับ"
        }
      ],
      questionCount: 0,
      userMessageCount: 6,
      maxUserMessages: 6
    },
    "FINAL_SUMMARY"
  );

  await runCase(
    "MAX_FOLLOW_UP_QUESTIONS forces FINAL_SUMMARY",
    "มีคนบอกว่าได้ airdrop แต่ยังไม่แน่ใจ",
    {
      history: [
        {
          role: "user",
          content: "มีคนบอกว่าได้ airdrop แต่ยังไม่แน่ใจ"
        }
      ],
      questionCount: 2,
      userMessageCount: 3,
      maxFollowUpQuestions: 2
    },
    "FINAL_SUMMARY"
  );

  if (!config.useMockLlm && process.env.OLLAMA_UNLOAD_AFTER_TEST !== "false") {
    await unloadLocalModel({
      baseUrl: config.localLlm.baseUrl,
      model: config.localLlm.model
    });
    console.log(`\n[long-check] Unloaded local model from Ollama: ${config.localLlm.model}`);
  }

  console.log("\nAll conversational analyzer tests passed.");
}

main().catch((error) => {
  console.error("Analyzer test failed:", error);
  process.exit(1);
});
