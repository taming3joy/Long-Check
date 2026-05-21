const LINE_TEXT_LIMIT = 4900;
const TRUNCATION_NOTICE = "\n\nข้อความถูกย่อเพื่อให้ส่งใน LINE ได้";

function formatForLine(text) {
  const safeText = String(text || "").trim() || "ลองเช็คไม่สามารถวิเคราะห์ข้อความนี้ได้";

  if (safeText.length <= LINE_TEXT_LIMIT) {
    return safeText;
  }

  const maxBodyLength = LINE_TEXT_LIMIT - TRUNCATION_NOTICE.length;
  return `${safeText.slice(0, maxBodyLength).trim()}${TRUNCATION_NOTICE}`;
}

module.exports = {
  formatForLine
};
