# LINE Setup Notes

## LINE Setup Checklist

- Create or open a LINE Official Account.
- Create a Messaging API channel in the LINE Developers Console.
- Copy the channel access token into `LINE_CHANNEL_ACCESS_TOKEN`.
- Copy the channel secret into `LINE_CHANNEL_SECRET`.
- Set the webhook URL to `https://YOUR_DOMAIN/webhook`.
- Enable webhook use in the LINE Developers Console.
- Disable auto-reply messages if they interfere with the demo.

## Local Development Notes

- The server can run without LINE keys.
- If keys are missing, replies are logged to the terminal.
- `/health` should return `{ "status": "ok", "project": "long-check" }`.

## Webhook Testing Checklist

- Start the server with `npm start`.
- Confirm `GET /health` returns ok.
- Send a sample text message through LINE or a webhook simulator.
- Confirm the server logs one received LINE event.
- Confirm the reply contains `Long-Check Risk Analysis`.
- Test a non-text event and confirm the text-only MVP message appears.

## ngrok or Deployment Notes

- For local demos, run `ngrok http 3000` and copy the HTTPS forwarding URL.
- Set the LINE webhook URL to `https://YOUR_NGROK_URL/webhook`.
- If deployed, set `PORT`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, and optional `OPENAI_API_KEY` in the hosting platform.
- Keep `USE_MOCK_LLM=true` for the safest demo path unless the OpenAI key is configured and tested.
- After changing the webhook URL, use the LINE Developers Console verify button.
