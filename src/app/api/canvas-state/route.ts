import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { CanvasState } from '@/types';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'canvas-state.json');

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

export async function GET() {
    try {
        const content = await fs.readFile(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        if (!isValidCanvasState(parsed)) {
            return NextResponse.json(EMPTY_STATE);
        }
        return NextResponse.json({
            ...parsed,
            contextBuffer: Array.isArray(parsed.contextBuffer) ? parsed.contextBuffer : [],
        } satisfies CanvasState);
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

        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(STATE_FILE, JSON.stringify(payload), 'utf-8');

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json(
            { error: 'Failed to save canvas state' },
            { status: 500 }
        );
    }
}
