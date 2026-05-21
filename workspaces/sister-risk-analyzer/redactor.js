const SEED_PHRASE_REGEX = /\b([a-zA-Z]{3,15}\s+){11,23}[a-zA-Z]{3,15}\b/gi;
const PRIVATE_KEY_REGEX = /\b(?:0x)?[a-fA-F0-9]{64}\b/g;
const GENERAL_OTP_KEYWORDS = [
  "otp", "2fa", "code", "pin", "verification", "auth",
  "รหัส", "โอทีพี", "ยืนยัน", "พิน"
];

function redactSecrets(userText) {
  if (!userText || typeof userText !== "string") {
    return {
      redactedText: userText || "",
      secretDetected: false,
      secretsFound: []
    };
  }

  let text = userText;
  let secretDetected = false;
  const secretsFound = [];

  // 1. Redact Private Keys (64 hex characters, optional 0x prefix)
  const pkMatches = text.match(PRIVATE_KEY_REGEX);
  if (pkMatches && pkMatches.length > 0) {
    text = text.replace(PRIVATE_KEY_REGEX, "[REDACTED_PRIVATE_KEY]");
    secretDetected = true;
    secretsFound.push("private_key");
  }

  // 2. Redact Seed Phrases (12 to 24 space-separated words)
  const seedMatches = text.match(SEED_PHRASE_REGEX);
  if (seedMatches && seedMatches.length > 0) {
    text = text.replace(SEED_PHRASE_REGEX, "[REDACTED_SEED_PHRASE]");
    secretDetected = true;
    secretsFound.push("seed_phrase");
  }

  // 3. Redact OTP/2FA (4 to 8 digit numbers, only if OTP keywords are present in text)
  const lowerText = text.toLowerCase();
  const hasOtpKeyword = GENERAL_OTP_KEYWORDS.some(kw => lowerText.includes(kw));
  if (hasOtpKeyword) {
    const OTP_REGEX = /\b\d{4,8}\b/g;
    const otpMatches = text.match(OTP_REGEX);
    if (otpMatches && otpMatches.length > 0) {
      text = text.replace(OTP_REGEX, "[REDACTED_OTP_CODE]");
      secretDetected = true;
      secretsFound.push("otp_code");
    }
  }

  return {
    redactedText: text,
    secretDetected,
    secretsFound
  };
}

module.exports = {
  redactSecrets
};
