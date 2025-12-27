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

class HttpError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export default {
    async fetch(request, env): Promise<Response> {
        try {
            authenticate(request, env);
            ensureSupportedMethod(request);

            const requestData = await parseRequestData(request);
            const text = buildSlackText(requestData);
            if (!text) {
                throw new HttpError(400, "Missing server event details or 'text' parameter");
            }

            await sendToSlack(env.SLACK_WEBHOOK_URL, text);

            return new Response(null, { status: 204 });
        } catch (error) {
            if (error instanceof HttpError) {
                return new Response(error.message, { status: error.status });
            }
            throw error;
        }
    },
} satisfies ExportedHandler<Env>;

function authenticate(request: Request, env: Env): void {
    const providedPassword = request.headers.get("x-shared-password");
    if (!providedPassword || providedPassword !== env.SHARED_PASSWORD) {
        throw new HttpError(401, "Unauthorized");
    }
}

function ensureSupportedMethod(request: Request): void {
    if (request.method !== "POST") {
        throw new HttpError(405, "Only POST is supported.");
    }
}

async function parseRequestData(request: Request): Promise<RequestData> {
    const url = new URL(request.url);
    const search = url.searchParams;

    let body: Record<string, unknown> | null = null;
    const contentType = request.headers.get("content-type") || "";
    const isJsonBody = contentType.toLowerCase().includes("application/json");

    if (request.method === "POST" && isJsonBody) {
        try {
            body = await request.json<Record<string, unknown>>();
        } catch {
            throw new HttpError(400, "Invalid JSON body");
        }
    }

    const data: RequestData = {
        event: String(body?.event ?? search.get("event") ?? "").toLowerCase() || undefined,
        host: String(body?.host ?? search.get("host") ?? "").trim() || undefined,
        text: String(body?.text ?? search.get("text") ?? "").trim() || undefined,
    };

    return data;
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
): Promise<void> {
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
        throw new HttpError(
            502,
            `Slack error: ${slackResponse.status} ${slackResponse.statusText} - ${errText}`
        );
    }
}
