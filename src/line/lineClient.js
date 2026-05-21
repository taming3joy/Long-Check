const line = require("@line/bot-sdk");
const config = require("../shared/config");

const hasLineCredentials = Boolean(config.line.channelAccessToken && config.line.channelSecret);

if (!hasLineCredentials) {
  console.warn("[long-check] LINE credentials are missing. Replies will be logged instead of sent.");
}

const realClient = config.line.channelAccessToken
  ? new line.messagingApi.MessagingApiClient({
      channelAccessToken: config.line.channelAccessToken
    })
  : null;

async function replyText(replyToken, text) {
  const message = { type: "text", text };

  if (!realClient) {
    console.log("[long-check] Mock LINE reply:", { replyToken, message });
    return;
  }

  await realClient.replyMessage({
    replyToken,
    messages: [message]
  });
}

module.exports = {
  replyText,
  hasLineCredentials
};
