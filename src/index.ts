/**
 * This is a Cloudflare Workers script.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export interface Env {
  SLACK_WEBHOOK_URL: string;
  SHARED_PASSWORD: string;
}

type RequestData = {
    event?: string;
    host?: string;
    text?: string;
};

type ParseResult =
    | { success: true; data: RequestData }
    | { success: false; response: Response };

type SlackSendResult =
    | { success: true }
    | { success: false; response: Response };

export default {
    async fetch(request, env): Promise<Response> {
        const authResponse = authenticate(request, env);
        if (authResponse) {
            return authResponse;
        }

        const methodResponse = ensureSupportedMethod(request);
        if (methodResponse) {
            return methodResponse;
        }

        const parseResult = await parseRequestData(request);
        if (!parseResult.success) {
            return parseResult.response;
        }

        const text = buildSlackText(parseResult.data);
        if (!text) {
            return new Response("Missing server event details or 'text' parameter", { status: 400 });
        }

        const slackResult = await sendToSlack(env.SLACK_WEBHOOK_URL, text);
        if (!slackResult.success) {
            return slackResult.response;
        }

        return new Response(null, { status: 204 });
    },
} satisfies ExportedHandler<Env>;

function authenticate(request: Request, env: Env): Response | null {
    const providedPassword = request.headers.get("x-shared-password");
    if (!providedPassword || providedPassword !== env.SHARED_PASSWORD) {
        return new Response("Unauthorized", { status: 401 });
    }
    return null;
}

function ensureSupportedMethod(request: Request): Response | null {
    if (request.method !== "POST") {
        return new Response("Only POST is supported.", { status: 405 });
    }
    return null;
}

async function parseRequestData(request: Request): Promise<ParseResult> {
    const url = new URL(request.url);
    const search = url.searchParams;

    let body: Record<string, unknown> | null = null;
    const contentType = request.headers.get("content-type") || "";
    const isJsonBody = contentType.toLowerCase().includes("application/json");

    if (request.method === "POST" && isJsonBody) {
        try {
            body = await request.json<Record<string, unknown>>();
        } catch {
            return { success: false, response: new Response("Invalid JSON body", { status: 400 }) };
        }
    }

    const data: RequestData = {
        event: String(body?.event ?? search.get("event") ?? "").toLowerCase() || undefined,
        host: String(body?.host ?? search.get("host") ?? "").trim() || undefined,
        text: String(body?.text ?? search.get("text") ?? "").trim() || undefined,
    };

    return { success: true, data };
}

function buildSlackText(data: RequestData): string | null {
    if (data.text) {
        return data.text;
    }

    if (data.event === "startup" || data.event === "shutdown") {
        const statusLine =
            data.event === "startup"
                ? `🟢 Server online: ${data.host}`
                : `🔴 Server shutting down: ${data.host}`;

        return statusLine;
    }

    return null;
}

async function sendToSlack(
    webhookUrl: string,
    text: string
): Promise<SlackSendResult> {
    const payload = {
        text,
    }
    const slackResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!slackResponse.ok) {
        const errText = await slackResponse.text();
        return {
            success: false,
            response: new Response(
                `Slack error: ${slackResponse.status} ${slackResponse.statusText} - ${errText}`,
                { status: 502 }
            ),
        };
    }

    return { success: true };
}
