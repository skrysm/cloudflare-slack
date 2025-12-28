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

Send a structured server event:

```sh
curl -sS --fail-with-body \
  -H "X-Shared-Password: $PASSWORD" \
  -X POST \
  "https://notify.$SUBDOMAIN.workers.dev?event=startup&host=$(hostname -f)"
```

Parameters:

* `event`: `startup` or `shutdown` (lowercase)
* `host`: server name/hostname

Simple text-only notification:

```sh
curl -sS --fail-with-body \
  -H "X-Shared-Password: $PASSWORD" \
  -X POST \
  -G --data-urlencode "text=hello world" \
  "https://notify.$SUBDOMAIN.workers.dev"
```

Parameters:

* `text`: raw message (is ignored if `event` is present)
* `icon`: an icon to prepend to the text
* `host`: server name/hostname

### Debian systemd hook example

Drop this helper script (e.g., `/usr/local/bin/notify-server-state`) and mark it executable:

```sh
#!/usr/bin/env bash
set -euo pipefail

EVENT="$1"
PASSWORD="...shared password..."
WORKER_HOST="notify.$SUBDOMAIN.workers.dev"

MAX_WAIT_SECONDS=120    # overall max wait in seconds
SLEEP_STEP=1            # delay between attempts

has_default_route() {
    ip route show default 2>/dev/null | grep -q '^default '
}

can_resolve_dns() {
    # getent is nicer than `host`/`dig` because it respects /etc/nsswitch.conf
    getent hosts "$WORKER_HOST" >/dev/null 2>&1
}

can_ping_ip() {
    # -c1 - sends exactly 1 packet (count = 1)
    # -W2 - sets a 2-second timeout for waiting on replies
    ping -c1 -W2 "$WORKER_HOST" >/dev/null 2>&1
}

wait_for_internet() {
    # NOTE: $SECONDS is a special shell variable that contains the number of seconds to current script has run yet.
    local end=$((SECONDS + MAX_WAIT_SECONDS))

    while [ $SECONDS -lt $end ]; do
        # 1) Quick local check: do we even have a default route?
        if ! has_default_route; then
            sleep "$SLEEP_STEP"
            continue
        fi

        # 2) DNS check for the host you care about
        if ! can_resolve_dns; then
            sleep "$SLEEP_STEP"
            continue
        fi

        # 3) IP-level connectivity check (cheap ICMP)
        if ! can_ping_ip; then
            sleep "$SLEEP_STEP"
            continue
        fi

        # Network reachable
        return 0
    done

    # Timeout
    return 1
}

if [[ "$EVENT" == "startup" ]]; then
    echo "Checking for internet connectivity..."

    if ! wait_for_internet; then
        echo "Error: Internet (route+DNS+IP) not OK within ${MAX_WAIT}s" >&2
        exit 1
    fi
fi

echo "Sending Slack notification for event $EVENT..."

curl -sS --fail-with-body \
  -H "X-Shared-Password: $PASSWORD" \
  -X POST \
  "https://$WORKER_HOST?event=$EVENT&host=$(hostname -f)"

echo "SUCCESS"
```

`/etc/systemd/system/server-state-notify.service`:

```ini
[Unit]
Description=Notify Slack on startup/shutdown

# NOTE: We use "network.target" here - instead of "network-online.target" - because the latter usually
#   comes with a 2 minutes delay - but we want a notification as soon as the system is online again.
After=network.target
# This makes sure ExecStop is executed before the network is shut down.
Before=network-offline.target

[Service]
Type=oneshot

# Keep the service in state "active" so that "ExecStop" is not run immediately.
# Note that this does not(!) keep any process running.
RemainAfterExit=yes

# Slightly above MAX_WAIT_SECONDS so systemd doesn't kill us mid-check
TimeoutStartSec=150s

# Enable this for persistent logging, if necessary.
#StandardOutput=append:/var/log/server-state-notify.log
#StandardError=append:/var/log/server-state-notify.log

ExecStart=/usr/local/bin/notify-server-state startup
ExecStop=/usr/local/bin/notify-server-state shutdown

[Install]
WantedBy=multi-user.target
```

Enable with `sudo systemctl enable server-state-notify.service`.

## Details

* [Create Slack App with Incoming Webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks)
  * [Messaging Format](https://docs.slack.dev/messaging/)
* [Cloudflare Worker](https://developers.cloudflare.com/workers/get-started/guide/)
