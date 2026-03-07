
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Node, Connection, Message } from '@/types';
import { ChatNode } from './ChatNode';
import { NoteNode } from './NoteNode';
import { DrawingNode } from './DrawingNode';
import { SelectionMenu } from '@/components/ui/SelectionMenu';
import { v4 as uuidv4 } from 'uuid';
import { clsx } from 'clsx';

const WORLD_MIN_X = -5000;
const WORLD_MAX_X = 5000;
const WORLD_MIN_Y = -5000;
const WORLD_MAX_Y = 5000;
const WORLD_WIDTH = WORLD_MAX_X - WORLD_MIN_X;
const WORLD_HEIGHT = WORLD_MAX_Y - WORLD_MIN_Y;

export const InfiniteCanvas = () => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [activeTool, setActiveTool] = useState('select');
    const [activeContextId, setActiveContextId] = useState<string | null>(null);
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [contextBuffer, setContextBuffer] = useState<import('@/types').ContextItem[]>([]);
    const [globalSelection, setGlobalSelection] = useState<{ text: string; x: number; y: number; nodeId: string } | null>(null);
    const [showCanvasSettings, setShowCanvasSettings] = useState(false);
    const [isBeautifulUI, setIsBeautifulUI] = useState(false);
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [gridResolution, setGridResolution] = useState(20);
    const [sharpEdges, setSharpEdges] = useState(false);
    const [accentColor, setAccentColor] = useState('#0f766e');
    const [surfaceColor, setSurfaceColor] = useState('#fff8ed');
    const [gridColor, setGridColor] = useState('#1b2b33');
    const [textColor, setTextColor] = useState('#1b2b33');
    const [preferencesLoaded, setPreferencesLoaded] = useState(false);
    const [isSpacePanning, setIsSpacePanning] = useState(false);
    const [dockPosition, setDockPosition] = useState<'top' | 'bottom'>('top');
    const [toast, setToast] = useState<{ id: string; message: string; visible: boolean } | null>(null);
    const toastTimerRef = useRef<number | null>(null);
    const toastExitRef = useRef<number | null>(null);

    const showToast = useCallback((message: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        if (toastExitRef.current) clearTimeout(toastExitRef.current);
        
        const id = uuidv4();
        setToast({ id, message, visible: true });
        
        toastTimerRef.current = window.setTimeout(() => {
            setToast(prev => prev?.id === id ? { ...prev, visible: false } : prev);
            toastExitRef.current = window.setTimeout(() => {
                setToast(prev => prev?.id === id ? null : prev);
            }, 300);
        }, 3000);
    }, []);

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
        };
    }, []);

    useEffect(() => {
        const storedMode = window.localStorage.getItem('canvas-ui-mode');
        const nextIsBeautifulUI = storedMode === 'beautiful' ? true : storedMode === 'fast' ? false : false;

        const storedSnap = window.localStorage.getItem('canvas-snap-to-grid');
        const nextSnapToGrid = storedSnap === 'off' ? false : true;
        const storedGridResolution = Number(window.localStorage.getItem('canvas-grid-resolution') || '20');
        const nextGridResolution = Number.isFinite(storedGridResolution) && storedGridResolution >= 8 && storedGridResolution <= 120
            ? Math.round(storedGridResolution)
            : 20;
        const storedEdges = window.localStorage.getItem('canvas-edge-mode');
        const nextSharpEdges = storedEdges === 'sharp';
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

        const raf = requestAnimationFrame(() => {
            setIsBeautifulUI(nextIsBeautifulUI);
            setSnapToGrid(nextSnapToGrid);
            setGridResolution(nextGridResolution);
            setSharpEdges(nextSharpEdges);
            setAccentColor(nextAccentColor);
            setSurfaceColor(nextSurfaceColor);
            setGridColor(nextGridColor);
            setTextColor(nextTextColor);
            setDockPosition(nextDockPosition);
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
        window.localStorage.setItem('canvas-accent-color', accentColor);
        window.localStorage.setItem('canvas-surface-color', surfaceColor);
        window.localStorage.setItem('canvas-grid-color', gridColor);
        window.localStorage.setItem('canvas-text-color', textColor);
        window.localStorage.setItem('canvas-dock-position', dockPosition);
    }, [preferencesLoaded, isBeautifulUI, snapToGrid, gridResolution, sharpEdges, accentColor, surfaceColor, gridColor, textColor, dockPosition]);

    // Global selection listener for better reliability
    useEffect(() => {
        const handleSelectionChange = () => {
            // Wait for next tick to ensure selection is complete and layout is stable
            requestAnimationFrame(() => {
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
    }, [screenToWorld, snapToGrid, gridResolution, clampNodePosition]);

    const updateNodePos = useCallback((id: string, x: number, y: number) => {
        const nextX = snapToGrid ? Math.round(x / gridResolution) * gridResolution : x;
        const nextY = snapToGrid ? Math.round(y / gridResolution) * gridResolution : y;
        setNodes((prev) => prev.map((n) => {
            if (n.id !== id) return n;
            const clamped = clampNodePosition(nextX, nextY, n.width, n.height);
            return { ...n, x: clamped.x, y: clamped.y };
        }));
    }, [snapToGrid, gridResolution, clampNodePosition]);

    const bringToFront = useCallback((id: string) => {
        setNodes(prev => {
            const node = prev.find(n => n.id === id);
            if (!node || prev[prev.length - 1].id === id) return prev;
            return [...prev.filter(n => n.id !== id), node];
        });
    }, []);

    const updateNodeMessages = useCallback((id: string, messages: Message[]) => {
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, messages } : n));
    }, []);

    const updateNodeContent = useCallback((id: string, content: string) => {
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, content } : n));
    }, []);

    const updateNodeTitle = useCallback((id: string, title: string) => {
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, title } : n));
    }, []);

    const updateNodeSystemPrompt = useCallback((id: string, systemPrompt: string) => {
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, systemPrompt } : n));
    }, []);

    const deleteNode = useCallback((id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
        setSelectedNodeIds(prev => prev.filter(sid => sid !== id));
    }, []);

    const toggleNodeSelection = useCallback((id: string) => {
        if (activeToolRef.current !== 'select') return;
        setSelectedNodeIds(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    }, []);

    const addToContext = useCallback((text: string, sourceNodeId: string, image?: string) => {
        setContextBuffer(prev => [...prev, { id: uuidv4(), text, sourceNodeId, image }]);
    }, []);

    const removeFromContext = useCallback((id: string) => {
        setContextBuffer(prev => prev.filter(item => item.id !== id));
    }, []);

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
            if (useBuffer && contextBuffer.length > 0) {
                // Add extra newline before My Question as requested
                fullPrompt = `Using this specific context:\n${contextBuffer.map(i => `[CTX]: ${i.text}`).join('\n')}\n\n\n${prompt}`;
                setContextBuffer([]);
                hasAddedContext = true;
                showToast("Context added to new chat");
            }

            setNodes(prev => prev.map(n => n.id === newNode.id ? {
                ...n,
                initialPrompt: fullPrompt,
                hasInitialContext: hasAddedContext,
                autoSend: type === 'expand' // Auto-send only for expand flow
            } : n));
        }, 100);
    }, [nodes, connections, addNode, contextBuffer, worldToScreen, showToast]);

    useEffect(() => {
        if (nodes.length === 0) {
            const timer = window.setTimeout(() => {
                addNode('chat', window.innerWidth / 2 - 200, window.innerHeight / 2 - 250);
            }, 0);
            return () => window.clearTimeout(timer);
        }
    }, [addNode, nodes.length]);

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
            const currentOffset = offsetRef.current;

            if (e.code === 'Digit1' || e.code === 'Numpad1') {
                addNode('chat', currentOffset.x + window.innerWidth / 2, currentOffset.y + window.innerHeight / 3);
                return;
            }
            if (e.code === 'Digit2' || e.code === 'Numpad2') {
                addNode('note', currentOffset.x + window.innerWidth / 2, currentOffset.y + window.innerHeight / 3);
                return;
            }
            if (e.code === 'Digit3' || e.code === 'Numpad3') {
                addNode('drawing', currentOffset.x + window.innerWidth / 2, currentOffset.y + window.innerHeight / 3);
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
    }, [addNode]);

    const dockButtonClass = clsx(
        "inline-flex h-10 items-center justify-center border px-4 text-[11px] font-semibold leading-none tracking-wide",
        sharpEdges ? "rounded-none" : "rounded-[10px]",
        isBeautifulUI
            ? "border-[#21404a]/35 bg-[#fff8ed] hover:border-[color:var(--canvas-accent-70)]"
            : "border-[#776a54]/45 bg-[#f5eddc] hover:border-[#2f5664]"
    );
    const dockSettingsButtonClass = clsx(
        "inline-flex h-10 items-center justify-center border px-3 text-[11px] font-semibold leading-none",
        sharpEdges ? "rounded-none" : "rounded-[10px]",
        isBeautifulUI
            ? "border-[#21404a]/35 bg-[#fff8ed] hover:border-[color:var(--canvas-accent-70)]"
            : "border-[#776a54]/45 bg-[#f5eddc] hover:border-[#2f5664]"
    );
    const dockPanelWidthClass = "w-full max-w-[min(100vw-1.5rem,78rem)]";
    const dockContainerPositionClass = dockPosition === 'top'
        ? "top-3 pb-2 pt-[max(env(safe-area-inset-top),0px)]"
        : "bottom-3 pb-[max(env(safe-area-inset-bottom),0px)]";
    const dockMenuOrderClass = dockPosition === 'top' ? 'order-1' : 'order-3';
    const dockContextOrderClass = 'order-2';
    const dockSettingsOrderClass = dockPosition === 'top' ? 'order-3' : 'order-1';
    const minimapPositionClass = dockPosition === 'bottom' ? 'bottom-[8.25rem]' : 'bottom-4';
    const beautifulAppearClass = isBeautifulUI ? 'animate-in fade-in-0 duration-200 ease-out' : '';
    const gridLineColor = useMemo(() => {
        const hex = gridColor.replace('#', '');
        if (hex.length !== 6) return 'rgba(27, 43, 51, 0.1)';
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some(Number.isNaN)) return 'rgba(27, 43, 51, 0.1)';
        return `rgba(${r}, ${g}, ${b}, 0.12)`;
    }, [gridColor]);
    const panelRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[18px]';
    const segmentRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[12px]';
    const segmentButtonRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[10px]';
    const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
    const selectedContextNodes = useMemo(
        () => nodes.filter((node) => selectedNodeIdSet.has(node.id)),
        [nodes, selectedNodeIdSet]
    );
    const nodeById = useMemo(() => {
        const map = new Map<string, Node>();
        for (const node of nodes) map.set(node.id, node);
        return map;
    }, [nodes]);

    const renderedConnections = useMemo(() => (
        connections.map((conn) => {
            const from = nodeById.get(conn.fromId);
            const to = nodeById.get(conn.toId);
            if (!from || !to) return null;

            const x1 = from.x + from.width / 2;
            const y1 = from.y + from.height / 2;
            const x2 = to.x + to.width / 2;
            const y2 = to.y + to.height / 2;
            const dx = (x2 - x1) / 2;
            const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            return (
                <path
                    key={conn.id}
                    d={d}
                    fill="transparent"
                    stroke={activeContextId === from.id ? accentColor : '#206679'}
                    strokeWidth="2"
                    strokeDasharray={to.type === 'chat' ? 'none' : '4,4'}
                    markerEnd="url(#arrow-brand)"
                    style={{ opacity: activeContextId === from.id ? 1 : 0.24 }}
                />
            );
        })
    ), [activeContextId, accentColor, connections, nodeById]);

    const renderedNodes = useMemo(() => (
        nodes.map((node) => {
            const isSelected = selectedNodeIdSet.has(node.id);
            if (node.type === 'chat') {
                return (
                    <ChatNode
                        key={node.id}
                        node={node}
                        activeContextId={activeContextId}
                        setActiveContextId={setActiveContextId}
                        updatePos={(x, y) => updateNodePos(node.id, x, y)}
                        updateMessages={(msgs) => updateNodeMessages(node.id, msgs)}
                        updateContent={(content) => updateNodeContent(node.id, content)}
                        updateTitle={(title) => updateNodeTitle(node.id, title)}
                        updateSystemPrompt={(prompt) => updateNodeSystemPrompt(node.id, prompt)}
                        onDelete={() => deleteNode(node.id)}
                        onSelect={() => toggleNodeSelection(node.id)}
                        isSelected={isSelected}
                        isBeautifulUI={isBeautifulUI}
                        sharpEdges={sharpEdges}
                        accentColor={accentColor}
                        selectedNodesContext={selectedContextNodes}
                        onAddToContext={(text) => addToContext(text, node.id)}
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
                        onSelect={() => toggleNodeSelection(node.id)}
                        isSelected={isSelected}
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
                        onSelect={() => toggleNodeSelection(node.id)}
                        isSelected={isSelected}
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
        activeContextId,
        accentColor,
        addToContext,
        bringToFront,
        deleteNode,
        nodes,
        isBeautifulUI,
        sharpEdges,
        setActiveContextId,
        setGlobalSelection,
        selectedContextNodes,
        selectedNodeIdSet,
        toggleNodeSelection,
        updateNodeContent,
        updateNodeSystemPrompt,
        updateNodeTitle,
        updateNodeMessages,
        updateNodePos
    ]);

    const minimapDots = useMemo(() => (
        nodes.map((node) => (
            <div
                key={node.id}
                className={clsx("absolute border border-[#1b2b33]/30", sharpEdges ? "rounded-none" : "rounded-[2px]")}
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
        '--canvas-accent': accentColor
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
            style={{ ...cssVars, cursor: isPanning ? 'grabbing' : (isSpacePanning || activeTool === 'hand' ? 'grab' : 'default') }}
        >
            {isBeautifulUI && (
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        backgroundImage:
                            `linear-gradient(${gridLineColor} 1px, transparent 1px), linear-gradient(90deg, ${gridLineColor} 1px, transparent 1px)`,
                        backgroundPosition: `${offset.x}px ${offset.y}px`,
                        backgroundSize: `${gridResolution * 2}px ${gridResolution * 2}px`
                    }}
                />
            )}
            {/* Unified Dock UI */}
            <div data-ui-overlay className={clsx("pointer-events-none fixed left-0 right-0 z-[2000] flex flex-col items-center gap-2 px-3", dockContainerPositionClass)}>
                {showCanvasSettings && (
                    <div
                        className={clsx(
                            "pointer-events-auto border border-[#1b2b33]/25 px-3.5 py-3",
                            dockPanelWidthClass,
                            dockSettingsOrderClass,
                            panelRadiusClass,
                            beautifulAppearClass,
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
                                    sharpEdges ? "rounded-none" : "rounded-[10px]"
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
                                    sharpEdges ? "rounded-none" : "rounded-[10px]"
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
                                        sharpEdges ? "rounded-none" : "rounded-[10px]"
                                    )}
                                    style={{ color: textColor }}
                                />
                            </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-t border-[#1b2b33]/15 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold">Edge Mode</div>
                                <div className="text-[10px] opacity-70">Rounded keeps soft corners. Sharp uses straight edges.</div>
                            </div>
                            <button
                                className={clsx(
                                    "inline-flex h-9 min-w-24 self-start items-center justify-center border border-[#21404a]/35 bg-[#fff8ed] px-3 text-[11px] font-semibold hover:border-[color:var(--canvas-accent-70)] sm:min-w-28 sm:self-auto",
                                    sharpEdges ? "rounded-none" : "rounded-[10px]"
                                )}
                                onClick={() => setSharpEdges((prev) => !prev)}
                                title="Toggle edge style"
                                style={{ color: textColor }}
                            >
                                {sharpEdges ? 'Sharp' : 'Rounded'}
                            </button>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-t border-[#1b2b33]/15 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold">Menu Position</div>
                                <div className="text-[10px] opacity-70">Place the dock at the top or bottom.</div>
                            </div>
                            <div className={clsx(
                                "flex h-10 items-center gap-1 border p-1",
                                sharpEdges ? "rounded-none" : "rounded-[10px]",
                                isBeautifulUI
                                    ? "border-[#21404a]/35 bg-[#fff8ed]"
                                    : "border-[#776a54]/45 bg-[#f0e5cf]"
                            )}>
                                <button
                                    className={clsx(
                                        "inline-flex h-8 min-w-16 items-center justify-center px-3 text-[11px] font-semibold",
                                        sharpEdges ? "rounded-none" : "rounded-[8px]",
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
                                        sharpEdges ? "rounded-none" : "rounded-[8px]",
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
                                <div className="text-[12px] font-semibold">Colour</div>
                                <div className="text-[10px] opacity-70">Accent, surface, grid, and text colors.</div>
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                                <label
                                    className={clsx(
                                        "inline-flex h-9 items-center justify-center gap-1.5 border border-[#21404a]/35 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1b2b33]",
                                        sharpEdges ? "rounded-none" : "rounded-[10px]"
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
                                        sharpEdges ? "rounded-none" : "rounded-[10px]"
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
                                        sharpEdges ? "rounded-none" : "rounded-[10px]"
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
                                        sharpEdges ? "rounded-none" : "rounded-[10px]"
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
                            "pointer-events-auto border px-3 py-3",
                            dockPanelWidthClass,
                            dockContextOrderClass,
                            panelRadiusClass,
                            beautifulAppearClass,
                            isBeautifulUI
                                ? "border-[#1b2b33]/25"
                                : "border-[#776a54]/45 bg-[#f5eddc]",
                            isBeautifulUI && "shadow-[0_8px_20px_rgba(33,36,41,0.15)]"
                        )}
                        style={isBeautifulUI ? { backgroundColor: surfaceColor, color: textColor } : undefined}
                    >
                        <div className="flex items-center gap-2">
                            <span className="shrink-0 px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#486069]">Context:</span>
                            <div className="flex max-w-[min(58vw,40rem)] items-center gap-2 overflow-x-auto pb-0.5">
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
                                                "flex h-8 shrink-0 items-center gap-1 border px-3 text-[11px] hover:border-red-500/40 hover:text-red-700 hover:line-through",
                                                sharpEdges ? "rounded-none" : "rounded-[10px]",
                                                isBeautifulUI
                                                    ? "border-[#1b2b33]/25 bg-[#fffaf2] text-[#1b2b33]"
                                                    : "border-[#776a54]/45 bg-[#f0e5cf] text-[#21313a]"
                                            )}
                                            title="Click to remove"
                                        >
                                            <span className="font-medium">{display}</span>
                                            {item.image && (
                                                <span
                                                    className={clsx("inline-flex h-2 w-2", sharpEdges ? "rounded-none" : "rounded-full")}
                                                    style={{ backgroundColor: accentColor }}
                                                    title="Includes image context"
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setContextBuffer([])}
                                className={clsx(
                                    "inline-flex h-8 shrink-0 items-center border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-red-700 hover:bg-red-50",
                                    sharpEdges ? "rounded-none" : "rounded-[10px]",
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
                        "pointer-events-auto",
                        dockPanelWidthClass,
                        dockMenuOrderClass,
                        beautifulAppearClass,
                        isBeautifulUI
                            ? ["border border-[#1b2b33]/25 px-3 py-3", panelRadiusClass, "shadow-[0_10px_26px_rgba(33,36,41,0.18)]"]
                            : "px-0 py-0"
                    )}
                    style={isBeautifulUI ? { backgroundColor: surfaceColor, color: textColor } : undefined}
                >
                    <div className="overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex w-max min-w-full items-center justify-center gap-2 pb-0.5" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
                            {isBeautifulUI && (
                                <div className={clsx(
                                    "inline-flex h-10 items-center border px-3 text-[11px] font-semibold tracking-[0.14em]",
                                    sharpEdges ? "rounded-none" : "rounded-[10px]",
                                    "border-[#21404a]/35 bg-[#fff8ed]"
                                )} style={{ color: textColor }}>
                                    Canvas Atlas
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
                                    "inline-flex h-8 min-w-16 items-center justify-center px-3 text-[11px] font-semibold",
                                    segmentButtonRadiusClass,
                                    activeTool === 'select'
                                        ? "text-[#f8fffd]"
                                        : "text-[#1b2b33] hover:bg-[#e9dcc4]"
                                )}
                                onClick={() => setActiveTool('select')}
                                title="Select mode"
                                style={activeTool === 'select' ? { backgroundColor: accentColor } : { color: textColor }}
                            >
                                Select
                            </button>
                            <button
                                className={clsx(
                                    "inline-flex h-8 min-w-16 items-center justify-center px-3 text-[11px] font-semibold",
                                    segmentButtonRadiusClass,
                                    activeTool === 'hand'
                                        ? "text-[#f8fffd]"
                                        : "text-[#1b2b33] hover:bg-[#e9dcc4]"
                                )}
                                onClick={() => setActiveTool('hand')}
                                title="Hand mode"
                                style={activeTool === 'hand' ? { backgroundColor: accentColor } : { color: textColor }}
                            >
                                Pan
                            </button>
                        </div>

                        <button
                            className={dockButtonClass}
                            onClick={() => {
                                const newNode = addNode('chat', offset.x + window.innerWidth / 2, offset.y + window.innerHeight / 3);
                                if (contextBuffer.length > 0) {
                                    const contextText = contextBuffer.map(i => i.text).join('\n\n');
                                    const images = contextBuffer
                                        .filter(i => i.image)
                                        .map(i => ({
                                            data: i.image!,
                                            mimeType: 'image/png',
                                            name: 'drawing.png'
                                        }));

                                    setTimeout(() => {
                                        setNodes(prev => prev.map(n => n.id === newNode.id ? {
                                            ...n,
                                            initialPrompt: `\n\nContext:\n${contextText}`,
                                            hasInitialContext: true,
                                            initialAttachments: images
                                        } : n));
                                        setContextBuffer([]);
                                        showToast("Context added to new chat");
                                    }, 100);
                                }
                            }}
                            title="New Chat (1)"
                            style={{ color: textColor }}
                        >
                            New Chat
                        </button>
                        <button
                            className={dockButtonClass}
                            onClick={() => addNode('note', offset.x + window.innerWidth / 2, offset.y + window.innerHeight / 3)}
                            title="New Note (2)"
                            style={{ color: textColor }}
                        >
                            New Note
                        </button>
                        <button
                            className={dockButtonClass}
                            onClick={() => addNode('drawing', offset.x + window.innerWidth / 2, offset.y + window.innerHeight / 3)}
                            title="New Drawing (3)"
                            style={{ color: textColor }}
                        >
                            New Drawing
                        </button>
                        <button
                            className={dockSettingsButtonClass}
                            onClick={() => setShowCanvasSettings((prev) => !prev)}
                            title="Canvas settings"
                            style={{ color: textColor }}
                        >
                            Settings
                        </button>
                            <button
                                className={dockButtonClass}
                                onClick={() => {
                                    alert('Shortcuts:\n1 = New Chat\n2 = New Note\n3 = New Drawing\nHold Space + Drag = Pan');
                                }}
                                title="Help & Shortcuts"
                                style={{ color: textColor }}
                            >
                                Shortcuts
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {isBeautifulUI && (
                <div className={clsx(
                    "fixed right-4 z-[1000] hidden h-24 w-32 border border-[#1b2b33]/30 p-1 shadow-[0_6px_16px_rgba(33,36,41,0.16)] transition-opacity duration-200 ease-out md:block",
                    minimapPositionClass,
                    isMinimapHovered || isMinimapDragging ? "opacity-100" : "opacity-70",
                    beautifulAppearClass,
                    sharpEdges ? "rounded-none" : "rounded-[18px]"
                )}
                    data-ui-overlay
                    ref={minimapRef}
                    onPointerDown={onMinimapPointerDown}
                    onPointerMove={onMinimapPointerMove}
                    onPointerUp={onMinimapPointerUp}
                    onPointerCancel={onMinimapPointerUp}
                    onPointerEnter={() => setIsMinimapHovered(true)}
                    onPointerLeave={() => setIsMinimapHovered(false)}
                    style={{ backgroundColor: surfaceColor, touchAction: 'none' }}
                >
                    <div className="relative h-full w-full">
                        {minimapDots}
                        <div
                            className={clsx("absolute border", sharpEdges ? "rounded-none" : "rounded-[2px]")}
                            style={{
                                left: `${((-offset.x - WORLD_MIN_X) / WORLD_WIDTH) * 100}%`,
                                top: `${((-offset.y - WORLD_MIN_Y) / WORLD_HEIGHT) * 100}%`,
                                width: '10px',
                                height: '8px',
                                borderColor: accentColor
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
                    onCustomAsk={(prompt: string) => {
                        handleBranch(globalSelection.nodeId, globalSelection.text, 'custom', globalSelection.x, globalSelection.y, prompt, true);
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
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <defs>
                        <marker id="arrow-brand" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill={accentColor} />
                        </marker>
                    </defs>
                    {renderedConnections}
                </svg>
                {renderedNodes}
            </div>
        </div>
    );
};
