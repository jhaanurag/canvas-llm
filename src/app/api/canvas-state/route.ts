import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { CanvasState } from '@/types';
import { ConvexHttpClient } from 'convex/browser';
import type { FunctionReference } from 'convex/server';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'canvas-state.json');
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;

const EMPTY_STATE: CanvasState = {
    nodes: [],
    connections: [],
    contextBuffer: [],
};

const isValidCanvasState = (value: unknown): value is CanvasState => {
    if (!value || typeof value !== 'object') return false;
    const maybeState = value as Partial<CanvasState>;
    return Array.isArray(maybeState.nodes) && Array.isArray(maybeState.connections);
};

type CanvasStateMap = Record<string, CanvasState>;

const normalizeState = (value: unknown): CanvasState => {
    if (!isValidCanvasState(value)) return EMPTY_STATE;
    return {
        nodes: value.nodes,
        connections: value.connections,
        contextBuffer: Array.isArray(value.contextBuffer) ? value.contextBuffer : [],
    };
};

const readStateMap = async (): Promise<CanvasStateMap> => {
    try {
        const content = await fs.readFile(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as CanvasStateMap : {};
    } catch {
        return {};
    }
};

const writeStateMap = async (next: CanvasStateMap) => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(next), 'utf-8');
};

const getUserId = (request: Request) => {
    const url = new URL(request.url);
    return (url.searchParams.get('userId') || '').trim();
};

const tryConvexGetState = async (userId: string): Promise<CanvasState | null> => {
    if (!CONVEX_URL) return null;
    try {
        const client = new ConvexHttpClient(CONVEX_URL);
        const fn = 'canvas:getForUser' as unknown as FunctionReference<'query'>;
        const response = await client.query(fn, { userId }) as unknown;
        return normalizeState(response);
    } catch {
        return null;
    }
};

const tryConvexSaveState = async (userId: string, state: CanvasState): Promise<boolean> => {
    if (!CONVEX_URL) return false;
    try {
        const client = new ConvexHttpClient(CONVEX_URL);
        const fn = 'canvas:saveForUser' as unknown as FunctionReference<'mutation'>;
        await client.mutation(fn, { userId, state });
        return true;
    } catch {
        return false;
    }
};

export async function GET(request: Request) {
    const userId = getUserId(request);
    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const convexState = await tryConvexGetState(userId);
    if (convexState) {
        return NextResponse.json(convexState);
    }

    try {
        const stateMap = await readStateMap();
        return NextResponse.json(normalizeState(stateMap[userId]));
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            return NextResponse.json(EMPTY_STATE);
        }
        return NextResponse.json(
            { error: 'Failed to load canvas state' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const userId = getUserId(request);
    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    try {
        const body = await request.json();
        if (!isValidCanvasState(body)) {
            return NextResponse.json(
                { error: 'Invalid canvas payload' },
                { status: 400 }
            );
        }

        const payload: CanvasState = {
            nodes: body.nodes,
            connections: body.connections,
            contextBuffer: Array.isArray(body.contextBuffer) ? body.contextBuffer : [],
        };

        const didSaveToConvex = await tryConvexSaveState(userId, payload);
        if (!didSaveToConvex) {
            const stateMap = await readStateMap();
            stateMap[userId] = payload;
            await writeStateMap(stateMap);
        }

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json(
            { error: 'Failed to save canvas state' },
            { status: 500 }
        );
    }
}
