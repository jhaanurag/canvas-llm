import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import type { FunctionReference } from 'convex/server';
import { v4 as uuidv4 } from 'uuid';
import type { UserSession } from '@/types';

type StoredUser = {
    id: string;
    username: string;
    createdAt: number;
};

const DATA_DIR = path.join(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;

const readUsers = async (): Promise<StoredUser[]> => {
    try {
        const raw = await fs.readFile(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeUsers = async (users: StoredUser[]) => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify(users), 'utf-8');
};

const tryConvexLogin = async (username: string): Promise<UserSession | null> => {
    if (!CONVEX_URL) return null;
    try {
        const client = new ConvexHttpClient(CONVEX_URL);
        const fn = 'users:upsertByName' as unknown as FunctionReference<'mutation'>;
        const response = await client.mutation(fn, { username }) as unknown;
        if (!response || typeof response !== 'object') return null;
        const parsed = response as { id?: unknown; username?: unknown };
        if (typeof parsed.id !== 'string' || typeof parsed.username !== 'string') return null;
        return { id: parsed.id, username: parsed.username };
    } catch {
        return null;
    }
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const rawName = typeof body?.username === 'string' ? body.username : '';
        const username = rawName.trim();

        if (username.length < 2) {
            return NextResponse.json(
                { error: 'Username must be at least 2 characters.' },
                { status: 400 }
            );
        }

        const convexUser = await tryConvexLogin(username);
        if (convexUser) {
            return NextResponse.json(convexUser);
        }

        const users = await readUsers();
        const existing = users.find((user) => user.username.toLowerCase() === username.toLowerCase());
        if (existing) {
            return NextResponse.json({ id: existing.id, username: existing.username } satisfies UserSession);
        }

        const next: StoredUser = {
            id: uuidv4(),
            username,
            createdAt: Date.now(),
        };
        users.push(next);
        await writeUsers(users);

        return NextResponse.json({ id: next.id, username: next.username } satisfies UserSession);
    } catch {
        return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
    }
}
