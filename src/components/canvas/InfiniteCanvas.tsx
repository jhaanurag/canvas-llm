
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Node, Connection, Message } from '@/types';
import { ChatNode } from './ChatNode';
import { NoteNode } from './NoteNode';
import { DrawingNode } from './DrawingNode';
import { Toolbar } from './Toolbar';
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

    const onMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && (e.altKey || activeTool === 'hand'))) {
            setIsPanning(true);
            e.preventDefault();
        }
        // Clear selection menu when clicking on the empty canvas
        if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-area')) {
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

    const addToContext = (text: string, sourceNodeId: string) => {
        setContextBuffer(prev => [...prev, { id: uuidv4(), text, sourceNodeId }]);
    };

    const removeFromContext = (id: string) => {
        setContextBuffer(prev => prev.filter(item => item.id !== id));
    };

    const handleBranch = useCallback((nodeId: string, selection: string, type: 'expand' | 'custom', customPrompt?: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        const childrenCount = connections.filter(c => c.fromId === node.id).length;
        const spacing = 500;
        const angle = (childrenCount * 40 - 20) * Math.PI / 180;
        const newX = node.x + spacing * Math.cos(angle);
        const newY = node.y + spacing * Math.sin(angle);
        const newNode = addNode('chat', newX + offset.x, newY + offset.y, node.id, selection);

        setTimeout(() => {
            const prompt = type === 'expand'
                ? `Deeper dive into "${selection}".`
                : customPrompt || `Question about "${selection}": `;

            let fullPrompt = prompt;
            if (contextBuffer.length > 0) {
                fullPrompt = `Using this specific context:\n${contextBuffer.map(i => `[CTX]: ${i.text}`).join('\n')}\n\n${prompt}`;
                setContextBuffer([]);
            }

            setNodes(prev => prev.map(n => n.id === newNode.id ? { ...n, initialPrompt: fullPrompt } : n));
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

            if (e.key === 'c') addNode('chat', -offset.x + window.innerWidth / 2, -offset.y + window.innerHeight / 2);
            if (e.key === 'n') addNode('note', -offset.x + window.innerWidth / 2, -offset.y + window.innerHeight / 2);
            if (e.key === 'd') addNode('drawing', -offset.x + window.innerWidth / 2, -offset.y + window.innerHeight / 2);
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


            <Toolbar
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                onAddNode={(type) => addNode(type, -offset.x + window.innerWidth / 2, -offset.y + window.innerHeight / 2)}
                onRecenter={() => setOffset({ x: 0, y: 0 })}
            />

            {/* Context Bar */}
            {contextBuffer.length > 0 && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000] flex flex-col items-center gap-2">
                    <div className="bg-white border-2 border-black p-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col min-w-[300px]">
                        <div className="bg-black text-white px-3 py-1 flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Knowledge Buffer</span>
                            <button onClick={() => setContextBuffer([])} className="text-[10px] hover:text-neutral-400 font-bold uppercase underline">Clear All</button>
                        </div>
                        <div className="p-2 flex flex-wrap gap-2 max-w-xl">
                            {contextBuffer.map(item => {
                                const words = item.text.trim().split(/\s+/).filter(w => w.length > 0);
                                const count = words.length;
                                const firstWords = words.slice(0, 2).join(' ');
                                const lastWords = words.slice(-2).join(' ');
                                const display = count > 4
                                    ? `(${firstWords} ... ${lastWords})`
                                    : `(${item.text})`;
                                return (
                                    <div key={item.id} className="bg-neutral-100 border-2 border-black px-2 py-1 flex items-center gap-3 animate-in slide-in-from-top-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                        <span className="text-[11px] font-black text-black uppercase tracking-tight">
                                            {display} <span className="ml-1 bg-black text-white px-1">{count} words</span>
                                        </span>
                                        <button
                                            onClick={() => removeFromContext(item.id)}
                                            className="hover:bg-black hover:text-white border border-transparent hover:border-black px-1 font-bold transition-colors"
                                        >
                                            ×
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

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
                    {/* Viewport indicator */}
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
                        handleBranch(globalSelection.nodeId, globalSelection.text, 'expand');
                        setGlobalSelection(null);
                    }}
                    onCustomAsk={(prompt: string) => {
                        handleBranch(globalSelection.nodeId, globalSelection.text, 'custom', prompt);
                        setGlobalSelection(null);
                    }}
                    onAddToContext={() => {
                        addToContext(globalSelection.text, globalSelection.nodeId);
                        setGlobalSelection(null);
                    }}
                    onClose={() => setGlobalSelection(null)}
                />
            )}

            {selectedNodeIds.length > 0 && (
                <div className="fixed top-4 left-4 z-[2000] bg-black text-white px-3 py-1 flex items-center gap-2 font-bold text-xs">
                    {selectedNodeIds.length} NODES SELECTED FOR CONTEXT
                    <button onClick={() => setSelectedNodeIds([])} className="hover:text-red-400">CLEAR</button>
                </div>
            )}

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
                                className="transition-all duration-300"
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
                            onBranch={(selection, type, customPrompt) => handleBranch(node.id, selection, type, customPrompt)}
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
                        />
                    );
                    return null;
                })}
            </div>
        </div>
    );
};
