
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Node, Connection, Message } from '@/types';
import { ChatNode } from './ChatNode';
import { NoteNode } from './NoteNode';
import { DrawingNode } from './DrawingNode';
import { SelectionMenu } from '@/components/ui/SelectionMenu';
import { v4 as uuidv4 } from 'uuid';

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
    const canvasRef = useRef<HTMLDivElement>(null);

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

                        // Avoid updating if the selection hasn't meaningfully changed (prevents flicker)
                        // But always show if we have text and no current global selection
                        setGlobalSelection({
                            text: text,
                            x: rect.left,
                            y: rect.bottom + 40,
                            nodeId: '' // Generic selection
                        });
                    } catch (e) {
                        // Ignore errors from getRangeAt if selection is invalid
                    }
                }
            });
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    const onMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && (e.altKey || activeTool === 'hand'))) {
            setIsPanning(true);
            e.preventDefault();
        }
        // Clear selection menu when clicking on the empty canvas (but not on nodes or menu)
        const target = e.target as HTMLElement;
        if (!target.closest('[data-selection-menu]') &&
            !target.closest('.pointer-events-auto') &&
            (target === canvasRef.current || target.classList.contains('canvas-area'))) {
            setGlobalSelection(null);
        }
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setOffset((prev) => ({
                x: prev.x + e.movementX,
                y: prev.y + e.movementY,
            }));
        }
    };

    const onMouseUp = () => {
        setIsPanning(false);
    };

    const addNode = useCallback((type: Node['type'], x: number, y: number, parentId?: string, sourceSelection?: string) => {
        const SNAP = 20;
        const newNode: Node = {
            id: uuidv4(),
            type,
            x: Math.round((x - offset.x) / SNAP) * SNAP,
            y: Math.round((y - offset.y) / SNAP) * SNAP,
            width: type === 'chat' ? 400 : type === 'note' ? 250 : 400,
            height: type === 'chat' ? 500 : type === 'note' ? 200 : 400,
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
    }, [offset]);

    const updateNodePos = (id: string, x: number, y: number) => {
        const SNAP = 20;
        const snappedX = Math.round(x / SNAP) * SNAP;
        const snappedY = Math.round(y / SNAP) * SNAP;
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, x: snappedX, y: snappedY } : n));
    };

    const bringToFront = useCallback((id: string) => {
        setNodes(prev => {
            const node = prev.find(n => n.id === id);
            if (!node || prev[prev.length - 1].id === id) return prev;
            return [...prev.filter(n => n.id !== id), node];
        });
    }, []);

    const updateNodeMessages = (id: string, messages: Message[]) => {
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, messages } : n));
    };

    const updateNodeContent = (id: string, content: string) => {
        setNodes((prev) => prev.map(n => n.id === id ? { ...n, content } : n));
    };

    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
        setSelectedNodeIds(prev => prev.filter(sid => sid !== id));
    };

    const toggleNodeSelection = (id: string) => {
        if (activeTool !== 'select') return;
        setSelectedNodeIds(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const addToContext = (text: string, sourceNodeId: string, image?: string) => {
        setContextBuffer(prev => [...prev, { id: uuidv4(), text, sourceNodeId, image }]);
    };

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
            newX = node.x + spacing * Math.cos(angle) + offset.x; // addNode subtracts offset, so adding it here cancels out to keep absolute logic coords? 
            // Wait, addNode does: x: Math.round((x - offset.x) / SNAP) * SNAP
            // node.x is ALREADY logic-space.
            // If we want newX to be logic-space relative to node.x, we should pass (node.x + dx + offset.x) to addNode?
            // Yes, because addNode subtracts offset.

            // logic-space position
            const targetX = node.x + spacing * Math.cos(angle);
            const targetY = node.y + spacing * Math.sin(angle);

            // Convert to screen-space for addNode
            newX = targetX + offset.x;
            newY = targetY + offset.y;
        }

        const newNode = addNode('chat', newX, newY, node?.id, selection);

        setTimeout(() => {
            const prompt = type === 'expand'
                ? `elaborate : "${selection}"`
                : customPrompt || `Question about "${selection}": `;

            let fullPrompt = prompt;
            if (useBuffer && contextBuffer.length > 0) {
                // Add extra newline before My Question as requested
                fullPrompt = `Using this specific context:\n${contextBuffer.map(i => `[CTX]: ${i.text}`).join('\n')}\n\n\n${prompt}`;
                setContextBuffer([]);
            }

            setNodes(prev => prev.map(n => n.id === newNode.id ? {
                ...n,
                initialPrompt: fullPrompt,
                autoSend: type === 'expand' // Auto-send only for expand flow
            } : n));
        }, 100);
    }, [nodes, connections, addNode, offset, contextBuffer]);

    useEffect(() => {
        if (nodes.length === 0) {
            addNode('chat', window.innerWidth / 2 - 200, window.innerHeight / 2 - 250);
        }
    }, [addNode, nodes.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === '1') addNode('chat', offset.x + window.innerWidth / 2, offset.y + window.innerHeight / 3);
            if (e.key === '2') addNode('note', offset.x + window.innerWidth / 2, offset.y + window.innerHeight / 3);
            if (e.key === '3') addNode('drawing', offset.x + window.innerWidth / 2, offset.y + window.innerHeight / 3);
            if (e.key === 'h') setOffset({ x: 0, y: 0 });
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [addNode, offset]);

    return (
        <div
            ref={canvasRef}
            className="relative w-screen h-screen overflow-hidden bg-neutral-100 font-sans canvas-area"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onDoubleClick={(e) => {
                if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-area')) {
                    addNode('note', e.clientX, e.clientY);
                }
            }}
            style={{ cursor: isPanning ? 'grabbing' : 'default' }}
        >




            {/* Unified Bottom UI - Attached Notch Toolbar */}
            <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-[2000] flex flex-col items-center">

                {/* Floating Dock "Notch" */}
                <div className="pointer-events-auto bg-white border-2 border-black border-b-0 p-1.5 flex items-center gap-4">
                    <button
                        className="p-2 hover:bg-neutral-100 rounded-none border border-transparent hover:border-black shrink-0"
                        onClick={() => setOffset({ x: 0, y: 0 })}
                        title="Recenter (H)"
                    >
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                        </svg>
                    </button>

                    <div className="flex gap-1.5">
                        <button
                            className="px-5 py-2.5 text-xs font-black uppercase hover:bg-black hover:text-white border-2 border-black rounded-none"
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

                                    // Pass context directly to input box via initialPrompt
                                    setTimeout(() => {
                                        setNodes(prev => prev.map(n => n.id === newNode.id ? {
                                            ...n,
                                            initialPrompt: `\n\nContext:\n${contextText}`,
                                            initialAttachments: images
                                        } : n));
                                        setContextBuffer([]);
                                    }, 100);
                                }
                            }}
                            title="New Chat (C)"
                        >
                            CHAT
                        </button>
                        <button
                            className="px-5 py-2.5 text-xs font-black uppercase hover:bg-black hover:text-white border-2 border-black rounded-none"
                            onClick={() => addNode('note', offset.x + window.innerWidth / 2, offset.y + window.innerHeight / 3)}
                            title="New Note (N)"
                        >
                            NOTE
                        </button>
                        <button
                            className="px-5 py-2.5 text-xs font-black uppercase hover:bg-black hover:text-white border-2 border-black rounded-none"
                            onClick={() => addNode('drawing', offset.x + window.innerWidth / 2, offset.y + window.innerHeight / 3)}
                            title="New Drawing (D)"
                        >
                            DRAW
                        </button>
                    </div>

                    <button
                        className="w-10 h-10 flex items-center justify-center hover:bg-neutral-100 border border-transparent hover:border-black font-bold text-sm shrink-0"
                        onClick={() => {
                            // TODO: Show shortcuts modal
                            alert('Shortcuts:\n1 = New Chat\n2 = New Note\n3 = New Drawing\nH = Recenter\nEsc = Clear Selection');
                        }}
                        title="Help & Shortcuts"
                    >
                        ?
                    </button>
                </div>

                {/* Context Buffer - Fixed at bottom */}
                {contextBuffer.length > 0 && (
                    <div className="pointer-events-auto w-full bg-white border-t-2 border-black py-2 px-4">
                        <div className="flex items-center gap-2 overflow-x-auto px-2 pb-1 scrollbar-thin scrollbar-thumb-black">
                            <span className="text-[9px] font-black uppercase tracking-wider shrink-0 text-neutral-600">CONTEXT:</span>
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
                                        className="bg-neutral-100 border-2 border-black px-4 py-1 shrink-0 hover:bg-red-100 hover:line-through"
                                        title="Click to remove"
                                    >
                                        <span className="text-[11px] font-semibold text-black">{display}</span>
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setContextBuffer([])}
                                className="text-[10px] font-bold uppercase text-red-500 hover:text-red-700 shrink-0 px-2"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}
            </div>


            <div className="fixed top-20 right-4 w-32 h-24 bg-white border-2 border-black z-[1000] opacity-80 pointer-events-none hidden md:block">
                <div className="relative w-full h-full">
                    {nodes.map(n => (
                        <div
                            key={n.id}
                            className="absolute border border-black bg-neutral-400"
                            style={{
                                left: `${50 + (n.x / 100)}%`,
                                top: `${50 + (n.y / 100)}%`,
                                width: '4px',
                                height: '4px',
                                backgroundColor: n.color
                            }}
                        />
                    ))}
                    <div
                        className="absolute border border-blue-500"
                        style={{
                            left: `${50 + (-offset.x / 100)}%`,
                            top: `${50 + (-offset.y / 100)}%`,
                            width: '10px',
                            height: '8px'
                        }}
                    />
                </div>
            </div>

            {/* Global Selection Menu */}
            {globalSelection && (
                <SelectionMenu
                    x={globalSelection.x}
                    y={globalSelection.y}
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
                style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
            >
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#000" />
                        </marker>
                    </defs>
                    {connections.map(conn => {
                        const from = nodes.find(n => n.id === conn.fromId);
                        const to = nodes.find(n => n.id === conn.toId);
                        if (!from || !to) return null;

                        const x1 = from.x + from.width / 2;
                        const y1 = from.y + from.height / 2;
                        const x2 = to.x + to.width / 2;
                        const y2 = to.y + to.height / 2;

                        // Bezier curve for smoother connections
                        const dx = (x2 - x1) / 2;
                        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                        return (
                            <path
                                key={conn.id}
                                d={d}
                                fill="transparent"
                                stroke="#000"
                                strokeWidth="2"
                                strokeDasharray={to.type === 'chat' ? 'none' : '4,4'}
                                markerEnd="url(#arrow)"
                                style={{ opacity: activeContextId === from.id ? 1 : 0.2 }}
                            />
                        );
                    })}
                </svg>

                {nodes.map(node => {
                    const isSelected = selectedNodeIds.includes(node.id);
                    if (node.type === 'chat') return (
                        <ChatNode
                            key={node.id}
                            node={node}
                            activeContextId={activeContextId}
                            setActiveContextId={setActiveContextId}
                            updatePos={(x, y) => updateNodePos(node.id, x, y)}
                            updateMessages={(msgs) => updateNodeMessages(node.id, msgs)}
                            updateContent={(content) => updateNodeContent(node.id, content)}
                            onDelete={() => deleteNode(node.id)}
                            onSelect={() => toggleNodeSelection(node.id)}
                            isSelected={isSelected}
                            selectedNodesContext={nodes.filter(n => selectedNodeIds.includes(n.id) && n.id !== node.id)}
                            onAddToContext={(text) => addToContext(text, node.id)}
                            onBranch={(selection, type, customPrompt) => handleBranch(node.id, selection, type, 0, 0, customPrompt)}
                            setGlobalSelection={(sel) => setGlobalSelection(sel ? { ...sel, nodeId: node.id } : null)}

                            onMouseDown={() => bringToFront(node.id)}
                        />
                    );
                    if (node.type === 'note') return (
                        <NoteNode
                            key={node.id}
                            node={node}
                            updatePos={(x, y) => updateNodePos(node.id, x, y)}
                            updateContent={(content) => updateNodeContent(node.id, content)}
                            onDelete={() => deleteNode(node.id)}
                            onSelect={() => toggleNodeSelection(node.id)}
                            isSelected={isSelected}
                            onMouseDown={() => bringToFront(node.id)}
                            setGlobalSelection={(sel) => setGlobalSelection(sel ? { ...sel, nodeId: node.id } : null)}
                            onAddToContext={addToContext}
                        />
                    );
                    if (node.type === 'drawing') return (
                        <DrawingNode
                            key={node.id}
                            node={node}
                            updatePos={(x, y) => updateNodePos(node.id, x, y)}
                            onDelete={() => deleteNode(node.id)}
                            onSelect={() => toggleNodeSelection(node.id)}
                            isSelected={isSelected}
                            onMouseDown={() => bringToFront(node.id)}
                            onAddToContext={addToContext}
                        />
                    );
                    return null;
                })}
            </div>
        </div>
    );
};
