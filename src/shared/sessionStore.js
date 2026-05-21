const MAX_FOLLOW_UP_QUESTIONS = 2;
const MAX_USER_MESSAGES = 6;
const SESSION_TTL_MINUTES = 30;
const MAX_HISTORY_MESSAGES_SENT_TO_LLM = 10;

const sessions = new Map();

function now() {
  return Date.now();
}

function createSession(userId) {
  const timestamp = now();
  return {
    userId,
    messages: [],
    questionCount: 0,
    userMessageCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function isSessionExpired(session) {
  if (!session) {
    return true;
  }

  const ttlMs = SESSION_TTL_MINUTES * 60 * 1000;
  return now() - session.updatedAt > ttlMs;
}

function resetSession(userId) {
  const session = createSession(userId);
  sessions.set(userId, session);
  return session;
}

function getSession(userId) {
  const existingSession = sessions.get(userId);

  if (!existingSession || isSessionExpired(existingSession)) {
    return resetSession(userId);
  }

  return existingSession;
}

function addMessage(userId, role, content) {
  const session = getSession(userId);
  session.messages.push({
    role,
    content,
    timestamp: now()
  });

  if (role === "user") {
    session.userMessageCount += 1;
  }

  session.updatedAt = now();
  return session;
}

function incrementQuestionCount(userId) {
  const session = getSession(userId);
  session.questionCount += 1;
  session.updatedAt = now();
  return session;
}

function shouldForceSummary(session) {
  return Boolean(session && session.userMessageCount >= MAX_USER_MESSAGES);
}

function getRecentHistory(userId, limit = MAX_HISTORY_MESSAGES_SENT_TO_LLM) {
  const session = getSession(userId);
  const maxMessages = Math.min(limit, MAX_HISTORY_MESSAGES_SENT_TO_LLM);
  return session.messages.slice(-maxMessages);
}

function cleanupOldSessions() {
  for (const [userId, session] of sessions.entries()) {
    if (isSessionExpired(session)) {
      sessions.delete(userId);
    }
  }
}

module.exports = {
  MAX_FOLLOW_UP_QUESTIONS,
  MAX_USER_MESSAGES,
  SESSION_TTL_MINUTES,
  MAX_HISTORY_MESSAGES_SENT_TO_LLM,
  getSession,
  addMessage,
  incrementQuestionCount,
  resetSession,
  isSessionExpired,
  shouldForceSummary,
  getRecentHistory,
  cleanupOldSessions
};
