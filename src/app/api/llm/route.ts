import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

const LOCAL_PROXY_URL = process.env.LLM_LOCAL_PROXY_URL;
const REMOTE_PROXY_URL = process.env.LLM_REMOTE_PROXY_URL;
const PROXY_API_KEY = process.env.LLM_PROXY_KEY;

/** Max request body size (256 KB) to prevent abuse. */
const MAX_BODY_SIZE = 256 * 1024;

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

function buildProxyUrl(baseUrl: string) {
    return `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
}

async function tryProxy(baseUrl: string, body: string) {
    return fetch(buildProxyUrl(baseUrl), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${PROXY_API_KEY}`,
        },
        body,
        cache: 'no-store',
    });
}

export async function POST(request: Request) {
    // ── Auth guard ──
    const { userId } = await auth();
    if (!userId) {
        return new Response('Authentication required', { status: 401 });
    }

    // ── Rate limiting ──
    if (isRateLimited(userId)) {
        return new Response('Rate limit exceeded. Please wait before sending more messages.', {
            status: 429,
            headers: { 'Retry-After': '60' },
        });
    }

    // ── Config check ──
    if (!LOCAL_PROXY_URL || !REMOTE_PROXY_URL || !PROXY_API_KEY) {
        return new Response(
            'LLM proxy is not configured. Set LLM_LOCAL_PROXY_URL, LLM_REMOTE_PROXY_URL, and LLM_PROXY_KEY.',
            { status: 500 }
        );
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

    // Validate it's at least well-formed JSON with a messages array
    try {
        const parsed = JSON.parse(requestBody);
        if (!parsed || typeof parsed !== 'object') {
            return new Response('Invalid request format', { status: 400 });
        }
        if (!Array.isArray(parsed.messages)) {
            return new Response('Missing or invalid "messages" field', { status: 400 });
        }
    } catch {
        return new Response('Invalid JSON in request body', { status: 400 });
    }

    // ── Proxy with fallback ──
    const targets = [LOCAL_PROXY_URL, REMOTE_PROXY_URL];
    const failures: string[] = [];

    for (const target of targets) {
        try {
            const response = await tryProxy(target, requestBody);

            if (response.ok && response.body) {
                return new Response(response.body, {
                    status: response.status,
                    headers: STREAM_HEADERS,
                });
            }

            const errorText = await response.text();
            const retryableStatus = response.status >= 500 || response.status === 429;
            failures.push(`${target} -> ${response.status}${errorText ? ` ${errorText}` : ''}`);

            if (!retryableStatus) {
                return new Response(errorText || `LLM proxy returned ${response.status}`, {
                    status: response.status,
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown connection error';
            failures.push(`${target} -> ${message}`);
        }
    }

    return new Response(
        `Unable to reach either LLM proxy. ${failures.join(' | ')}`,
        { status: 502 }
    );
}
