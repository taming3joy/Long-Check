const readline = require("readline");
const { analyzeRiskDetailed } = require("./riskAnalyzer");
const { redactSecrets } = require("./redactor");

const demoCases = [
  {
    name: "Case 1: Seed phrase request",
    text: "Please send your 12-word recovery phrase to verify wallet."
  },
  {
    name: "Case 2: Airdrop + wallet connect + approve",
    text: "Claim free SEABW now. Connect wallet and approve before midnight: https://seabw-claim-airdrop.xyz"
  },
  {
    name: "Case 3: Guaranteed investment profit + deposit",
    text: "Guaranteed 20% daily profit. Deposit USDT now."
  },
  {
    name: "Case 4: Support impersonation asking to transfer funds",
    text: "I am support. Move your funds to this safe wallet."
  },
  {
    name: "Case 5: Educational / Low Risk question",
    text: "What is a hardware wallet?"
  },
  {
    name: "Case 6: User secret leakage (BIP-39 mnemonic input)",
    text: "help me, my seed phrase is apple banana cherry dog elephant fox grape house iron jewel kettle lemon"
  }
];

async function runDemo() {
  console.log("\n==========================================");
  console.log("RUNNING DEMO TEST CASES");
  console.log("==========================================\n");

  for (const tc of demoCases) {
    console.log(`--- ${tc.name} ---`);
    console.log(`Input: "${tc.text}"`);
    console.log("------------------------------------------");
    const result = await analyzeRiskDetailed(tc.text);
    printResult(result);
    console.log("\n==========================================\n");
  }
  process.exit(0);
}

function printResult(result) {
  console.log(`Intent Detected: ${result.intent}`);
  console.log(`Language:        ${result.language}`);
  console.log(`Risk Score:      ${result.risk_score}/20`);
  console.log(`Risk Level:      ${result.risk_level}`);
  console.log("");
  console.log(`Summary/Reason:`);
  console.log(result.summary);
  console.log("");
  
  if (result.detected_flags && result.detected_flags.length > 0) {
    console.log("Detected Flags:");
    result.detected_flags.forEach(f => {
      console.log(`  - [${f.flag_id}] ${f.label} (Score: ${f.score})`);
    });
    console.log("");
  }

  console.log("Recommended Actions (Do):");
  result.recommended_actions.forEach(a => console.log(`  ✓ ${a}`));
  console.log("");
  
  console.log("Warnings (Don't):");
  result.do_not_do.forEach(d => console.log(`  ✗ ${d}`));
  console.log("");

  if (result.follow_up_question) {
    console.log(`Follow-up Question: ${result.follow_up_question}`);
    if (result.quick_replies && result.quick_replies.length > 0) {
      console.log(`Quick Replies: [${result.quick_replies.join("] [")}]`);
    }
    console.log("");
  }

  console.log("------------------------------------------");
  console.log("FINAL LINE BOT CHAT MESSAGE REPLY:");
  console.log("------------------------------------------");
  console.log(result.line_reply_text);
}

function startInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("\n==========================================");
  console.log("LONGCHECK INTERACTIVE TRIAGE SIMULATOR");
  console.log("==========================================");
  console.log("Type your message and press Enter.");
  console.log("Type 'demo' to run preset test cases.");
  console.log("Type 'exit' or 'quit' to close.");
  console.log("==========================================\n");

  const promptUser = () => {
    rl.question("LongCheck> ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        promptUser();
        return;
      }

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        rl.close();
        return;
      }

      if (trimmed.toLowerCase() === "demo") {
        rl.close();
        await runDemo();
        return;
      }

      console.log("\nAnalyzing...\n");
      try {
        const result = await analyzeRiskDetailed(trimmed);
        printResult(result);
      } catch (err) {
        console.error("Analysis error:", err);
      }
      console.log("\n==========================================\n");
      promptUser();
    });
  };

  promptUser();
}

// Parse args
const args = process.argv.slice(2);
if (args.includes("--demo")) {
  runDemo();
} else {
  startInteractive();
}
