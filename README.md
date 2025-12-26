# Cloudflare Worker for Slack

This repo contains a Cloudflare Worker script to send notifications to Slack.

## Configuration

Set Slack incoming webhook URL (requires previous call to `npm install`):

```sh
npx wrangler secret put SLACK_WEBHOOK_URL
npx wrangler secret put SHARED_PASSWORD
```

Clients must include the shared password in the `X-Shared-Password` HTTP header on every request.

## Deployment

Deploy via (requires previous call to `npm install`):

```sh
npx wrangler deploy
```

## Local test script

Use `./send-notification.sh <subdomain> 'Hello from test'` to hit the deployed worker at `https://notify.<subdomain>.workers.dev`. The script prompts for the shared password before sending.

## Usage

Send a structured server event (recommended):

```sh
curl -sS --fail-with-body \
  -X POST \
  -H "X-Shared-Password: ${PASSWORD}" \
  "https://notify.${SUBDOMAIN}.workers.dev?event=startup&host=$(hostname -f)"
```

Parameters:

* `event`: `startup` or `shutdown` (lowercase)
* `host`: server name/hostname
* `text`: optional raw message; if present, it bypasses the structured format

Simple text-only notification:

```sh
curl -sS --fail-with-body \
  -X POST \
  -G --data-urlencode "text=hello world" \
  -H "X-Shared-Password: ${PASSWORD}" \
  "https://notify.${SUBDOMAIN}.workers.dev"
```

### Debian systemd hook example

Drop a tiny helper (e.g., `/usr/local/bin/notify-server-state`) and mark it executable:

```sh
#!/usr/bin/env bash
set -euo pipefail
EVENT="$1"
PASSWORD="...shared password..."
WORKER_URL="https://notify.${SUBDOMAIN}.workers.dev"
curl -sS --fail-with-body \
  -H "X-Shared-Password: ${PASSWORD}" \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"${EVENT}\",\"host\":\"$(hostname -f)\"}" \
  "${WORKER_URL}"
```

`/etc/systemd/system/server-state-notify.service`:

```
[Unit]
Description=Notify Slack on startup/shutdown
DefaultDependencies=no
After=network-online.target
Before=shutdown.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/notify-server-state startup
ExecStop=/usr/local/bin/notify-server-state shutdown

[Install]
WantedBy=multi-user.target
```

Enable with `sudo systemctl enable server-state-notify.service`.

## Details

* [Slack App](https://api.slack.com/apps/A0A53D8SYJ3): this app is used to send notifications
  * [Via Incoming Webhooks](https://api.slack.com/apps/A0A53D8SYJ3/incoming-webhooks): the worker script uses webhooks to send messages
    * [Documentation on Incoming Webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks)
  * [Messaging Format](https://docs.slack.dev/messaging/)
* [Cloudflare Worker](https://developers.cloudflare.com/workers/get-started/guide/)
