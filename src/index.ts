/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export interface Env {
  SLACK_WEBHOOK_URL: string;
  SHARED_PASSWORD: string;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
        const providedPassword = request.headers.get("x-shared-password");
        if (!providedPassword || providedPassword !== env.SHARED_PASSWORD) {
            return new Response("Unauthorized", { status: 401 });
        }

        const url = new URL(request.url);
        let text: string | null = url.searchParams.get("text");
        if (!text) {
            return new Response("Missing 'text' parameter", { status: 400 });
        }

        // 3) Build Slack payload
        const payload = {
            text,
        };

        // 4) Send to Slack
        const slackResp = await fetch(env.SLACK_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!slackResp.ok) {
            const errText = await slackResp.text();
            return new Response(
                `Slack error: ${slackResp.status} ${slackResp.statusText} - ${errText}`,
                { status: 502 }
            );
        }

        // 5) Respond to caller with no body
        return new Response(null, { status: 204 });
    },
} satisfies ExportedHandler<Env>;
