const knowledgeBase = require("./knowledgeBase.json");

function retrieveKnowledge(userText) {
  const text = String(userText || "").toLowerCase();

  return knowledgeBase
    .filter((entry) =>
      entry.keywords.some((keyword) => text.includes(String(keyword).toLowerCase()))
    )
    .map((entry) => ({
      id: entry.id,
      risk: entry.risk,
      note: entry.note
    }));
}

function formatKnowledgeNotes(notes) {
  if (!notes.length) {
    return "No specific knowledge base notes matched. Use the general Long-Check checklist.";
  }

  return notes.map((note) => `- [${note.risk}] ${note.note}`).join("\n");
}

module.exports = {
  retrieveKnowledge,
  formatKnowledgeNotes
};
