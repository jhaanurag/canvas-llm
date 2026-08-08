export const dynamic = 'force-dynamic';

// Long-lived GitHub OAuth token (never expires). Exchanged per-request for a
// short-lived (~25 min) Copilot session token — no disk/cache needed, so this
// runs fine as a stateless Vercel serverless function.
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_COPILOT_ACCESS_TOKEN;
const COPILOT_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token';
const DEFAULT_COPILOT_API_BASE = 'https://api.githubcopilot.com';

/**
 * Max request body size. Vercel's Node serverless functions hard-cap
 * request bodies at ~4.5 MB regardless of this value, so stay under that
 * so a too-large request fails with our message, not a platform 413.
 */
const MAX_BODY_SIZE = 4 * 1024 * 1024;

// ── Orchestration/subagent prompts ──
// Kept server-side only so this instruction text never appears in the
// browser's network tab or the client JS bundle. The client only sends a
// `promptMode` flag; this route splices the real instructions into the
// system message before forwarding to Copilot.
const ROUTER_SPAWN_SUFFIX = `

If the answer can be produced from the active conversation, answer normally.
If the user is asking for information that may only exist in offloaded memory, reply with exactly one line in this format and nothing else:
((ask_memory: short focused retrieval question))
Never expose or explain this syntax to the user.

If the user explicitly asks you to open, spawn, create, or make new chat windows/chats for deeper dives, or says "yes" after you offered deep-dive chat windows, reply with exactly one line in this format and nothing else:
((spawn_chats: [{"title":"Short title","prompt":"Prompt for the new chat"}]))
Use valid JSON. Keep titles short and prompts specific. Never expose or explain this syntax to the user.`;

const SPAWN_ONLY_SUFFIX = `

If the user explicitly asks you to open, spawn, create, or make new chat windows/chats for deeper dives, or says "yes" after you offered deep-dive chat windows, reply with exactly one line in this format and nothing else:
((spawn_chats: [{"title":"Short title","prompt":"Prompt for the new chat"}]))
Use valid JSON. Keep titles short and prompts specific. Never expose or explain this syntax to the user.`;

const POST_MEMORY_SUFFIX =
    '\n\nYou have already queried the memory subagent for this turn. Do not say you lack access to subagents or memory tools. Use the memory subagent result above if it helps answer the user.';

const MEMORY_SUBAGENT_PROMPT = `You are the memory subagent for one chat window.
You can only answer from the offloaded memory blocks provided to you.
Be concise and retrieval-focused.
If the answer is not present in memory, say exactly: NOT_FOUND`;

const PROMPT_MODE_SUFFIXES: Record<string, string> = {
    'router-spawn': ROUTER_SPAWN_SUFFIX,
    'spawn-only': SPAWN_ONLY_SUFFIX,
    'post-memory': POST_MEMORY_SUFFIX,
};

function applyPromptMode(parsed: { messages?: Array<{ role: string; content: unknown }>; promptMode?: string }) {
    const { promptMode, ...rest } = parsed;
    const messages = Array.isArray(rest.messages) ? rest.messages : [];
    const systemMessage = messages.find(m => m.role === 'system');

    if (promptMode === 'memory-subagent') {
        if (systemMessage) {
            systemMessage.content = MEMORY_SUBAGENT_PROMPT;
        } else {
            messages.unshift({ role: 'system', content: MEMORY_SUBAGENT_PROMPT });
        }
    } else if (promptMode && PROMPT_MODE_SUFFIXES[promptMode]) {
        const suffix = PROMPT_MODE_SUFFIXES[promptMode];
        if (systemMessage && typeof systemMessage.content === 'string') {
            systemMessage.content += suffix;
        } else if (systemMessage) {
            // multimodal content array on a system message shouldn't happen, but guard anyway
            messages.unshift({ role: 'system', content: suffix.trim() });
        } else {
            messages.unshift({ role: 'system', content: suffix.trim() });
        }
    }

    return { ...rest, messages };
}

const STREAM_HEADERS = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
} as const;

// ── Simple in-memory sliding-window rate limiter ──
// Limits each user to RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS.
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window

const requestLog = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = (requestLog.get(userId) ?? []).filter(t => t > windowStart);
    timestamps.push(now);
    requestLog.set(userId, timestamps);
    return timestamps.length > RATE_LIMIT_MAX;
}

// Periodically clean stale entries (every 5 min)
if (typeof globalThis !== 'undefined') {
    const CLEANUP_INTERVAL = 5 * 60_000;
    const cleanupKey = '__llm_rate_limit_cleanup';
    if (!(globalThis as Record<string, unknown>)[cleanupKey]) {
        (globalThis as Record<string, unknown>)[cleanupKey] = setInterval(() => {
            const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
            for (const [key, timestamps] of requestLog.entries()) {
                const valid = timestamps.filter(t => t > cutoff);
                if (valid.length === 0) {
                    requestLog.delete(key);
                } else {
                    requestLog.set(key, valid);
                }
            }
        }, CLEANUP_INTERVAL);
    }
}

async function mintCopilotToken(): Promise<{ token: string; apiBase: string }> {
    const response = await fetch(COPILOT_TOKEN_URL, {
        headers: {
            accept: 'application/json',
            authorization: `token ${GITHUB_ACCESS_TOKEN}`,
            'editor-version': 'vscode/1.85.1',
            'editor-plugin-version': 'copilot/1.155.0',
            'user-agent': 'GithubCopilot/1.155.0',
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Failed to mint Copilot session token: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    if (!data?.token) {
        throw new Error('Copilot token response missing "token" field');
    }

    return { token: data.token, apiBase: data?.endpoints?.api || DEFAULT_COPILOT_API_BASE };
}

function copilotHeaders(apiKey: string) {
    return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Copilot-Integration-Id': 'vscode-chat',
        'Editor-Version': 'vscode/1.97.2',
        'Editor-Plugin-Version': 'copilot-chat/0.26.7',
        'User-Agent': 'GitHubCopilotChat/0.26.7',
        'Openai-Intent': 'conversation-panel',
        'Copilot-Vision-Request': 'true',
        'X-Github-Api-Version': '2025-04-01',
        'X-Request-Id': crypto.randomUUID(),
    };
}

export async function POST(request: Request) {
    // ── Auth guard (TEMPORARILY DISABLED) ──
    // const { userId } = await auth();
    // if (!userId) {
    //     return new Response('Authentication required', { status: 401 });
    // }
    const userId = "temp-dev-user";

    // ── Rate limiting ──
    if (isRateLimited(userId)) {
        return new Response('Rate limit exceeded. Please wait before sending more messages.', {
            status: 429,
            headers: { 'Retry-After': '60' },
        });
    }

    // ── Config check ──
    if (!GITHUB_ACCESS_TOKEN) {
        return new Response('LLM proxy is not configured. Set GITHUB_COPILOT_ACCESS_TOKEN.', { status: 500 });
    }

    // ── Input validation ──
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (contentLength > MAX_BODY_SIZE) {
        return new Response('Request body too large', { status: 413 });
    }

    let requestBody: string;
    try {
        requestBody = await request.text();
    } catch {
        return new Response('Failed to read request body', { status: 400 });
    }

    if (requestBody.length > MAX_BODY_SIZE) {
        return new Response('Request body too large', { status: 413 });
    }

    // Validate it's at least well-formed JSON with a messages array, and
    // splice in the real orchestration/subagent prompt server-side.
    try {
        const parsed = JSON.parse(requestBody);
        if (!parsed || typeof parsed !== 'object') {
            return new Response('Invalid request format', { status: 400 });
        }
        if (!Array.isArray(parsed.messages)) {
            return new Response('Missing or invalid "messages" field', { status: 400 });
        }
        requestBody = JSON.stringify(applyPromptMode(parsed));
    } catch {
        return new Response('Invalid JSON in request body', { status: 400 });
    }

    // ── Mint a fresh short-lived Copilot session token and forward ──
    let session: { token: string; apiBase: string };
    try {
        session = await mintCopilotToken();
    } catch (error) {
        console.error('[Copilot Token Error]', error);
        return new Response('Failed to authenticate with GitHub Copilot.', { status: 502 });
    }

    try {
        const response = await fetch(`${session.apiBase.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: copilotHeaders(session.token),
            body: requestBody,
            cache: 'no-store',
        });

        if (!response.ok || !response.body) {
            const errorText = await response.text();
            return new Response(errorText || `Copilot returned ${response.status}`, { status: response.status });
        }

        return new Response(response.body, {
            status: response.status,
            headers: STREAM_HEADERS,
        });
    } catch (error) {
        console.error('[Copilot Proxy Error]', error);
        return new Response('The AI service is temporarily unavailable. Please try again in a moment.', { status: 502 });
    }
}
