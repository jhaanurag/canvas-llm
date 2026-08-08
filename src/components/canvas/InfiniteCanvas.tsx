
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Node, Connection, Message, CanvasState, ContextItem, MemoryEntry } from '@/types';
import { ChatNode } from './ChatNode';
import { NoteNode } from './NoteNode';
import { DrawingNode } from './DrawingNode';
import { SelectionMenu } from '@/components/ui/SelectionMenu';
import { v4 as uuidv4 } from 'uuid';
import { clsx } from 'clsx';
import { Hand, Image as ImageIcon, Keyboard, MapIcon, MessageSquare, MousePointer2, Pencil, Settings2, StickyNote } from 'lucide-react';

const WORLD_MIN_X = -5000;
const WORLD_MAX_X = 5000;
const WORLD_MIN_Y = -5000;
const WORLD_MAX_Y = 5000;
const WORLD_WIDTH = WORLD_MAX_X - WORLD_MIN_X;
const WORLD_HEIGHT = WORLD_MAX_Y - WORLD_MIN_Y;
const UNSAVED_DRAFT_KEY = 'canvas-unsaved-state';

/**
 * Centers the viewport on the last-touched node (nodes are kept in
 * z-order via bringToFront, so the last array entry is the most
 * recently active one) instead of defaulting to the world origin.
 */
function computeInitialOffset(nodes: Node[]): { x: number; y: number } {
    if (typeof window === 'undefined' || nodes.length === 0) {
        return { x: 0, y: 0 };
    }

    const lastNode = nodes[nodes.length - 1];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetX = viewportWidth / 2 - (lastNode.x + lastNode.width / 2);
    const targetY = viewportHeight / 2 - (lastNode.y + lastNode.height / 2);

    const minOffsetX = viewportWidth - WORLD_MAX_X;
    const maxOffsetX = -WORLD_MIN_X;
    const minOffsetY = viewportHeight - WORLD_MAX_Y;
    const maxOffsetY = -WORLD_MIN_Y;

    return {
        x: minOffsetX > maxOffsetX ? (minOffsetX + maxOffsetX) / 2 : Math.min(maxOffsetX, Math.max(minOffsetX, targetX)),
        y: minOffsetY > maxOffsetY ? (minOffsetY + maxOffsetY) / 2 : Math.min(maxOffsetY, Math.max(minOffsetY, targetY)),
    };
}

function readStoredCanvasDraft(): CanvasState | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const rawDraft = window.localStorage.getItem(UNSAVED_DRAFT_KEY);
    if (!rawDraft) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawDraft) as CanvasState;
        return {
            nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
            connections: Array.isArray(parsed.connections) ? parsed.connections : [],
            contextBuffer: Array.isArray(parsed.contextBuffer) ? parsed.contextBuffer : [],
        };
    } catch {
        window.localStorage.removeItem(UNSAVED_DRAFT_KEY);
        return null;
    }
}

function hasCanvasContent(state: CanvasState | null) {
    return Boolean(
        state &&
        (state.nodes.length > 0 || state.connections.length > 0 || (state.contextBuffer?.length ?? 0) > 0)
    );
}

function sanitizeStateForStorage(state: CanvasState): CanvasState {
    return {
        nodes: state.nodes.map((node) => ({
            ...node,
            messages: node.messages.map((message) => ({
                ...message,
                attachments: undefined,
            })),
            initialAttachments: undefined,
        })),
        connections: state.connections,
        contextBuffer: (state.contextBuffer ?? []).map(({ id, text, sourceNodeId }) => ({
            id,
            text,
            sourceNodeId,
        })),
    };
}

export const InfiniteCanvas = () => {
    const [initialDraft] = useState<CanvasState | null>(() => readStoredCanvasDraft());

    const [nodes, setNodes] = useState<Node[]>(() => initialDraft?.nodes ?? []);
    const [connections, setConnections] = useState<Connection[]>(() => initialDraft?.connections ?? []);
    const [offset, setOffset] = useState(() => computeInitialOffset(initialDraft?.nodes ?? []));
    const [isPanning, setIsPanning] = useState(false);
    const [activeTool, setActiveTool] = useState('select');
    const [contextBuffer, setContextBuffer] = useState<ContextItem[]>(() => initialDraft?.contextBuffer ?? []);
    const [globalSelection, setGlobalSelection] = useState<{ text: string; x: number; y: number; nodeId: string } | null>(null);
    const [showCanvasSettings, setShowCanvasSettings] = useState(false);
    const [isBeautifulUI, setIsBeautifulUI] = useState(true);
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [gridResolution, setGridResolution] = useState(20);
    const [sharpEdges, setSharpEdges] = useState(false);
    const [cornerRadius, setCornerRadius] = useState(18);
    const [accentColor, setAccentColor] = useState('#0f766e');
    const [surfaceColor, setSurfaceColor] = useState('#fff8ed');
    const [gridColor, setGridColor] = useState('#1b2b33');
    const [textColor, setTextColor] = useState('#1b2b33');
    const [preferencesLoaded, setPreferencesLoaded] = useState(false);
    const [isSpacePanning, setIsSpacePanning] = useState(false);
    const [dockPosition, setDockPosition] = useState<'top' | 'bottom'>('top');
    const [showMinimap, setShowMinimap] = useState(true);
    const [showButtonLabels, setShowButtonLabels] = useState(true);
    const [animationsEnabled, setAnimationsEnabled] = useState(true);
    const [isMinimapHovered, setIsMinimapHovered] = useState(false);
    const [isMinimapDragging, setIsMinimapDragging] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);
    const minimapRef = useRef<HTMLDivElement>(null);
    const offsetRef = useRef(offset);
    const activeToolRef = useRef(activeTool);
    const pendingPanDeltaRef = useRef({ x: 0, y: 0 });
    const panFrameRef = useRef<number | null>(null);
    const panPointerIdRef = useRef<number | null>(null);
    const minimapPointerIdRef = useRef<number | null>(null);
    const lastPanPointRef = useRef({ x: 0, y: 0 });
    const lastSelectionRef = useRef('');
    const isSpacePanningRef = useRef(false);
    const saveTimerRef = useRef<number | null>(null);
    const lastSavedSnapshotRef = useRef(
        initialDraft && hasCanvasContent(initialDraft)
            ? JSON.stringify(sanitizeStateForStorage(initialDraft))
            : ''
    );
    const spawnIndexRef = useRef(0);

    useEffect(() => {
        offsetRef.current = offset;
    }, [offset]);

    useEffect(() => {
        activeToolRef.current = activeTool;
    }, [activeTool]);

    useEffect(() => {
        isSpacePanningRef.current = isSpacePanning;
    }, [isSpacePanning]);

    useEffect(() => {
        return () => {
            if (panFrameRef.current !== null) {
                cancelAnimationFrame(panFrameRef.current);
            }
            if (saveTimerRef.current !== null) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const storedMode = window.localStorage.getItem('canvas-ui-mode');
        const nextIsBeautifulUI = storedMode === 'beautiful' ? true : storedMode === 'fast' ? false : true;

        const storedSnap = window.localStorage.getItem('canvas-snap-to-grid');
        const nextSnapToGrid = storedSnap === 'off' ? false : true;
        const storedGridResolution = Number(window.localStorage.getItem('canvas-grid-resolution') || '20');
        const nextGridResolution = Number.isFinite(storedGridResolution) && storedGridResolution >= 8 && storedGridResolution <= 120
            ? Math.round(storedGridResolution)
            : 20;
        const storedEdges = window.localStorage.getItem('canvas-edge-mode');
        const nextSharpEdges = storedEdges === 'sharp';
        const storedCornerRadius = Number(window.localStorage.getItem('canvas-corner-radius') || '18');
        const nextCornerRadius = Number.isFinite(storedCornerRadius) && storedCornerRadius >= 0 && storedCornerRadius <= 32
            ? Math.round(storedCornerRadius)
            : 18;
        const storedAccentColor = window.localStorage.getItem('canvas-accent-color');
        const nextAccentColor = storedAccentColor && /^#[0-9A-Fa-f]{6}$/.test(storedAccentColor)
            ? storedAccentColor
            : '#0f766e';
        const storedSurfaceColor = window.localStorage.getItem('canvas-surface-color');
        const nextSurfaceColor = storedSurfaceColor && /^#[0-9A-Fa-f]{6}$/.test(storedSurfaceColor)
            ? storedSurfaceColor
            : '#fff8ed';
        const storedGridColor = window.localStorage.getItem('canvas-grid-color');
        const nextGridColor = storedGridColor && /^#[0-9A-Fa-f]{6}$/.test(storedGridColor)
            ? storedGridColor
            : '#1b2b33';
        const storedTextColor = window.localStorage.getItem('canvas-text-color');
        const nextTextColor = storedTextColor && /^#[0-9A-Fa-f]{6}$/.test(storedTextColor)
            ? storedTextColor
            : '#1b2b33';
        const storedDockPosition = window.localStorage.getItem('canvas-dock-position');
        const nextDockPosition: 'top' | 'bottom' = storedDockPosition === 'bottom' ? 'bottom' : 'top';
        const storedShowMinimap = window.localStorage.getItem('canvas-show-minimap');
        const nextShowMinimap = storedShowMinimap === 'off' ? false : true;
        const storedShowButtonLabels = window.localStorage.getItem('canvas-show-button-labels');
        const nextShowButtonLabels = storedShowButtonLabels === 'off' ? false : true;
        const storedAnimationsEnabled = window.localStorage.getItem('canvas-animations-enabled');
        const nextAnimationsEnabled = storedAnimationsEnabled === 'off' ? false : true;

        const raf = requestAnimationFrame(() => {
            setIsBeautifulUI(nextIsBeautifulUI);
            setSnapToGrid(nextSnapToGrid);
            setGridResolution(nextGridResolution);
            setSharpEdges(nextSharpEdges);
            setCornerRadius(nextCornerRadius);
            setAccentColor(nextAccentColor);
            setSurfaceColor(nextSurfaceColor);
            setGridColor(nextGridColor);
            setTextColor(nextTextColor);
            setDockPosition(nextDockPosition);
            setShowMinimap(nextShowMinimap);
            setShowButtonLabels(nextShowButtonLabels);
            setAnimationsEnabled(nextAnimationsEnabled);
            setPreferencesLoaded(true);
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        if (!preferencesLoaded) return;
        window.localStorage.setItem('canvas-ui-mode', isBeautifulUI ? 'beautiful' : 'fast');
        window.localStorage.setItem('canvas-snap-to-grid', snapToGrid ? 'on' : 'off');
        window.localStorage.setItem('canvas-grid-resolution', String(gridResolution));
        window.localStorage.setItem('canvas-edge-mode', sharpEdges ? 'sharp' : 'rounded');
        window.localStorage.setItem('canvas-corner-radius', String(cornerRadius));
        window.localStorage.setItem('canvas-accent-color', accentColor);
        window.localStorage.setItem('canvas-surface-color', surfaceColor);
        window.localStorage.setItem('canvas-grid-color', gridColor);
        window.localStorage.setItem('canvas-text-color', textColor);
        window.localStorage.setItem('canvas-dock-position', dockPosition);
        window.localStorage.setItem('canvas-show-minimap', showMinimap ? 'on' : 'off');
        window.localStorage.setItem('canvas-show-button-labels', showButtonLabels ? 'on' : 'off');
        window.localStorage.setItem('canvas-animations-enabled', animationsEnabled ? 'on' : 'off');
    }, [preferencesLoaded, isBeautifulUI, snapToGrid, gridResolution, sharpEdges, cornerRadius, accentColor, surfaceColor, gridColor, textColor, dockPosition, showMinimap, showButtonLabels, animationsEnabled]);

    const markLocalEdit = useCallback(() => {}, []);

    const persistedCanvasState = useMemo(() => sanitizeStateForStorage({
        nodes,
        connections,
        contextBuffer,
    }), [nodes, connections, contextBuffer]);

    useEffect(() => {
        if (saveTimerRef.current !== null) {
            clearTimeout(saveTimerRef.current);
        }
        const snapshot = JSON.stringify(persistedCanvasState);
        if (snapshot === lastSavedSnapshotRef.current) return;

        saveTimerRef.current = window.setTimeout(() => {
            window.localStorage.setItem(UNSAVED_DRAFT_KEY, snapshot);
            lastSavedSnapshotRef.current = snapshot;
        }, 700);

        return () => {
            if (saveTimerRef.current !== null) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, [persistedCanvasState]);

    // Global selection listener for better reliability
    useEffect(() => {
        const handleSelectionChange = () => {
            // Wait for next tick to ensure selection is complete and layout is stable
            requestAnimationFrame(() => {
                const activeEl = document.activeElement as HTMLElement | null;
                if (activeEl?.closest('[data-selection-menu]')) return;
                const sel = window.getSelection();
                const text = sel?.toString().trim();

                // Only showing menu if there is actual text selected
                if (text && text.length > 0) {
                    try {
                        const range = sel!.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        const selectionKey = `${text}:${Math.round(rect.left)}:${Math.round(rect.bottom)}`;
                        if (lastSelectionRef.current === selectionKey) return;
                        lastSelectionRef.current = selectionKey;

                        setGlobalSelection({
                            text: text,
                            x: rect.left,
                            y: rect.bottom + 40,
                            nodeId: '' // Generic selection
                        });
                    } catch {
                        // Ignore errors from getRangeAt if selection is invalid
                    }
                } else {
                    lastSelectionRef.current = '';
                    setGlobalSelection(null);
                }
            });
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    const screenToWorld = useCallback((screenX: number, screenY: number) => {
        const currentOffset = offsetRef.current;
        return {
            x: screenX - currentOffset.x,
            y: screenY - currentOffset.y,
        };
    }, []);

    const worldToScreen = useCallback((worldX: number, worldY: number) => {
        const currentOffset = offsetRef.current;
        return {
            x: worldX + currentOffset.x,
            y: worldY + currentOffset.y,
        };
    }, []);

    const startPanning = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        setIsPanning(true);
        panPointerIdRef.current = e.pointerId;
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
    }, []);

    const shouldIgnorePanTarget = useCallback((target: HTMLElement) => {
        return Boolean(
            target.closest('[data-ui-overlay]') ||
            target.closest('[data-selection-menu]') ||
            target.closest('[data-no-pan]') ||
            target.closest('button, input, textarea, select, a, [role="button"], [contenteditable="true"], [data-no-pan]')
        );
    }, []);

    const shouldIgnorePanStartTarget = useCallback((target: HTMLElement) => {
        return Boolean(
            target.closest('[data-ui-overlay]') ||
            target.closest('[data-selection-menu]')
        );
    }, []);

    const clamp = useCallback((value: number, min: number, max: number) => {
        return Math.min(max, Math.max(min, value));
    }, []);

    const clampOffsetToWorld = useCallback((nextOffset: { x: number; y: number }) => {
        const viewportWidth = canvasRef.current?.clientWidth ?? window.innerWidth;
        const viewportHeight = canvasRef.current?.clientHeight ?? window.innerHeight;

        const minOffsetX = viewportWidth - WORLD_MAX_X;
        const maxOffsetX = -WORLD_MIN_X;
        const minOffsetY = viewportHeight - WORLD_MAX_Y;
        const maxOffsetY = -WORLD_MIN_Y;

        const x = minOffsetX > maxOffsetX
            ? (minOffsetX + maxOffsetX) / 2
            : clamp(nextOffset.x, minOffsetX, maxOffsetX);
        const y = minOffsetY > maxOffsetY
            ? (minOffsetY + maxOffsetY) / 2
            : clamp(nextOffset.y, minOffsetY, maxOffsetY);

        return { x, y };
    }, [clamp]);

    const clampNodePosition = useCallback((x: number, y: number, width: number, height: number) => {
        return {
            x: clamp(x, WORLD_MIN_X, WORLD_MAX_X - width),
            y: clamp(y, WORLD_MIN_Y, WORLD_MAX_Y - height),
        };
    }, [clamp]);

    const flushPendingPan = useCallback(() => {
        if (panFrameRef.current !== null) {
            cancelAnimationFrame(panFrameRef.current);
            panFrameRef.current = null;
        }

        const { x, y } = pendingPanDeltaRef.current;
        if (x !== 0 || y !== 0) {
            setOffset((prev) => clampOffsetToWorld({
                x: prev.x + x,
                y: prev.y + y,
            }));
            pendingPanDeltaRef.current = { x: 0, y: 0 };
        }
    }, [clampOffsetToWorld]);

    const onPointerDownCapture = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (activeToolRef.current !== 'hand' && !isSpacePanningRef.current) return;
        if (e.button !== 0 && e.button !== 1) return;
        const target = e.target as HTMLElement;
        if (shouldIgnorePanStartTarget(target)) return;
        startPanning(e);
        e.stopPropagation();
    }, [shouldIgnorePanStartTarget, startPanning]);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const isInteractive = Boolean(target.closest('.pointer-events-auto'));
        if (shouldIgnorePanTarget(target)) return;

        const canPanWithMouse = e.button === 1 || (e.button === 0 && (activeToolRef.current === 'hand' || isSpacePanningRef.current));
        const canPanWithTouch = e.pointerType === 'touch' && !isInteractive;
        if (canPanWithMouse || canPanWithTouch) {
            startPanning(e);
        }

        // Clear selection menu when tapping on empty canvas (but not on nodes or menu)
        if (!target.closest('[data-selection-menu]') &&
            !target.closest('.pointer-events-auto') &&
            (target === canvasRef.current || target.classList.contains('canvas-area'))) {
            setGlobalSelection(null);
            setShowCanvasSettings(false);
        }
    }, [shouldIgnorePanTarget, startPanning]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (isPanning) {
            if (panPointerIdRef.current !== null && e.pointerId !== panPointerIdRef.current) return;

            const dx = e.clientX - lastPanPointRef.current.x;
            const dy = e.clientY - lastPanPointRef.current.y;
            lastPanPointRef.current = { x: e.clientX, y: e.clientY };

            pendingPanDeltaRef.current.x += dx;
            pendingPanDeltaRef.current.y += dy;

            if (panFrameRef.current === null) {
                panFrameRef.current = requestAnimationFrame(() => {
                    panFrameRef.current = null;
                    flushPendingPan();
                });
            }
            if (e.pointerType === 'touch') {
                e.preventDefault();
            }
        }
    }, [isPanning, flushPendingPan]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (panPointerIdRef.current !== null && e.pointerId !== panPointerIdRef.current) return;
        setIsPanning(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        panPointerIdRef.current = null;
        flushPendingPan();
    }, [flushPendingPan]);

    const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (shouldIgnorePanTarget(target)) return;
        e.preventDefault();
        setOffset((prev) => clampOffsetToWorld({
            x: prev.x - e.deltaX,
            y: prev.y - e.deltaY,
        }));
    }, [shouldIgnorePanTarget, clampOffsetToWorld]);

    const updateOffsetFromMinimapPointer = useCallback((clientX: number, clientY: number) => {
        const minimapEl = minimapRef.current;
        if (!minimapEl) return;
        const rect = minimapEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
        const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
        const worldX = WORLD_MIN_X + (x / rect.width) * WORLD_WIDTH;
        const worldY = WORLD_MIN_Y + (y / rect.height) * WORLD_HEIGHT;

        setOffset(clampOffsetToWorld({
            x: -worldX,
            y: -worldY,
        }));
    }, [clampOffsetToWorld]);

    const onMinimapPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        minimapPointerIdRef.current = e.pointerId;
        setIsMinimapDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        updateOffsetFromMinimapPointer(e.clientX, e.clientY);
    }, [updateOffsetFromMinimapPointer]);

    const onMinimapPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!isMinimapDragging) return;
        if (minimapPointerIdRef.current !== null && minimapPointerIdRef.current !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        updateOffsetFromMinimapPointer(e.clientX, e.clientY);
    }, [isMinimapDragging, updateOffsetFromMinimapPointer]);

    const onMinimapPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (minimapPointerIdRef.current !== null && minimapPointerIdRef.current !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        setIsMinimapDragging(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        minimapPointerIdRef.current = null;
    }, []);

    useEffect(() => {
        const syncOffsetWithinBounds = () => {
            setOffset((prev) => clampOffsetToWorld(prev));
        };
        syncOffsetWithinBounds();
        window.addEventListener('resize', syncOffsetWithinBounds);
        return () => window.removeEventListener('resize', syncOffsetWithinBounds);
    }, [clampOffsetToWorld]);

    const addNode = useCallback((type: Node['type'], x: number, y: number, parentId?: string, sourceSelection?: string) => {
        markLocalEdit();
        const world = screenToWorld(x, y);
        const width = type === 'chat' ? 400 : type === 'note' ? 250 : 400;
        const height = type === 'chat' ? 500 : type === 'note' ? 200 : 400;
        const rawX = snapToGrid ? Math.round(world.x / gridResolution) * gridResolution : world.x;
        const rawY = snapToGrid ? Math.round(world.y / gridResolution) * gridResolution : world.y;
        const clamped = clampNodePosition(rawX, rawY, width, height);
        const newNode: Node = {
            id: uuidv4(),
            type,
            x: clamped.x,
            y: clamped.y,
            width,
            height,
            messages: [],
            content: '',
            parentId,
            sourceSelection,
            color: type === 'chat' ? `#${Math.floor(Math.random() * 16777215).toString(16)}` : undefined,
            memoryEntries: type === 'chat' ? [] : undefined,
            createdAt: Date.now(),
        };
        setNodes((prev) => [...prev, newNode]);
        if (parentId) {
            setConnections((prev) => [...prev, {
                id: uuidv4(),
                fromId: parentId,
                toId: newNode.id,
            }]);
        }
        return newNode;
    }, [clampNodePosition, gridResolution, markLocalEdit, screenToWorld, snapToGrid]);

    const getNextSpawnScreenPoint = useCallback((type: Node['type']) => {
        spawnIndexRef.current += 1;
        return {
            x: window.innerWidth / 2 - (type === 'note' ? 125 : 200),
            y: window.innerHeight / 2 - (type === 'note' ? 100 : type === 'drawing' ? 200 : 250),
        };
    }, []);

    const updateNodePos = useCallback((id: string, x: number, y: number) => {
        markLocalEdit();
        const nextX = snapToGrid ? Math.round(x / gridResolution) * gridResolution : x;
        const nextY = snapToGrid ? Math.round(y / gridResolution) * gridResolution : y;
        setNodes((prev) => prev.map((n) => {
            if (n.id !== id) return n;
            const clamped = clampNodePosition(nextX, nextY, n.width, n.height);
            return { ...n, x: clamped.x, y: clamped.y };
        }));
    }, [clampNodePosition, gridResolution, markLocalEdit, snapToGrid]);

    const bringToFront = useCallback((id: string) => {
        setNodes(prev => {
            const node = prev.find(n => n.id === id);
            if (!node || prev[prev.length - 1].id === id) return prev;
            return [...prev.filter(n => n.id !== id), node];
        });
    }, []);

    const updateNodeMessages = useCallback((id: string, messages: Message[]) => {
        markLocalEdit();
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, messages } : n));
    }, [markLocalEdit]);

    const updateNodeMemoryEntries = useCallback((id: string, memoryEntries: MemoryEntry[]) => {
        markLocalEdit();
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, memoryEntries } : n));
    }, [markLocalEdit]);

    const updateNodeContent = useCallback((id: string, content: string) => {
        markLocalEdit();
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, content } : n));
    }, [markLocalEdit]);

    const updateNodeTitle = useCallback((id: string, title: string) => {
        markLocalEdit();
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, title } : n));
    }, [markLocalEdit]);

    const updateNodeSystemPrompt = useCallback((id: string, systemPrompt: string) => {
        markLocalEdit();
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, systemPrompt } : n));
    }, [markLocalEdit]);

    const deleteNodeImmediately = useCallback((id: string) => {
        markLocalEdit();
        setNodes(prev => prev.filter(n => n.id !== id));
        setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
    }, [markLocalEdit]);
    const deleteNode = useCallback((id: string) => {
        deleteNodeImmediately(id);
    }, [deleteNodeImmediately]);

    const addToContext = useCallback((text: string, sourceNodeId: string, image?: string) => {
        const normalizedText = text.trim();
        if (!normalizedText && !image) return;
        markLocalEdit();
        setContextBuffer(prev => [...prev, { id: uuidv4(), text: normalizedText || 'Context', sourceNodeId, image }]);
    }, [markLocalEdit]);

    const branchFromChatMessage = useCallback((nodeId: string, messageIndex: number) => {
        const node = nodes.find((entry) => entry.id === nodeId);
        if (!node || node.type !== 'chat') return;
        const targetMessage = node.messages[messageIndex];
        if (!targetMessage) return;

        const branchCount = connections.filter((connection) => connection.fromId === node.id).length;
        const branchScreenPoint = worldToScreen(
            node.x + node.width + 80,
            node.y + Math.min(branchCount, 5) * 120
        );
        const branchedNode = addNode('chat', branchScreenPoint.x, branchScreenPoint.y, node.id, targetMessage.text);
        const transcript = node.messages
            .slice(0, messageIndex + 1)
            .map((message) => `${message.role}: ${message.text}`)
            .join('\n\n');

        window.setTimeout(() => {
            markLocalEdit();
            setNodes((prev) => prev.map((entry) => entry.id === branchedNode.id ? {
                ...entry,
                initialPrompt: `\n\nContext:\n"${transcript}"`,
                hasInitialContext: true,
            } : entry));
        }, 100);

    }, [addNode, connections, markLocalEdit, nodes, worldToScreen]);

    const spawnChatsFromNode = useCallback((nodeId: string, specs: { title?: string; prompt: string }[]) => {
        const sourceNode = nodes.find((entry) => entry.id === nodeId);
        const baseX = sourceNode ? sourceNode.x + sourceNode.width + 120 : 0;
        const baseY = sourceNode ? sourceNode.y - 40 : 0;

        specs
            .filter((spec) => spec.prompt.trim())
            .forEach((spec, index) => {
                const screenPoint = worldToScreen(baseX + (index % 2) * 440, baseY + Math.floor(index / 2) * 560);
                const spawnedNode = addNode('chat', screenPoint.x, screenPoint.y, sourceNode?.id);
                window.setTimeout(() => {
                    markLocalEdit();
                    setNodes((prev) => prev.map((entry) => entry.id === spawnedNode.id ? {
                        ...entry,
                        title: spec.title?.trim() || entry.title,
                        initialPrompt: spec.prompt.trim(),
                        autoSend: true,
                    } : entry));
                }, 40);
            });
    }, [addNode, markLocalEdit, nodes, worldToScreen]);

    const removeFromContext = useCallback((id: string) => {
        markLocalEdit();
        setContextBuffer(prev => prev.filter(item => item.id !== id));
    }, [markLocalEdit]);

    const handleBranch = useCallback((nodeId: string, selection: string, type: 'expand' | 'custom', x: number = 0, y: number = 0, customPrompt?: string, useBuffer: boolean = false) => {
        const node = nodes.find(n => n.id === nodeId);

        let newX = x;
        let newY = y - 400; // Place above selection (since chat height is 500)

        if (node) {
            const childrenCount = connections.filter(c => c.fromId === node.id).length;
            const spacing = 500;
            const angle = (childrenCount * 40 - 20) * Math.PI / 180;

            // logic-space position
            const targetX = node.x + spacing * Math.cos(angle);
            const targetY = node.y + spacing * Math.sin(angle);

            // Convert to screen-space for addNode
            const screenPoint = worldToScreen(targetX, targetY);
            newX = screenPoint.x;
            newY = screenPoint.y;
        }

        const newNode = addNode('chat', newX, newY, node?.id, selection);

        setTimeout(() => {
            const prompt = type === 'expand'
                ? `elaborate : "${selection}"`
                : customPrompt || `Question about "${selection}": `;

            let fullPrompt = prompt;
            let hasAddedContext = false;
            let images: { data: string; mimeType: string; name: string }[] = [];
            if (useBuffer && contextBuffer.length > 0) {
                // Add extra newline before My Question as requested
                fullPrompt = `Using this specific context:\n${contextBuffer.map(i => `[CTX]: ${i.text}`).join('\n')}\n\n\n${prompt}`;
                images = contextBuffer
                    .filter(i => i.image)
                    .map(i => ({
                        data: i.image!,
                        mimeType: 'image/png',
                        name: 'drawing.png'
                    }));
                markLocalEdit();
                setContextBuffer([]);
                hasAddedContext = true;
            }

            setNodes(prev => prev.map(n => n.id === newNode.id ? {
                ...n,
                initialPrompt: fullPrompt,
                hasInitialContext: hasAddedContext,
                initialAttachments: images.length > 0 ? images : undefined,
                autoSend: type === 'expand' // Auto-send only for expand flow
            } : n));
        }, 100);
    }, [addNode, connections, contextBuffer, markLocalEdit, nodes, worldToScreen]);

    useEffect(() => {
        if (nodes.length === 0) {
            const timer = window.setTimeout(() => {
                const point = getNextSpawnScreenPoint('chat');
                addNode('chat', point.x, point.y);
            }, 0);
            return () => window.clearTimeout(timer);
        }
    }, [addNode, getNextSpawnScreenPoint, nodes.length]);

    useEffect(() => {
        const isTextEntryTarget = (target: EventTarget | null) =>
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            (target instanceof HTMLElement && target.isContentEditable);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !isTextEntryTarget(e.target)) {
                setIsSpacePanning(true);
                e.preventDefault();
                return;
            }

            if (isTextEntryTarget(e.target)) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            if (e.code === 'Digit1' || e.code === 'Numpad1') {
                const point = getNextSpawnScreenPoint('chat');
                addNode('chat', point.x, point.y);
                return;
            }
            if (e.code === 'Digit2' || e.code === 'Numpad2') {
                const point = getNextSpawnScreenPoint('note');
                addNode('note', point.x, point.y);
                return;
            }
            if (e.code === 'Digit3' || e.code === 'Numpad3') {
                const point = getNextSpawnScreenPoint('drawing');
                addNode('drawing', point.x, point.y);
                return;
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpacePanning(false);
                return;
            }
        };
        const handleWindowBlur = () => {
            setIsSpacePanning(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleWindowBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [addNode, getNextSpawnScreenPoint]);

    const dockButtonClass = clsx(
        "inline-flex h-10 items-center justify-center border text-[11px] font-semibold leading-none tracking-wide",
        showButtonLabels ? "gap-2 px-3.5" : "w-10 px-0",
        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]",
        isBeautifulUI
            ? "border-[#21404a]/35 bg-[#fff8ed] hover:border-[color:var(--canvas-accent-70)]"
            : "border-transparent bg-transparent hover:bg-[#eadfcb]"
    );
    const dockSettingsButtonClass = clsx(
        "inline-flex h-10 items-center justify-center border text-[11px] font-semibold leading-none",
        showButtonLabels ? "gap-2 px-3.5" : "w-10 px-0",
        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]",
        isBeautifulUI
            ? "border-[#21404a]/35 bg-[#fff8ed] hover:border-[color:var(--canvas-accent-70)]"
            : "border-transparent bg-transparent hover:bg-[#eadfcb]"
    );
    const dockSettingsWidthClass = "w-full max-w-[min(100vw-1.5rem,78rem)]";
    const dockContextWidthClass = "w-fit max-w-[min(100vw-1.5rem,74rem)]";
    const dockMenuWidthClass = "w-fit max-w-[calc(100vw-1.5rem)]";
    const dockContainerPositionClass = dockPosition === 'top'
        ? "top-3 pt-[max(env(safe-area-inset-top),0px)]"
        : "bottom-3 pb-[max(env(safe-area-inset-bottom),0px)]";
    const dockMenuOrderClass = dockPosition === 'top' ? 'order-1' : 'order-3';
    const dockContextOrderClass = 'order-2';
    const dockSettingsOrderClass = dockPosition === 'top' ? 'order-3' : 'order-1';
    const minimapPositionClass = dockPosition === 'bottom' ? 'bottom-[8.25rem]' : 'bottom-4';
    const gridLineColor = useMemo(() => {
        const hex = gridColor.replace('#', '');
        if (hex.length !== 6) return 'rgba(27, 43, 51, 0.1)';
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some(Number.isNaN)) return 'rgba(27, 43, 51, 0.1)';
        return `rgba(${r}, ${g}, ${b}, 0.12)`;
    }, [gridColor]);
    const panelRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius)]';
    const segmentRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius-md)]';
    const segmentButtonRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius-sm)]';
    const accentTextColor = useMemo(() => {
        const hex = accentColor.replace('#', '');
        if (hex.length !== 6) return '#f8fffd';
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some(Number.isNaN)) return '#f8fffd';
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return luminance > 150 ? '#1b2b33' : '#f8fffd';
    }, [accentColor]);
    const renderedNodes = useMemo(() => (
        nodes.map((node) => {
            if (node.type === 'chat') {
                return (
                    <ChatNode
                        key={node.id}
                        node={node}
                        updatePos={(x, y) => updateNodePos(node.id, x, y)}
                        updateMessages={(msgs) => updateNodeMessages(node.id, msgs)}
                        updateTitle={(title) => updateNodeTitle(node.id, title)}
                        updateSystemPrompt={(prompt) => updateNodeSystemPrompt(node.id, prompt)}
                        updateMemoryEntries={(entries) => updateNodeMemoryEntries(node.id, entries)}
                        onDelete={() => deleteNode(node.id)}
                        isBeautifulUI={isBeautifulUI}
                        sharpEdges={sharpEdges}
                        accentColor={accentColor}
                        animationsEnabled={animationsEnabled}
                        onAddToContext={(text) => addToContext(text, node.id)}
                        onBranchFromMessage={(messageIndex) => branchFromChatMessage(node.id, messageIndex)}
                        onSpawnChats={(specs) => spawnChatsFromNode(node.id, specs)}
                        setGlobalSelection={(sel) => setGlobalSelection(sel ? { ...sel, nodeId: node.id } : null)}
                        onMouseDown={() => bringToFront(node.id)}
                    />
                );
            }
            if (node.type === 'note') {
                return (
                    <NoteNode
                        key={node.id}
                        node={node}
                        updatePos={(x, y) => updateNodePos(node.id, x, y)}
                        updateContent={(content) => updateNodeContent(node.id, content)}
                        onDelete={() => deleteNode(node.id)}
                        isBeautifulUI={isBeautifulUI}
                        sharpEdges={sharpEdges}
                        accentColor={accentColor}
                        onMouseDown={() => bringToFront(node.id)}
                        setGlobalSelection={(sel) => setGlobalSelection(sel ? { ...sel, nodeId: node.id } : null)}
                        onAddToContext={addToContext}
                    />
                );
            }
            if (node.type === 'drawing') {
                return (
                    <DrawingNode
                        key={node.id}
                        node={node}
                        updatePos={(x, y) => updateNodePos(node.id, x, y)}
                        onDelete={() => deleteNode(node.id)}
                        isBeautifulUI={isBeautifulUI}
                        sharpEdges={sharpEdges}
                        accentColor={accentColor}
                        onMouseDown={() => bringToFront(node.id)}
                        onAddToContext={addToContext}
                    />
                );
            }
            return null;
        })
    ), [
        accentColor,
        addToContext,
        animationsEnabled,
        branchFromChatMessage,
        spawnChatsFromNode,
        bringToFront,
        deleteNode,
        nodes,
        isBeautifulUI,
        sharpEdges,
        setGlobalSelection,
        updateNodeContent,
        updateNodeMemoryEntries,
        updateNodeSystemPrompt,
        updateNodeTitle,
        updateNodeMessages,
        updateNodePos
    ]);

    const minimapDots = useMemo(() => (
        nodes.map((node) => (
            <div
                key={node.id}
                className={clsx("absolute border border-[#1b2b33]/30", sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-min)]")}
                style={{
                    left: `${((node.x - WORLD_MIN_X) / WORLD_WIDTH) * 100}%`,
                    top: `${((node.y - WORLD_MIN_Y) / WORLD_HEIGHT) * 100}%`,
                    width: '4px',
                    height: '4px',
                    backgroundColor: node.color || accentColor
                }}
            />
        ))
    ), [nodes, sharpEdges, accentColor]);

    const cssVars = {
        '--canvas-accent-70': `${accentColor}b3`,
        '--canvas-accent': accentColor,
        '--canvas-radius': `${sharpEdges ? 0 : cornerRadius}px`,
        '--canvas-radius-md': `${sharpEdges ? 0 : Math.max(0, cornerRadius - 4)}px`,
        '--canvas-radius-sm': `${sharpEdges ? 0 : Math.max(0, cornerRadius - 8)}px`,
        '--canvas-radius-xs': `${sharpEdges ? 0 : Math.max(0, cornerRadius - 10)}px`,
        '--canvas-radius-min': `${sharpEdges ? 0 : Math.max(0, Math.min(4, cornerRadius - 12))}px`
    } as React.CSSProperties;

    return (
        <div
            ref={canvasRef}
            className="canvas-area relative h-screen w-screen overflow-hidden font-sans"
            onPointerDownCapture={onPointerDownCapture}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onDoubleClick={(e) => {
                if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-area')) {
                    addNode('note', e.clientX, e.clientY);
                }
            }}
            style={{
                ...cssVars,
                cursor: isPanning ? 'grabbing' : (isSpacePanning || activeTool === 'hand' ? 'grab' : 'default'),
                ...(isBeautifulUI
                    ? {
                        backgroundImage: `linear-gradient(${gridLineColor} 1px, transparent 1px), linear-gradient(90deg, ${gridLineColor} 1px, transparent 1px)`,
                        backgroundPosition: `${offset.x}px ${offset.y}px`,
                        backgroundSize: `${gridResolution * 2}px ${gridResolution * 2}px`,
                    }
                    : {})
            }}
        >
            <div
                data-ui-overlay
                className="pointer-events-none fixed right-4 top-4 z-[2100] flex justify-end"
            >
                <div
                    className={clsx(
                        "pointer-events-auto flex items-center gap-2 border px-3 py-2 text-[11px] font-semibold shadow-[0_10px_26px_rgba(33,36,41,0.12)]",
                        sharpEdges ? "rounded-none" : "rounded-full"
                    )}
                    style={{ backgroundColor: surfaceColor, color: textColor, borderColor: `${gridColor}35` }}
                >
                    <span>Local-only canvas on this browser/device</span>
                </div>
            </div>

            {/* Unified Dock UI */}
            <div data-ui-overlay className={clsx("pointer-events-none fixed left-0 right-0 z-[2000] flex flex-col items-center gap-2 px-3", dockContainerPositionClass)}>
                {showCanvasSettings && (
                    <div
                        className={clsx(
                            "pointer-events-auto relative z-[2200] border border-[#1b2b33]/25 px-3.5 py-3",
                            dockSettingsWidthClass,
                            dockSettingsOrderClass,
                            panelRadiusClass,
                            isBeautifulUI && "shadow-[0_10px_26px_rgba(33,36,41,0.18)]"
                        )}
                        style={{ backgroundColor: surfaceColor, color: textColor }}
                    >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold">UI Mode</div>
                                <div className="text-[10px] opacity-70">Fast mode minimizes effects. Beautiful restores depth and shadows.</div>
                            </div>
                            <button
                                className={clsx(
                                    "inline-flex h-9 min-w-24 self-start items-center justify-center border border-[#21404a]/35 bg-[#fff8ed] px-3 text-[11px] font-semibold hover:border-[color:var(--canvas-accent-70)] sm:min-w-28 sm:self-auto",
                                    sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                )}
                                onClick={() => setIsBeautifulUI((prev) => !prev)}
                                title="Toggle UI quality"
                                style={{ color: textColor }}
                            >
                                {isBeautifulUI ? 'Beautiful' : 'Fast'}
                            </button>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-t border-[#1b2b33]/15 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold">Snap to Grid</div>
                                <div className="text-[10px] opacity-70">Grid step: {gridResolution}px.</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    className={clsx(
                                    "inline-flex h-9 min-w-16 items-center justify-center border border-[#21404a]/35 bg-[#fff8ed] px-3 text-[11px] font-semibold hover:border-[color:var(--canvas-accent-70)]",
                                    sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                )}
                                onClick={() => setSnapToGrid((prev) => !prev)}
                                title="Toggle snapping"
                                style={{ color: textColor }}
                            >
                                {snapToGrid ? 'On' : 'Off'}
                            </button>
                                <input
                                    type="number"
                                    min={8}
                                    max={120}
                                    step={4}
                                    value={gridResolution}
                                    onChange={(e) => {
                                        const next = Number(e.target.value);
                                        if (!Number.isFinite(next)) return;
                                        setGridResolution(Math.max(8, Math.min(120, Math.round(next / 4) * 4)));
                                    }}
                                    className={clsx(
                                        "h-9 w-16 border border-[#21404a]/35 bg-[#fff8ed] px-2 text-[11px] font-semibold",
                                        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                    )}
                                    style={{ color: textColor }}
                                />
                            </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-t border-[#1b2b33]/15 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold">Edge Mode</div>
                                <div className="text-[10px] opacity-70">Toggle wins first. Rounded uses the stored radius value below.</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-80">
                                    <span>Radius</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={32}
                                        step={1}
                                        value={cornerRadius}
                                        onChange={(e) => {
                                            const next = Number(e.target.value);
                                            if (!Number.isFinite(next)) return;
                                            setCornerRadius(Math.max(0, Math.min(32, Math.round(next))));
                                        }}
                                        className={clsx(
                                            "h-9 w-16 border border-[#21404a]/35 bg-[#fff8ed] px-2 text-[11px] font-semibold",
                                            sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                        )}
                                        style={{ color: textColor }}
                                    />
                                </label>
                                <button
                                    className={clsx(
                                        "inline-flex h-9 min-w-24 self-start items-center justify-center border border-[#21404a]/35 bg-[#fff8ed] px-3 text-[11px] font-semibold hover:border-[color:var(--canvas-accent-70)] sm:min-w-28 sm:self-auto",
                                        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                    )}
                                    onClick={() => setSharpEdges((prev) => !prev)}
                                    title="Toggle edge style"
                                    style={{ color: textColor }}
                                >
                                    {sharpEdges ? 'Sharp' : 'Rounded'}
                                </button>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-t border-[#1b2b33]/15 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold">Menu Position</div>
                                <div className="text-[10px] opacity-70">Place the dock at the top or bottom.</div>
                            </div>
                            <div className={clsx(
                                "flex h-10 items-center gap-1 border p-1",
                                sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]",
                                isBeautifulUI
                                    ? "border-[#21404a]/35 bg-[#fff8ed]"
                                    : "border-[#776a54]/45 bg-[#f0e5cf]"
                            )}>
                                <button
                                    className={clsx(
                                        "inline-flex h-8 min-w-16 items-center justify-center px-3 text-[11px] font-semibold",
                                        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-xs)]",
                                        dockPosition === 'top'
                                            ? "text-[#f8fffd]"
                                            : "text-[#1b2b33] hover:bg-[#e9dcc4]"
                                    )}
                                    onClick={() => setDockPosition('top')}
                                    style={dockPosition === 'top' ? { backgroundColor: accentColor } : { color: textColor }}
                                >
                                    Top
                                </button>
                                <button
                                    className={clsx(
                                        "inline-flex h-8 min-w-16 items-center justify-center px-3 text-[11px] font-semibold",
                                        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-xs)]",
                                        dockPosition === 'bottom'
                                            ? "text-[#f8fffd]"
                                            : "text-[#1b2b33] hover:bg-[#e9dcc4]"
                                    )}
                                    onClick={() => setDockPosition('bottom')}
                                    style={dockPosition === 'bottom' ? { backgroundColor: accentColor } : { color: textColor }}
                                >
                                    Bottom
                                </button>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-t border-[#1b2b33]/15 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold">Minimap</div>
                                <div className="text-[10px] opacity-70">Toggle the minimap overlay in both UI modes.</div>
                            </div>
                            <button
                                className={clsx(
                                    "inline-flex h-9 min-w-24 self-start items-center justify-center gap-1.5 border border-[#21404a]/35 bg-[#fff8ed] px-3 text-[11px] font-semibold hover:border-[color:var(--canvas-accent-70)] sm:min-w-28 sm:self-auto",
                                    sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                )}
                                onClick={() => setShowMinimap((prev) => !prev)}
                                title="Toggle minimap"
                                style={{ color: textColor }}
                            >
                                <MapIcon size={13} />
                                {showMinimap ? 'Shown' : 'Hidden'}
                            </button>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-t border-[#1b2b33]/15 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold">Button Labels</div>
                                <div className="text-[10px] opacity-70">Show or hide text labels in the top dock buttons.</div>
                            </div>
                            <button
                                className={clsx(
                                    "inline-flex h-9 min-w-24 self-start items-center justify-center gap-1.5 border border-[#21404a]/35 bg-[#fff8ed] px-3 text-[11px] font-semibold hover:border-[color:var(--canvas-accent-70)] sm:min-w-28 sm:self-auto",
                                    sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                )}
                                onClick={() => setShowButtonLabels((prev) => !prev)}
                                title="Toggle button labels"
                                style={{ color: textColor }}
                            >
                                {showButtonLabels ? 'Shown' : 'Hidden'}
                            </button>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-t border-[#1b2b33]/15 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold">Animations</div>
                                <div className="text-[10px] opacity-70">Controls chat entrance motion and AI activity effects.</div>
                            </div>
                            <button
                                className={clsx(
                                    "inline-flex h-9 min-w-24 self-start items-center justify-center gap-1.5 border border-[#21404a]/35 bg-[#fff8ed] px-3 text-[11px] font-semibold hover:border-[color:var(--canvas-accent-70)] sm:min-w-28 sm:self-auto",
                                    sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                )}
                                onClick={() => setAnimationsEnabled((prev) => !prev)}
                                title="Toggle animations"
                                style={{ color: textColor }}
                            >
                                {animationsEnabled ? 'On' : 'Off'}
                            </button>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-t border-[#1b2b33]/15 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold">Colour</div>
                                <div className="text-[10px] opacity-70">Accent, surface, grid, and text colors.</div>
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                                <label
                                    className={clsx(
                                        "inline-flex h-9 items-center justify-center gap-1.5 border border-[#21404a]/35 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1b2b33]",
                                        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                    )}
                                    title="Accent color"
                                    style={{ backgroundColor: surfaceColor }}
                                >
                                    A
                                    <input
                                        type="color"
                                        value={accentColor}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                        className="h-5 w-5 cursor-pointer border-none bg-transparent p-0"
                                    />
                                </label>
                                <label
                                    className={clsx(
                                        "inline-flex h-9 items-center justify-center gap-1.5 border border-[#21404a]/35 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1b2b33]",
                                        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                    )}
                                    title="Surface color"
                                    style={{ backgroundColor: surfaceColor }}
                                >
                                    S
                                    <input
                                        type="color"
                                        value={surfaceColor}
                                        onChange={(e) => setSurfaceColor(e.target.value)}
                                        className="h-5 w-5 cursor-pointer border-none bg-transparent p-0"
                                    />
                                </label>
                                <label
                                    className={clsx(
                                        "inline-flex h-9 items-center justify-center gap-1.5 border border-[#21404a]/35 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1b2b33]",
                                        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                    )}
                                    title="Grid color"
                                    style={{ backgroundColor: surfaceColor }}
                                >
                                    G
                                    <input
                                        type="color"
                                        value={gridColor}
                                        onChange={(e) => setGridColor(e.target.value)}
                                        className="h-5 w-5 cursor-pointer border-none bg-transparent p-0"
                                    />
                                </label>
                                <label
                                    className={clsx(
                                        "inline-flex h-9 items-center justify-center gap-1.5 border border-[#21404a]/35 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1b2b33]",
                                        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                                    )}
                                    title="Text color"
                                    style={{ backgroundColor: surfaceColor }}
                                >
                                    T
                                    <input
                                        type="color"
                                        value={textColor}
                                        onChange={(e) => setTextColor(e.target.value)}
                                        className="h-5 w-5 cursor-pointer border-none bg-transparent p-0"
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Context Buffer: moved above control bar */}
                {contextBuffer.length > 0 && (
                    <div
                        className={clsx(
                            "pointer-events-auto border px-3 py-2.5",
                            dockContextWidthClass,
                            dockContextOrderClass,
                            panelRadiusClass,
                            isBeautifulUI
                                ? "border-[#1b2b33]/25"
                                : "border-[#776a54]/45 bg-[#f5eddc]",
                            isBeautifulUI && "shadow-[0_8px_20px_rgba(33,36,41,0.15)]"
                        )}
                        style={isBeautifulUI ? { backgroundColor: surfaceColor, color: textColor } : undefined}
                    >
                        <div className="flex items-center gap-2">
                            <span className="shrink-0 px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#486069]">Context:</span>
                            <div className="hover-scroll-x flex max-w-[min(62vw,42rem)] items-center gap-2 overflow-x-auto pb-0.5">
                                {contextBuffer.map(item => {
                                    const words = item.text.trim().split(/\s+/).filter(w => w.length > 0);
                                    const firstWords = words.slice(0, 2).join(' ');
                                    const lastWords = words.slice(-2).join(' ');
                                    const display = words.length > 4
                                        ? `${firstWords} ... ${lastWords}`
                                        : item.text;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => removeFromContext(item.id)}
                                            className={clsx(
                                                "flex h-8 shrink-0 items-center gap-1 border px-2.5 text-[11px] hover:border-red-500/40 hover:text-red-700 hover:line-through",
                                                sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]",
                                                isBeautifulUI
                                                    ? "border-[#1b2b33]/25 bg-[#fffaf2] text-[#1b2b33]"
                                                    : "border-[#776a54]/45 bg-[#f0e5cf] text-[#21313a]"
                                            )}
                                            title="Click to remove"
                                        >
                                            <span className="font-medium">{display}</span>
                                            {item.image && (
                                                <span className={clsx(
                                                    "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                                                    sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-xs)]",
                                                    isBeautifulUI ? "border-[#1b2b33]/20 bg-[#ffffffcc]" : "border-[#776a54]/35 bg-[#ffffffb8]"
                                                )}>
                                                    <ImageIcon size={10} style={{ color: accentColor }} />
                                                    Img
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => {
                                    markLocalEdit();
                                    setContextBuffer([]);
                                }}
                                className={clsx(
                                    "inline-flex h-8 shrink-0 items-center border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-red-700 hover:bg-red-50",
                                    sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]",
                                    isBeautifulUI
                                        ? "border-red-500/30 bg-[#fff8ed]"
                                        : "border-red-500/35 bg-[#f5eddc]"
                                )}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}

                <div
                    className={clsx(
                        "pointer-events-auto relative z-[2100]",
                        dockMenuWidthClass,
                        dockMenuOrderClass,
                        isBeautifulUI
                            ? ["border border-[#1b2b33]/25 px-3 py-2.5", panelRadiusClass, "shadow-[0_10px_26px_rgba(33,36,41,0.18)]"]
                            : "px-0 py-0"
                    )}
                    style={isBeautifulUI ? { backgroundColor: surfaceColor, color: textColor } : undefined}
                >
                    <div className="hover-scroll-x overflow-x-auto whitespace-nowrap">
                        <div className="flex w-max items-center justify-center gap-2" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
                            {isBeautifulUI && (
                                <div className={clsx(
                                    "inline-flex h-10 items-center gap-1.5 border px-3 text-[11px] font-semibold tracking-[0.14em]",
                                    sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]",
                                    "border-[#21404a]/35 bg-[#fff8ed]"
                                )} style={{ color: textColor }}>
                                    <MapIcon size={13} />
                                    RabbitHoleAI
                                </div>
                            )}
                            <div className={clsx(
                            "flex h-10 items-center gap-1 border p-1",
                            segmentRadiusClass,
                            isBeautifulUI
                                ? "border-[#1b2b33]/25 bg-[#fff8ed]"
                                : "border-transparent bg-transparent"
                            )}>
                            <button
                                className={clsx(
                                    "inline-flex h-8 items-center justify-center text-[11px] font-semibold",
                                    showButtonLabels ? "min-w-16 gap-1.5 px-3" : "w-8 px-0",
                                    segmentButtonRadiusClass,
                                    activeTool === 'select'
                                        ? ""
                                        : "text-[#1b2b33] hover:bg-[#e9dcc4]"
                                )}
                                onClick={() => setActiveTool('select')}
                                title="Select mode"
                                style={activeTool === 'select' ? { backgroundColor: accentColor, color: accentTextColor } : { color: textColor }}
                            >
                                <MousePointer2 size={13} />
                                {showButtonLabels && <span>Select</span>}
                            </button>
                            <button
                                className={clsx(
                                    "inline-flex h-8 items-center justify-center text-[11px] font-semibold",
                                    showButtonLabels ? "min-w-16 gap-1.5 px-3" : "w-8 px-0",
                                    segmentButtonRadiusClass,
                                    activeTool === 'hand'
                                        ? ""
                                        : "text-[#1b2b33] hover:bg-[#e9dcc4]"
                                )}
                                onClick={() => setActiveTool('hand')}
                                title="Hand mode"
                                style={activeTool === 'hand' ? { backgroundColor: accentColor, color: accentTextColor } : { color: textColor }}
                            >
                                <Hand size={13} />
                                {showButtonLabels && <span>Pan</span>}
                            </button>
                        </div>

                            <button
                                className={dockButtonClass}
                                onClick={() => {
                                    const point = getNextSpawnScreenPoint('chat');
                                    const newNode = addNode('chat', point.x, point.y);
                                    if (contextBuffer.length > 0) {
                                        const contextText = contextBuffer.map((item) => item.text).join('\n\n');
                                        const images = contextBuffer
                                            .filter((item) => item.image)
                                            .map((item) => ({
                                                data: item.image!,
                                                mimeType: 'image/png',
                                                name: 'drawing.png'
                                            }));

                                        setTimeout(() => {
                                            markLocalEdit();
                                            setNodes((prev) => prev.map((node) => node.id === newNode.id ? {
                                                ...node,
                                                initialPrompt: `\n\nContext:\n${contextText}`,
                                                hasInitialContext: true,
                                                initialAttachments: images
                                            } : node));
                                            setContextBuffer([]);
                                        }, 100);
                                    }
                                }}
                                title="New Chat (1)"
                                style={{ color: textColor }}
                            >
                                <MessageSquare size={13} />
                                {showButtonLabels && <span>New Chat</span>}
                            </button>
                            <button
                                className={dockButtonClass}
                                onClick={() => {
                                    const point = getNextSpawnScreenPoint('note');
                                    addNode('note', point.x, point.y);
                                }}
                                title="New Note (2)"
                                style={{ color: textColor }}
                            >
                                <StickyNote size={13} />
                                {showButtonLabels && <span>New Note</span>}
                            </button>
                            <button
                                className={dockButtonClass}
                                onClick={() => {
                                    const point = getNextSpawnScreenPoint('drawing');
                                    addNode('drawing', point.x, point.y);
                                }}
                                title="New Drawing (3)"
                                style={{ color: textColor }}
                            >
                                <Pencil size={13} />
                                {showButtonLabels && <span>New Drawing</span>}
                            </button>
                            <button
                                className={dockSettingsButtonClass}
                                onClick={() => setShowCanvasSettings((prev) => !prev)}
                                title="Canvas settings"
                                style={{ color: textColor }}
                            >
                                <Settings2 size={13} />
                                {showButtonLabels && <span>Settings</span>}
                            </button>
                            <button
                                className={dockButtonClass}
                                onClick={() => {
                                    alert('Shortcuts:\n1 = New Chat\n2 = New Note\n3 = New Drawing\nHold Space + Drag = Pan');
                                }}
                                title="Help & Shortcuts"
                                style={{ color: textColor }}
                            >
                                <Keyboard size={13} />
                                {showButtonLabels && <span>Shortcuts</span>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showMinimap && (
                <div className={clsx(
                    "fixed right-4 z-[1000] hidden h-32 w-44 overflow-hidden border p-3 backdrop-blur-xl md:block",
                    minimapPositionClass,
                    isBeautifulUI
                        ? (isMinimapHovered || isMinimapDragging ? "opacity-100" : "opacity-78")
                        : "opacity-95",
                    isBeautifulUI
                        ? "border-white/30 shadow-[0_16px_40px_rgba(33,36,41,0.18)]"
                        : (isMinimapHovered || isMinimapDragging
                            ? "border-[#776a54]/35 bg-[#eadfcb]/90 shadow-none"
                            : "border-transparent bg-[#eadfcb]/72 shadow-none"),
                    sharpEdges ? "rounded-none" : "rounded-[28px]"
                )}
                    data-ui-overlay
                    ref={minimapRef}
                    onPointerDown={onMinimapPointerDown}
                    onPointerMove={onMinimapPointerMove}
                    onPointerUp={onMinimapPointerUp}
                    onPointerCancel={onMinimapPointerUp}
                    onPointerEnter={() => setIsMinimapHovered(true)}
                    onPointerLeave={() => setIsMinimapHovered(false)}
                    style={{
                        backgroundColor: isBeautifulUI ? `${surfaceColor}cc` : undefined,
                        touchAction: 'none',
                    }}
                >
                    <div
                        className={clsx(
                            "pointer-events-none absolute inset-0",
                            sharpEdges ? "rounded-none" : "rounded-[28px]"
                        )}
                        style={{
                            background: isBeautifulUI
                                ? `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.42), transparent 38%), radial-gradient(circle at 70% 72%, ${accentColor}1f, transparent 45%)`
                                : undefined,
                        }}
                    />
                    <div className="relative h-full w-full">
                        {minimapDots}
                        <div
                            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                            style={{
                                left: `${(((-offset.x + window.innerWidth / 2) - WORLD_MIN_X) / WORLD_WIDTH) * 100}%`,
                                top: `${(((-offset.y + window.innerHeight / 2) - WORLD_MIN_Y) / WORLD_HEIGHT) * 100}%`,
                                width: '30px',
                                height: '30px',
                                background: `radial-gradient(circle, ${accentColor}40 0%, ${accentColor}24 45%, ${accentColor}10 70%, transparent 100%)`,
                                filter: 'blur(2px)',
                                boxShadow: `0 0 22px ${accentColor}30`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Global Selection Menu */}
            {globalSelection && (
                <SelectionMenu
                    x={globalSelection.x}
                    y={globalSelection.y}
                    isBeautifulUI={isBeautifulUI}
                    sharpEdges={sharpEdges}
                    onExpand={() => {
                        handleBranch(globalSelection.nodeId, globalSelection.text, 'expand', globalSelection.x, globalSelection.y, undefined, true);
                        setGlobalSelection(null);
                    }}
                    onAddToContext={() => {
                        addToContext(globalSelection.text, globalSelection.nodeId);
                        setGlobalSelection(null);
                    }}
                    onClose={() => setGlobalSelection(null)}
                />
            )}

            {/* Removed "X nodes selected" banner - unified with context buffer */}

            <div
                className="absolute inset-0"
                style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0px)`, willChange: 'transform' }}
            >
                {renderedNodes}
            </div>
        </div>
    );
};
