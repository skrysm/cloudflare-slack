# Cloudflare Worker for Slack

This repo contains a Cloudflare Worker script to send notifications to Slack.

## Deployment

Deploy via (requires previous call to `npm install`):

```sh
npx wrangler deploy
```

## Details

* [Slack App](https://api.slack.com/apps/A0A53D8SYJ3): this app is used to send notifications
  * [Via Incoming Webhooks](https://api.slack.com/apps/A0A53D8SYJ3/incoming-webhooks): the worker script uses webhooks to send messages
    * [Documentation on Incoming Webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks)
  * [Messaging Format](https://docs.slack.dev/messaging/)
* [Cloudflare Worker](https://developers.cloudflare.com/workers/get-started/guide/)
