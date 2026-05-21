const { analyzeRisk } = require("./riskAnalyzer");
const config = require("../../src/shared/config");
const { unloadLocalModel } = require("./localQwenClient");

const cases = [
  {
    name: "Thai high-risk airdrop message",
    text: "ด่วน! รับแอร์ดรอปภายใน 10 นาที คลิก bit.ly/claim แล้ว connect wallet จากนั้น approve token เพื่อรับรางวัล"
  },
  {
    name: "Thai-English sign message example",
    text: "โปรด connect wallet และ sign message เพื่อ verify account ของคุณ ห้ามพลาด reward รอบนี้"
  },
  {
    name: "Medium-risk Discord NFT message",
    text: "มี Discord DM บอกว่าได้ free NFT จาก unknown source ให้กดลิงก์แปลกเพื่อ claim"
  },
  {
    name: "Low-risk official source verification message",
    text: "ควรตรวจสอบจากแหล่งทางการและ official website ก่อนทำรายการทุกครั้ง"
  }
];

async function main() {
  console.log("Long-Check analyzer manual tests");
  console.log("================================");

  for (const testCase of cases) {
    console.log(`\n--- ${testCase.name} ---`);
    console.log(`Input: ${testCase.text}\n`);
    const result = await analyzeRisk(testCase.text);
    console.log(result);
  }

  if (!config.useMockLlm && process.env.OLLAMA_UNLOAD_AFTER_TEST !== "false") {
    await unloadLocalModel({
      baseUrl: config.localLlm.baseUrl,
      model: config.localLlm.model
    });
    console.log(`\n[long-check] Unloaded local model from Ollama: ${config.localLlm.model}`);
  }
}

main().catch((error) => {
  console.error("Analyzer test failed:", error);
  process.exit(1);
});
