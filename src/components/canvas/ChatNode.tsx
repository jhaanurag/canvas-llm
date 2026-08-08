
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Node, Message, MemoryEntry } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { streamGeminiResponse } from '@/lib/llm';
import { v4 as uuidv4 } from 'uuid';
import { Send, Plus, X, GripVertical, Paperclip, Settings, Droplets, GitBranchPlus, Trash2, ChevronUp, ChevronDown, Brain, Scissors, PencilLine, Archive, LoaderCircle, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatNodeProps {
    node: Node;
    updatePos: (x: number, y: number) => void;
    updateMessages: (messages: Message[]) => void;
    updateTitle: (title: string) => void;
    updateSystemPrompt: (prompt: string) => void;
    updateMemoryEntries: (entries: MemoryEntry[]) => void;
    onDelete: () => void;
    onMouseDown: () => void;
    onAddToContext: (text: string, nodeId: string) => void;
    onBranchFromMessage: (messageIndex: number) => void;
    onSpawnChats: (specs: { title?: string; prompt: string }[]) => void;
    setGlobalSelection: (selection: { text: string; x: number; y: number } | null) => void;
    isBeautifulUI?: boolean;
    sharpEdges?: boolean;
    accentColor?: string;
    animationsEnabled?: boolean;
}

const ChatNodeComponent = ({
    node,
    updatePos,
    updateMessages,
    updateTitle,
    updateSystemPrompt,
    updateMemoryEntries,
    onDelete,
    onMouseDown,
    onAddToContext,
    onBranchFromMessage,
    onSpawnChats,
    setGlobalSelection,
    isBeautifulUI = false,
    sharpEdges = false,
    accentColor = '#0f766e',
    animationsEnabled = true,
}: ChatNodeProps) => {
    const MEMORY_REQUEST_PATTERN = /^\s*\(\(ask_memory:\s*([\s\S]+?)\s*\)\)\s*$/i;
    const SPAWN_CHATS_PATTERN = /^\s*\(\(spawn_chats:\s*([\s\S]+?)\s*\)\)\s*$/i;
    const MAIN_AGENT_ROUTER_PROMPT = `
If the answer can be produced from the active conversation, answer normally.
If the user is asking for information that may only exist in offloaded memory, reply with exactly one line in this format and nothing else:
((ask_memory: short focused retrieval question))
Never expose or explain this syntax to the user.
`;
    const SPAWN_CHAT_WINDOWS_PROMPT = `
If the user explicitly asks you to open, spawn, create, or make new chat windows/chats for deeper dives, or says "yes" after you offered deep-dive chat windows, reply with exactly one line in this format and nothing else:
((spawn_chats: [{"title":"Short title","prompt":"Prompt for the new chat"}]))
Use valid JSON. Keep titles short and prompts specific. Never expose or explain this syntax to the user.
`;
    const MEMORY_SUBAGENT_SYSTEM_PROMPT = `
You are the memory subagent for one chat window.
You can only answer from the offloaded memory blocks provided to you.
Be concise and retrieval-focused.
If the answer is not present in memory, say exactly: NOT_FOUND
`;
    const shellRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius)]';
    const outerRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius)]';
    const headerButtonRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius-xs)]';
    const controlRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius-sm)]';

    const cssVars = {
        '--node-accent': accentColor,
        '--node-accent-15': `${accentColor}26`,
        '--node-accent-70': `${accentColor}b3`,
        '--node-accent-dark': accentColor, // optionally darken
    } as React.CSSProperties;
    const accentTextColor = React.useMemo(() => {
        const hex = accentColor.replace('#', '');
        if (hex.length !== 6) return '#f8fffd';
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some(Number.isNaN)) return '#f8fffd';
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return luminance > 150 ? '#1b2b33' : '#f8fffd';
    }, [accentColor]);

    const [input, setInput] = useState(node.initialPrompt || '');

    // Sync input with initialPrompt when it arrives (since it's set via setTimeout)
    useEffect(() => {
        const initialPrompt = node.initialPrompt;
        if (initialPrompt && input === '' && node.messages.length === 0) {
            setInput(initialPrompt);
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    const end = initialPrompt.length;
                    inputRef.current.setSelectionRange(end, end);
                }
            }, 10);
        }
    }, [input, node.initialPrompt, node.messages.length]);
    const [isDragging, setIsDragging] = useState(false);
    const [activePanel, setActivePanel] = useState<'chat' | 'system' | 'memory'>('chat');
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<{ data: string; mimeType: string; name: string }[]>(node.initialAttachments || []);

    useEffect(() => {
        if (node.initialAttachments && attachedFiles.length === 0 && node.messages.length === 0) {
            setAttachedFiles(node.initialAttachments);
        }
    }, [attachedFiles.length, node.initialAttachments, node.messages.length]);
    const [systemPrompt, setSystemPrompt] = useState(node.systemPrompt || 'You are a helpful AI assistant. Do not reveal the internal workings to the user.');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [title, setTitle] = useState(node.title || '');
    const [bubbleTransparencyMode, setBubbleTransparencyMode] = useState<'auto' | 'solid'>('auto');
    const [contextFeedback, setContextFeedback] = useState<string | null>(null);
    const [messageMenu, setMessageMenu] = useState<{ index: number; x: number; y: number } | null>(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [isCompressing, setIsCompressing] = useState<number | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [memoryDraft, setMemoryDraft] = useState('');
    const [memoryWorkflow, setMemoryWorkflow] = useState<{
        phase: 'asking' | 'understanding' | 'complete' | 'error';
        detail?: string;
    } | null>(null);
    const [assistantActivity, setAssistantActivity] = useState<string | null>(null);
    const [isNodeEntered, setIsNodeEntered] = useState(() => !animationsEnabled || Date.now() - (node.createdAt ?? 0) > 1200);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const nodeShellRef = useRef<HTMLDivElement>(null);
    const messageMenuRef = useRef<HTMLDivElement>(null);

    const messagesViewportRef = useRef<HTMLDivElement>(null);
    const showChrome = isHovered || isDragging || isEditingTitle;
    const isActive = showChrome || input || attachedFiles.length > 0 || isSending;
    const dimBubbles = bubbleTransparencyMode === 'auto' && !showChrome;
    const hasInitialImageContext = Boolean(node.initialAttachments?.some((file) => file.mimeType.startsWith('image/')));
    const memoryEntries = node.memoryEntries ?? [];
    const activeStatusLabel = memoryWorkflow?.detail ?? assistantActivity;

    useEffect(() => {
        const viewport = messagesViewportRef.current;
        if (!viewport) return;
        requestAnimationFrame(() => {
            viewport.scrollTop = viewport.scrollHeight;
        });
    }, [node.messages]);

    useEffect(() => {
        if (!animationsEnabled) {
            setIsNodeEntered(true);
            return;
        }
        if (Date.now() - (node.createdAt ?? 0) > 1200) {
            setIsNodeEntered(true);
            return;
        }
        const frame = requestAnimationFrame(() => setIsNodeEntered(true));
        return () => cancelAnimationFrame(frame);
    }, [animationsEnabled, node.createdAt]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        onMouseDown();
        if ((e.target as HTMLElement).closest('.drag-handle') && !(e.target as HTMLElement).closest('[data-no-drag]')) {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsDragging(true);
            setDragStart({ x: e.clientX - node.x, y: e.clientY - node.y });
            e.stopPropagation();
        } else {
            setGlobalSelection(null);
            e.stopPropagation();
        }
    };

    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (isDragging) {
                updatePos(e.clientX - dragStart.x, e.clientY - dragStart.y);
            }
        };
        const handlePointerUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            window.addEventListener('pointercancel', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [isDragging, dragStart, updatePos]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (rev) => {
                setAttachedFiles(prev => [...prev, {
                    data: rev.target?.result as string,
                    mimeType: file.type,
                    name: file.name
                }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const collectStreamText = useCallback(async (
        prompt: string,
        history: { role: 'user' | 'assistant' | 'model'; text: string }[] = [],
        files: { data: string; mimeType: string }[] = [],
        promptOverride?: string
    ) => {
        let text = '';
        const stream = streamGeminiResponse(prompt, history, files, promptOverride ?? systemPrompt);
        for await (const chunk of stream) {
            text += chunk;
        }
        return text;
    }, [systemPrompt]);

    const buildVisibleHistory = useCallback((messages: Message[]): { role: 'user' | 'assistant'; text: string }[] => (
        messages
            .filter((message) => !message.hiddenFromModel)
            .map((message) => ({
                role: message.role === 'user' ? 'user' : 'assistant',
                text: message.kind === 'memory-response'
                    ? `Memory subagent: ${message.text}`
                    : message.text,
            }))
    ), []);

    const buildMemoryBankText = useCallback(() => (
        memoryEntries
            .map((entry, index) => `Memory ${index + 1}:\n${entry.text}`)
            .join('\n\n---\n\n')
    ), [memoryEntries]);

    useEffect(() => {
        setMemoryDraft(buildMemoryBankText());
    }, [buildMemoryBankText]);

    useEffect(() => {
        if (!memoryWorkflow) return;
        if (memoryWorkflow.phase === 'asking' || memoryWorkflow.phase === 'understanding') return;
        const timer = window.setTimeout(() => setMemoryWorkflow(null), memoryWorkflow.phase === 'complete' ? 1100 : 1800);
        return () => window.clearTimeout(timer);
    }, [memoryWorkflow]);

    const saveMemoryDraft = useCallback((nextDraft: string) => {
        setMemoryDraft(nextDraft);
        const sections = nextDraft
            .split(/\n{2,}(?:---|={3,})\n{2,}/)
            .map((section) => section.trim())
            .filter(Boolean);
        updateMemoryEntries(sections.map((section, index) => ({
            id: memoryEntries[index]?.id ?? uuidv4(),
            text: section.replace(/^Memory\s+\d+:\s*/i, '').trim(),
            sourceText: memoryEntries[index]?.sourceText,
            createdAt: memoryEntries[index]?.createdAt ?? Date.now(),
        })));
    }, [memoryEntries, updateMemoryEntries]);

    const shouldForceMemoryLookup = useCallback((text: string) => (
        /\b(memory|subagent|offload|offloaded|stored|store|remember|context)\b/i.test(text)
    ), []);

    const parseSpawnSpecs = useCallback((rawSpec: string) => {
        try {
            const parsed = JSON.parse(rawSpec) as { title?: string; prompt?: string }[];
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter((entry) => typeof entry?.prompt === 'string' && entry.prompt.trim())
                .map((entry) => ({
                    title: typeof entry.title === 'string' ? entry.title.trim() : undefined,
                    prompt: entry.prompt!.trim(),
                }));
        } catch (error) {
            console.error('Failed to parse spawn chat specs:', error);
            return [];
        }
    }, []);

    const startEditingMessage = useCallback((index: number) => {
        const message = node.messages[index];
        if (!message) return;
        setEditingMessageIndex(index);
        setEditingValue(message.text);
        setMessageMenu(null);
    }, [node.messages]);

    const saveEditedMessage = useCallback(() => {
        if (editingMessageIndex === null) return;
        const nextValue = editingValue.trim();
        if (!nextValue) return;
        updateMessages(node.messages.map((message, index) => (
            index === editingMessageIndex
                ? {
                    ...message,
                    text: nextValue,
                    sourceText: message.sourceText ?? message.text,
                    kind: message.kind === 'memory-response' ? 'memory-response' : 'compressed',
                }
                : message
        )));
        setEditingMessageIndex(null);
        setEditingValue('');
    }, [editingMessageIndex, editingValue, node.messages, updateMessages]);

    const compressMessage = useCallback(async (index: number) => {
        const targetMessage = node.messages[index];
        if (!targetMessage || isCompressing !== null) return;
        setMessageMenu(null);
        setIsCompressing(index);
        try {
            const compressedText = await collectStreamText(
                `Compress the following message for future context retention. Keep the most important facts, constraints, filenames, decisions, and unresolved questions. Return only the compressed text.\n\nMessage:\n${targetMessage.text}`,
                [],
                [],
                'You are a terse memory compressor. Produce a compact but information-dense summary without commentary.'
            );
            updateMessages(node.messages.map((message, messageIndex) => (
                messageIndex === index
                    ? {
                        ...message,
                        text: compressedText.trim() || message.text,
                        sourceText: message.sourceText ?? message.text,
                        kind: 'compressed',
                    }
                    : message
            )));
        } catch (error) {
            console.error('Compression error:', error);
        } finally {
            setIsCompressing(null);
        }
    }, [collectStreamText, isCompressing, node.messages, updateMessages]);

    const offloadMessage = useCallback((index: number) => {
        const targetMessage = node.messages[index];
        if (!targetMessage) return;
        updateMemoryEntries([
            ...memoryEntries,
            {
                id: uuidv4(),
                text: targetMessage.text,
                sourceText: targetMessage.sourceText,
                createdAt: Date.now(),
            }
        ]);
        updateMessages(node.messages.filter((_, messageIndex) => messageIndex !== index));
        setMessageMenu(null);
    }, [memoryEntries, node.messages, updateMemoryEntries, updateMessages]);

    const sendMessage = useCallback(async (overridePrompt?: string) => {
        const text = overridePrompt || input;
        if (!text.trim() && attachedFiles.length === 0) return;
        if (isSending) return;

        const userMsg: Message = {
            id: uuidv4(),
            role: 'user',
            text: overridePrompt || input, // Show clean input to user
            timestamp: Date.now(),
            attachments: [...attachedFiles]
        };

        const newMessages = [...node.messages, userMsg];
        const assistantMsgId = uuidv4();
        const assistantMsg: Message = {
            id: assistantMsgId,
            role: 'model',
            text: '',
            timestamp: Date.now(),
        };
        updateMessages([...newMessages, assistantMsg]);
        setInput('');
        const filesToSend = [...attachedFiles];
        setAttachedFiles([]);
        setIsSending(true);
        setMemoryWorkflow(null);
        setAssistantActivity('Agent thinking');
        try {
            const history: { role: 'user' | 'assistant'; text: string }[] = buildVisibleHistory(node.messages);
            const hasMemory = memoryEntries.length > 0;
            let orchestratorResponse = '';
            const forcedMemoryLookup = hasMemory && shouldForceMemoryLookup(text);

            if (hasMemory && !forcedMemoryLookup) {
                orchestratorResponse = await collectStreamText(
                    text,
                    history,
                    filesToSend,
                    `${systemPrompt}\n\n${MAIN_AGENT_ROUTER_PROMPT}\n\n${SPAWN_CHAT_WINDOWS_PROMPT}`
                );
            } else if (!hasMemory) {
                orchestratorResponse = await collectStreamText(
                    text,
                    history,
                    filesToSend,
                    `${systemPrompt}\n\n${SPAWN_CHAT_WINDOWS_PROMPT}`
                );
            }

            const spawnMatch = orchestratorResponse.match(SPAWN_CHATS_PATTERN);
            const spawnSpecs = spawnMatch ? parseSpawnSpecs(spawnMatch[1]) : [];
            if (spawnSpecs.length > 0) {
                setAssistantActivity('Opening deep-dive chats');
                onSpawnChats(spawnSpecs);
                updateMessages([...newMessages, {
                    ...assistantMsg,
                    text: `Opened ${spawnSpecs.length} deep-dive chat${spawnSpecs.length === 1 ? '' : 's'}.`,
                }]);
                setAssistantActivity(null);
                return;
            }

            const memoryMatch = hasMemory ? orchestratorResponse.match(MEMORY_REQUEST_PATTERN) : null;
            const memoryQuery = forcedMemoryLookup
                ? text.trim()
                : memoryMatch?.[1]?.trim() ?? '';
            const workingMessages = [...newMessages];

            if (hasMemory && memoryQuery) {
                setAssistantActivity(null);
                setMemoryWorkflow({
                    phase: 'asking',
                    detail: 'Asking memory subagent',
                });

                const memoryAnswer = await collectStreamText(
                    `Stored memory:\n${buildMemoryBankText()}\n\nQuestion:\n${memoryQuery}\n\nAnswer only from stored memory. If the user is asking what memory exists, list the stored memory clearly.`,
                    [],
                    [],
                    MEMORY_SUBAGENT_SYSTEM_PROMPT
                );

                setMemoryWorkflow({
                    phase: 'understanding',
                    detail: 'Understanding response',
                });

                let assistantText = '';
                setAssistantActivity('Drafting final answer');

                const finalHistory: { role: 'user' | 'assistant'; text: string }[] = [
                    ...buildVisibleHistory(workingMessages),
                    {
                        role: 'assistant',
                        text: `Memory subagent: ${memoryAnswer.trim() || 'NOT_FOUND'}`,
                    }
                ];
                const finalStream = streamGeminiResponse(
                    text,
                    finalHistory,
                    filesToSend,
                    `${systemPrompt}\n\nYou have already queried the memory subagent for this turn. Do not say you lack access to subagents or memory tools. Use the memory subagent result above if it helps answer the user.`
                );
                for await (const chunk of finalStream) {
                    if (assistantText.length === 0) {
                        setAssistantActivity(null);
                    }
                    assistantText += chunk;
                    updateMessages([
                        ...workingMessages,
                        { ...assistantMsg, text: assistantText },
                    ]);
                }
                setAssistantActivity(null);
                setMemoryWorkflow({
                    phase: 'complete',
                    detail: 'Memory sync complete',
                });
            } else {
                if (hasMemory) {
                    setAssistantActivity(null);
                    updateMessages([...workingMessages, { ...assistantMsg, text: orchestratorResponse }]);
                } else {
                    setAssistantActivity(null);
                    updateMessages([...workingMessages, { ...assistantMsg, text: orchestratorResponse }]);
                    setAssistantActivity(null);
                }
            }
        } catch (error) {
            console.error('Gemini error:', error);
            setAssistantActivity(null);
            setMemoryWorkflow({
                phase: 'error',
                detail: 'Memory sync failed',
            });
            updateMessages([...newMessages, {
                ...assistantMsg,
                text: 'Error: Failed to get response.',
            }]);
        } finally {
            setAssistantActivity(null);
            setIsSending(false);
        }
    }, [MEMORY_REQUEST_PATTERN, MAIN_AGENT_ROUTER_PROMPT, MEMORY_SUBAGENT_SYSTEM_PROMPT, SPAWN_CHAT_WINDOWS_PROMPT, SPAWN_CHATS_PATTERN, attachedFiles, buildMemoryBankText, buildVisibleHistory, collectStreamText, input, isSending, memoryEntries.length, node.messages, onSpawnChats, parseSpawnSpecs, shouldForceMemoryLookup, systemPrompt, updateMessages]);

    useEffect(() => {
        if (node.autoSend && node.initialPrompt && node.messages.length === 0) {
            sendMessage(node.initialPrompt);
        }
    }, [node.autoSend, node.initialPrompt, node.messages.length, sendMessage]);

    useEffect(() => {
        if (!contextFeedback) return;
        const timer = window.setTimeout(() => setContextFeedback(null), 1800);
        return () => window.clearTimeout(timer);
    }, [contextFeedback]);

    useEffect(() => {
        if (!messageMenu) return;
        const closeMenu = (event: PointerEvent) => {
            const target = event.target as globalThis.Node | null;
            if (target && messageMenuRef.current?.contains(target)) return;
            setMessageMenu(null);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMessageMenu(null);
            }
        };
        document.addEventListener('pointerdown', closeMenu, true);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', closeMenu, true);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [messageMenu]);

    const deleteMessagesAbove = (index: number) => {
        updateMessages(node.messages.slice(index));
        setMessageMenu(null);
    };

    const deleteMessagesBelow = (index: number) => {
        updateMessages(node.messages.slice(0, index + 1));
        setMessageMenu(null);
    };

    const removeSingleMessage = (index: number) => {
        updateMessages(node.messages.filter((_, msgIndex) => msgIndex !== index));
        setMessageMenu(null);
    };

    const openMessageMenu = (index: number, clientX: number, clientY: number) => {
        const shell = nodeShellRef.current;
        if (!shell) return;
        const shellRect = shell.getBoundingClientRect();
        const menuWidth = 196;
        const menuHeight = 292;
        const padding = 12;
        const localX = clientX - shellRect.left;
        const localY = clientY - shellRect.top;
        const nextX = Math.min(localX + 8, shellRect.width - menuWidth - padding);
        const nextY = Math.min(localY + 8, shellRect.height - menuHeight - padding);
        setMessageMenu({ index, x: Math.max(padding, nextX), y: Math.max(padding, nextY) });
    };

    return (
        <div
            ref={nodeShellRef}
            className={clsx(
                "absolute pointer-events-auto select-none",
                outerRadiusClass,
                isDragging && "cursor-grabbing"
            )}
            style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                zIndex: isDragging ? 100 : 10,
                opacity: isNodeEntered ? 1 : 0,
                transform: isNodeEntered ? 'scale(1)' : 'scale(0.92)',
                transition: animationsEnabled ? 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease-out' : undefined,
                transformOrigin: '50% 50%',
                ...cssVars,
            }}
            onMouseEnter={() => {
                setIsHovered(true);
            }}
            onMouseLeave={() => {
                setIsHovered(false);
            }}
            onPointerDown={handlePointerDown}
        >
            <Card
                className={clsx(
                    "flex relative z-10 h-full flex-col overflow-hidden border",
                    shellRadiusClass,
                    showChrome
                        ? isBeautifulUI
                            ? "border-[#1b2b33]/35 bg-[#fff8ed] shadow-[0_16px_36px_rgba(33,36,41,0.18)]"
                            : "border-[#1b2b33]/35 bg-[#fff8ed]"
                        : "border-transparent bg-transparent"
                )}
                style={{ padding: 0, gap: 0 }}
            >
                <div
                    className={clsx(
                        "drag-handle flex h-10 shrink-0 cursor-grab items-center justify-between border-b border-[#1b2b33]/20 bg-[#edf5f8]/90 px-3.5 active:cursor-grabbing",
                        showChrome ? "opacity-100" : "opacity-0"
                    )}
                    style={{ touchAction: 'none' }}
                >
                    <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-[#1b2b33]/70" />
                        {isEditingTitle ? (
                            <input
                                data-no-drag
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={() => {
                                    setIsEditingTitle(false);
                                    updateTitle(title);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsEditingTitle(false);
                                        updateTitle(title);
                                    }
                                }}
                                className="w-24 border-none bg-transparent text-[10px] font-semibold uppercase tracking-[0.12em] text-[#22363f] outline-none"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                data-no-drag
                                className={clsx(
                                    "cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[#22363f] hover:text-[color:var(--node-accent)]",
                                )}
                                style={{ color: isEditingTitle ? accentColor : undefined }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingTitle(true);
                                }}
                            >
                                {title || 'Untitled'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            data-no-drag
                            size="icon"
                            variant="ghost"
                            className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", headerButtonRadiusClass)}
                            onClick={(e) => {
                                e.stopPropagation();
                                const allText = node.messages.map((m: Message) => `${m.role}: ${m.text}`).join('\n\n').trim();
                                const contextText = allText || node.initialPrompt?.trim() || node.title?.trim() || 'Chat context';
                                onAddToContext(contextText, node.id);
                                setContextFeedback('Context added');
                            }} title="Add chat to context"
                        >
                            <Plus size={16} />
                        </Button>
                        {memoryEntries.length > 0 && (
                            <Button
                                data-no-drag
                                size="icon"
                                variant="ghost"
                                className={clsx("relative h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", headerButtonRadiusClass)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActivePanel((prev) => (prev === 'memory' ? 'chat' : 'memory'));
                                }}
                                title="Open memory subagent"
                            >
                                <Brain size={16} style={activePanel === 'memory' ? { color: accentColor } : undefined} />
                                <span
                                    className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center px-1 text-[9px] font-semibold leading-4 text-[#f8fffd]"
                                    style={{ backgroundColor: accentColor, borderRadius: sharpEdges ? 0 : 999 }}
                                >
                                    {memoryEntries.length}
                                </span>
                            </Button>
                        )}
                        <Button
                            data-no-drag
                            size="icon"
                            variant="ghost"
                            className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", headerButtonRadiusClass)}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActivePanel((prev) => (prev === 'system' ? 'chat' : 'system'));
                            }}
                        >
                            <Settings size={16} style={activePanel === 'system' ? { color: accentColor } : undefined} />
                        </Button>
                        <Button
                            data-no-drag
                            size="icon"
                            variant="ghost"
                            className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", headerButtonRadiusClass)}
                            onClick={(e) => {
                                e.stopPropagation();
                                setBubbleTransparencyMode((prev) => prev === 'auto' ? 'solid' : 'auto');
                            }}
                            title={bubbleTransparencyMode === 'auto' ? 'Bubble transparency: Auto' : 'Bubble transparency: Solid'}
                        >
                            <Droplets size={16} style={bubbleTransparencyMode === 'auto' ? { color: accentColor } : undefined} />
                        </Button>
                        <X data-no-drag size={16} className="cursor-pointer text-[#6f4951] hover:text-[#b42318]" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }} />
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative">
                    {node.sourceSelection && (
                        <div className={clsx(
                            "shrink-0 overflow-hidden text-ellipsis whitespace-nowrap border-b border-[#1b2b33]/20 p-2 text-[10px] italic font-medium",
                            (isHovered || isDragging) ? "opacity-100" : "opacity-50",
                            "bg-[#f4eee0]"
                        )}>
                            <span style={{ color: accentColor }}>
                                Origin: &quot;{node.sourceSelection}&quot;
                            </span>
                        </div>
                    )}

                    {activePanel === 'system' ? (
                        <div className="flex flex-1 flex-col overflow-hidden border-b border-[#1b2b33]/20 bg-[#def3f2] px-4 py-3">
                            <span className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1b2b33]">System Prompt</span>
                            <Textarea
                                className="flex-1 resize-none rounded-none border-none bg-transparent p-0 text-xs text-[#1b2b33] focus-visible:ring-0"
                                value={systemPrompt}
                                onChange={(e) => {
                                    const newPrompt = e.target.value;
                                    setSystemPrompt(newPrompt);
                                    updateSystemPrompt(newPrompt);
                                }}
                                placeholder="Set the AI's behavior..."
                            />
                        </div>
                    ) : activePanel === 'memory' ? (
                        <div className="flex flex-1 flex-col overflow-hidden border-b border-[#1b2b33]/20 bg-[#def3f2] px-4 py-3">
                            <div className="mb-2 flex items-center justify-between">
                                <div>
                                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1b2b33]">Memory Subagent</span>
                                    <span className="text-[10px] text-[#37535c]">Editable raw context used by the memory subagent.</span>
                                </div>
                                <Brain size={15} style={{ color: accentColor }} />
                            </div>
                            <Textarea
                                className="flex-1 resize-none rounded-none border-none bg-transparent p-0 text-xs text-[#1b2b33] focus-visible:ring-0"
                                value={memoryDraft}
                                onChange={(e) => saveMemoryDraft(e.target.value)}
                                placeholder={`Memory 1:\nImportant offloaded context goes here.\n\n---\n\nMemory 2:\nAdd another memory block here.`}
                            />
                        </div>
                    ) : (
                        <div
                            ref={messagesViewportRef}
                            data-no-pan
                            className="hover-scroll-y flex-1 overflow-x-hidden overflow-y-auto bg-transparent"
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <div className="space-y-3 px-4 py-3">
                                {node.messages.map((msg: Message, index: number) =>
                                    activeStatusLabel && msg.role === 'model' && !msg.text.trim() && index === node.messages.length - 1 ? (
                                        <div key={msg.id} className="flex w-full justify-start">
                                            <div
                                                className={clsx(
                                                    "memory-status-shell relative min-w-0 max-w-[94%] overflow-hidden border px-4 py-2 text-xs leading-tight font-medium text-[#1b2b33]",
                                                    dimBubbles ? "opacity-100 shadow-none" : "opacity-100 shadow-[0_2px_7px_rgba(33,36,41,0.09)]",
                                                    "border-[#1b2b33]/20 bg-[#fffdf7]",
                                                    sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-md)]",
                                                    memoryWorkflow?.phase === 'error' && "text-[#8a2018]"
                                                )}
                                                style={{
                                                    borderTopLeftRadius: sharpEdges ? 0 : 'var(--canvas-radius-md)',
                                                    borderTopRightRadius: sharpEdges ? 0 : 'var(--canvas-radius-md)',
                                                    borderBottomLeftRadius: sharpEdges ? 0 : '4px',
                                                    borderBottomRightRadius: sharpEdges ? 0 : 'var(--canvas-radius-md)',
                                                }}
                                            >
                                                <div className="memory-status-gradient absolute inset-0 opacity-90" />
                                                <div className="relative mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] opacity-70">
                                                    {memoryWorkflow ? 'subagent sync' : 'assistant'}
                                                </div>
                                                <div className="relative flex items-center gap-2">
                                                    <Sparkles
                                                        size={12}
                                                        className={clsx(
                                                            "shrink-0 opacity-80",
                                                            animationsEnabled && (memoryWorkflow?.phase === 'asking' || !memoryWorkflow) && "animate-pulse"
                                                        )}
                                                    />
                                                    <span className={animationsEnabled ? "memory-status-text" : undefined}>
                                                        {activeStatusLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            key={msg.id}
                                            className={clsx(
                                                "flex w-full",
                                                msg.role === 'user' ? "justify-end" : "justify-start"
                                            )}
                                        >
                                            <div
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    openMessageMenu(index, e.clientX, e.clientY);
                                                }}
                                                className={clsx(
                                                    "min-w-0 max-w-[94%] select-text break-words px-4 py-2 text-xs leading-tight border font-medium",
                                                    dimBubbles ? "opacity-100 shadow-none" : "opacity-100",
                                                    msg.kind === 'memory-request' && "border-[#a78bfa]/30 bg-[#f4efff] text-[#4c2f8a]",
                                                    msg.kind === 'memory-response' && "border-[#8acfc5]/40 bg-[#e4fbf6] text-[#145a50]",
                                                    msg.kind === 'compressed' && msg.role !== 'user' && "border-[#d0b77f]/35 bg-[#fff6de] text-[#5c4516]",
                                                    msg.role === 'user'
                                                        ? (dimBubbles ? "border-transparent bg-transparent text-[color:var(--node-accent)]" : "")
                                                        : (msg.kind
                                                            ? ""
                                                            : (dimBubbles ? "border-transparent bg-transparent text-[#1b2b33]" : "border-[#1b2b33]/20 bg-[#fffdf7] text-[#1b2b33]")),
                                                    isBeautifulUI && !dimBubbles && "shadow-[0_2px_7px_rgba(33,36,41,0.09)]"
                                                )}
                                                style={{
                                                    wordWrap: 'break-word',
                                                    overflowWrap: 'anywhere',
                                                    whiteSpace: 'pre-wrap',
                                                    borderTopLeftRadius: sharpEdges ? 0 : 'var(--canvas-radius-md)',
                                                    borderTopRightRadius: sharpEdges ? 0 : 'var(--canvas-radius-md)',
                                                    borderBottomLeftRadius: sharpEdges ? 0 : msg.role === 'user' ? 'var(--canvas-radius-md)' : '4px',
                                                    borderBottomRightRadius: sharpEdges ? 0 : msg.role === 'user' ? '4px' : 'var(--canvas-radius-md)',
                                                    ...(msg.role === 'user' && !dimBubbles ? { backgroundColor: accentColor, borderColor: accentColor, color: accentTextColor } : {}),
                                                }}
                                            >
                                                {msg.kind && (
                                                    <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] opacity-70">
                                                        {msg.kind === 'memory-request' ? 'main agent asked memory subagent' : msg.kind === 'memory-response' ? 'subagent' : 'compressed'}
                                                    </div>
                                                )}
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="flex flex-col gap-2 mb-2">
                                                        {msg.attachments.map((file, idx: number) => (
                                                            file.mimeType.startsWith('image/') ? (
                                                                <Image
                                                                    key={idx}
                                                                    src={file.data}
                                                                    alt={file.name}
                                                                    width={1200}
                                                                    height={1200}
                                                                    unoptimized
                                                                    sizes="(max-width: 768px) 100vw, 24rem"
                                                                    className={clsx("h-auto max-w-full border border-[#1b2b33]/20", headerButtonRadiusClass)}
                                                                />
                                                            ) : (
                                                                <div key={idx} className={clsx("truncate bg-[#f4eee0] p-1 text-[10px] text-[#1b2b33]", headerButtonRadiusClass)}>
                                                                    📎 {file.name}
                                                                </div>
                                                            )
                                                        ))}
                                                    </div>
                                                )}
                                                {msg.kind === 'memory-request' ? 'main agent asked memory subagent' : msg.text}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className={clsx(
                    "relative flex shrink-0 gap-2 border-t bg-transparent px-3 py-2.5",
                    isActive ? "border-[#1b2b33]/22 opacity-100" : "border-transparent opacity-50"
                )}>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                    <Button
                        size="icon"
                        variant="outline"
                        className={clsx(
                            "h-10 w-10 border p-0 bg-transparent hover:bg-[color:var(--node-accent)] hover:text-[#f8fffd]",
                            controlRadiusClass,
                            isActive ? "border-[#1b2b33]/30" : "border-transparent"
                        )}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip size={18} />
                    </Button>
                    <Textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        placeholder="Ask AI..."
                        className={clsx(
                            "h-10 min-h-10 max-h-10 flex-1 resize-none overflow-hidden border bg-[#fffdf7] px-3 py-2 text-sm leading-5 text-[#1b2b33] focus-visible:ring-2",
                            controlRadiusClass,
                            isActive ? "border-[#1b2b33]/28" : "border-transparent"
                        )}
                        autoFocus
                    />
                    <Button
                        onClick={() => sendMessage()}
                        variant="outline"
                        className={clsx(
                            "h-10 border bg-transparent px-4 hover:bg-[color:var(--node-accent)] hover:text-[#f8fffd]",
                            controlRadiusClass,
                            isActive ? "border-[#1b2b33]/30" : "border-transparent"
                        )}
                    >
                        <Send size={18} />
                    </Button>
                </div>
            </Card>

            {editingMessageIndex !== null && (
                <div
                    data-no-drag
                    className={clsx(
                        "absolute inset-x-3 top-12 z-[2400] border border-[#1b2b33]/20 bg-[#fff8ed] p-3 shadow-[0_18px_42px_rgba(33,36,41,0.16)]",
                        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                    )}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#22363f]">Edit Raw Context</span>
                        <button
                            className="text-[10px] font-medium text-[#6f4951] hover:text-[#1b2b33]"
                            onClick={() => {
                                setEditingMessageIndex(null);
                                setEditingValue('');
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                    <Textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className={clsx(
                            "min-h-32 border bg-[#fffdf7] text-xs text-[#1b2b33]",
                            controlRadiusClass
                        )}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                        <Button
                            variant="outline"
                            className={clsx("h-8 border bg-transparent px-3 text-[11px]", controlRadiusClass)}
                            onClick={saveEditedMessage}
                        >
                            Save Raw Edit
                        </Button>
                    </div>
                </div>
            )}

            {/* Context Attached Module */}
            <div
                className={clsx(
                    "absolute left-6 z-0 border border-[#1b2b33]/20 px-3 py-1 shadow-sm pointer-events-none",
                    (contextFeedback || (node.hasInitialContext && node.messages.length === 0))
                        ? "opacity-100 top-[calc(100%-4px)]"
                        : "opacity-0 top-[calc(100%-16px)] pointer-events-none",
                    showChrome ? "bg-[#fffdf7]" : "bg-transparent",
                    sharpEdges ? "rounded-none" : "rounded-b-[var(--canvas-radius-sm)]"
                )}
            >
                <div className="flex items-center space-x-1.5 opacity-80">
                    <span 
                        className="inline-block w-1.5 h-1.5 rounded-full" 
                        style={{ backgroundColor: accentColor }} 
                    />
                    <span className="text-[10px] font-medium tracking-wide text-[#1b2b33]">
                        {contextFeedback ?? (hasInitialImageContext ? 'Context + Image added' : 'Context added')}
                    </span>
                </div>
            </div>
            {messageMenu && (
                <div
                    ref={messageMenuRef}
                    data-no-drag
                    className={clsx(
                        "absolute z-[2500] min-w-48 border border-[#1b2b33]/20 bg-[#fffdf7] p-1.5 shadow-[0_10px_24px_rgba(33,36,41,0.16)] backdrop-blur-sm",
                        sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-sm)]"
                    )}
                    style={{ left: messageMenu.x, top: messageMenu.y }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <button
                        className={clsx(
                            "mb-1 flex h-8 w-full items-center justify-start gap-2 border border-transparent bg-transparent px-2 text-[11px] font-semibold text-[#22363f] hover:bg-[#edf5f8]",
                            sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-xs)]"
                        )}
                        onClick={() => {
                            onBranchFromMessage(messageMenu.index);
                            setMessageMenu(null);
                        }}
                    >
                        <GitBranchPlus size={13} />
                        Branch
                    </button>
                    <button
                        className={clsx(
                            "flex h-8 w-full items-center justify-start gap-2 px-2 text-[11px] font-medium text-[#22363f] hover:bg-[#edf5f8]",
                            sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-xs)]"
                        )}
                        onClick={() => {
                            void compressMessage(messageMenu.index);
                        }}
                    >
                        {isCompressing === messageMenu.index ? <LoaderCircle size={13} className="animate-spin" /> : <Scissors size={13} />}
                        Compress
                    </button>
                    <button
                        className={clsx(
                            "flex h-8 w-full items-center justify-start gap-2 px-2 text-[11px] font-medium text-[#22363f] hover:bg-[#edf5f8]",
                            sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-xs)]"
                        )}
                        onClick={() => startEditingMessage(messageMenu.index)}
                    >
                        <PencilLine size={13} />
                        Edit Raw
                    </button>
                    <button
                        className={clsx(
                            "flex h-8 w-full items-center justify-start gap-2 px-2 text-[11px] font-medium text-[#22363f] hover:bg-[#edf5f8]",
                            sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-xs)]"
                        )}
                        onClick={() => offloadMessage(messageMenu.index)}
                    >
                        <Archive size={13} />
                        Offload
                    </button>
                    <div className="my-1 h-px bg-[#1b2b33]/10" />
                    <button
                        className={clsx(
                            "flex h-8 w-full items-center justify-start gap-2 px-2 text-[11px] font-medium text-[#22363f] hover:bg-[#f3ecdd]",
                            sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-xs)]"
                        )}
                        onClick={() => deleteMessagesAbove(messageMenu.index)}
                    >
                        <ChevronUp size={13} />
                        Delete Above
                    </button>
                    <button
                        className={clsx(
                            "flex h-8 w-full items-center justify-start gap-2 px-2 text-[11px] font-medium text-[#22363f] hover:bg-[#f3ecdd]",
                            sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-xs)]"
                        )}
                        onClick={() => deleteMessagesBelow(messageMenu.index)}
                    >
                        <ChevronDown size={13} />
                        Delete Below
                    </button>
                    <button
                        className={clsx(
                            "mt-1 flex h-8 w-full items-center justify-start gap-2 px-2 text-[11px] font-medium text-[#9f1d16] hover:bg-[#fff1ee]",
                            sharpEdges ? "rounded-none" : "rounded-[var(--canvas-radius-xs)]"
                        )}
                        onClick={() => removeSingleMessage(messageMenu.index)}
                    >
                        <Trash2 size={13} />
                        Delete This
                    </button>
                </div>
            )}
        </div>
    );
};

export const ChatNode = React.memo(ChatNodeComponent, (prev, next) => (
    prev.node === next.node &&
    prev.isBeautifulUI === next.isBeautifulUI &&
    prev.sharpEdges === next.sharpEdges
));
