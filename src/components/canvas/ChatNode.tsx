
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Node, Message } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { streamGeminiResponse } from '@/lib/llm';
import { v4 as uuidv4 } from 'uuid';
import { Send, Plus, X, GripVertical, Paperclip, Settings, Droplets, GitBranchPlus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatNodeProps {
    node: Node;
    updatePos: (x: number, y: number) => void;
    updateMessages: (messages: Message[]) => void;
    updateTitle: (title: string) => void;
    updateSystemPrompt: (prompt: string) => void;
    onDelete: () => void;
    onMouseDown: () => void;
    onAddToContext: (text: string, nodeId: string) => void;
    onBranchFromMessage: (messageIndex: number) => void;
    setGlobalSelection: (selection: { text: string; x: number; y: number } | null) => void;
    isBeautifulUI?: boolean;
    sharpEdges?: boolean;
    accentColor?: string;
}

const ChatNodeComponent = ({
    node,
    updatePos,
    updateMessages,
    updateTitle,
    updateSystemPrompt,
    onDelete,
    onMouseDown,
    onAddToContext,
    onBranchFromMessage,
    setGlobalSelection,
    isBeautifulUI = false,
    sharpEdges = false,
    accentColor = '#0f766e',
}: ChatNodeProps) => {
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
        if (node.initialPrompt && input === '' && node.messages.length === 0) {
            setInput(node.initialPrompt);
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    const end = node.initialPrompt.length;
                    inputRef.current.setSelectionRange(end, end);
                }
            }, 10);
        }
    }, [node.initialPrompt]);
    const [isDragging, setIsDragging] = useState(false);
    const [activePanel, setActivePanel] = useState<'chat' | 'system'>('chat');
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<{ data: string; mimeType: string; name: string }[]>(node.initialAttachments || []);

    useEffect(() => {
        if (node.initialAttachments && attachedFiles.length === 0 && node.messages.length === 0) {
            setAttachedFiles(node.initialAttachments);
        }
    }, [node.initialAttachments]);
    const [systemPrompt, setSystemPrompt] = useState(node.systemPrompt || 'You are a helpful AI assistant.');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [title, setTitle] = useState(node.title || '');
    const [bubbleTransparencyMode, setBubbleTransparencyMode] = useState<'auto' | 'solid'>('auto');
    const [contextFeedback, setContextFeedback] = useState<string | null>(null);
    const [messageMenu, setMessageMenu] = useState<{ index: number; x: number; y: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const nodeShellRef = useRef<HTMLDivElement>(null);
    const messageMenuRef = useRef<HTMLDivElement>(null);



    const messagesViewportRef = useRef<HTMLDivElement>(null);
    const showChrome = isHovered || isDragging || isEditingTitle;
    const isActive = showChrome || input || attachedFiles.length > 0;
    const dimBubbles = bubbleTransparencyMode === 'auto' && !showChrome;
    const hasInitialImageContext = Boolean(node.initialAttachments?.some((file) => file.mimeType.startsWith('image/')));

    useEffect(() => {
        const viewport = messagesViewportRef.current;
        if (!viewport) return;
        requestAnimationFrame(() => {
            viewport.scrollTop = viewport.scrollHeight;
        });
    }, [node.messages]);

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

    useEffect(() => {
        if (node.autoSend && node.initialPrompt && node.messages.length === 0) {
            sendMessage(node.initialPrompt);
        }
    }, [node.initialPrompt, node.autoSend]);
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

    const sendMessage = async (overridePrompt?: string) => {
        const text = overridePrompt || input;
        if (!text.trim() && attachedFiles.length === 0) return;

        const userMsg: Message = {
            id: uuidv4(),
            role: 'user',
            text: overridePrompt || input, // Show clean input to user
            timestamp: Date.now(),
            attachments: [...attachedFiles]
        };

        const newMessages = [...node.messages, userMsg];
        updateMessages(newMessages);
        setInput('');
        const filesToSend = [...attachedFiles];
        setAttachedFiles([]);

        const assistantMsgId = uuidv4();
        const assistantMsg: Message = {
            id: assistantMsgId,
            role: 'model',
            text: '',
            timestamp: Date.now(),
        };

        updateMessages([...newMessages, assistantMsg]);

        let fullText = '';
        try {
            const history = node.messages.map(m => ({
                role: m.role as 'user' | 'assistant',
                text: m.text
            }));

            const stream = streamGeminiResponse(text, history, filesToSend, systemPrompt);
            for await (const chunk of stream) {
                fullText += chunk;
                updateMessages([...newMessages, { ...assistantMsg, text: fullText }]);
            }
        } catch (error) {
            console.error('Gemini error:', error);
            updateMessages([...newMessages, { ...assistantMsg, text: 'Error: Failed to get response.' }]);
        }
    };

    useEffect(() => {
        if (!contextFeedback) return;
        const timer = window.setTimeout(() => setContextFeedback(null), 1800);
        return () => window.clearTimeout(timer);
    }, [contextFeedback]);

    useEffect(() => {
        if (!messageMenu) return;
        const closeMenu = (event: PointerEvent) => {
            const target = event.target as Node | null;
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
        const menuHeight = 176;
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
                "absolute pointer-events-auto",
                outerRadiusClass,
                isDragging && "select-none cursor-grabbing"
            )}
            style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                zIndex: isDragging ? 100 : 10,
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
                    ) : (
                        <div
                            ref={messagesViewportRef}
                            data-no-pan
                            className="hover-scroll-y flex-1 overflow-x-hidden overflow-y-auto bg-transparent"
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <div className="space-y-3 px-4 py-3">
                                {node.messages.map((msg: Message, index: number) => (
                                    <div
                                        key={msg.id}
                                        className={clsx(
                                            "flex flex-col max-w-[94%]",
                                            msg.role === 'user' ? "ml-auto items-end" : "items-start"
                                        )}
                                    >
                                        <div
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                openMessageMenu(index, e.clientX, e.clientY);
                                            }}
                                            className={clsx(
                                                "break-words px-4 py-2 text-xs leading-tight overflow-wrap-anywhere border font-medium",
                                                dimBubbles ? "opacity-100 shadow-none" : "opacity-100",
                                                msg.role === 'user'
                                                    ? (dimBubbles ? "border-transparent bg-transparent text-[color:var(--node-accent)]" : "")
                                                    : (dimBubbles ? "border-transparent bg-transparent text-[#1b2b33]" : "border-[#1b2b33]/20 bg-[#fffdf7] text-[#1b2b33]"),
                                                isBeautifulUI && !dimBubbles && "shadow-[0_2px_7px_rgba(33,36,41,0.09)]"
                                            )}
                                            style={{
                                                wordWrap: 'break-word',
                                                overflowWrap: 'break-word',
                                                whiteSpace: 'pre-wrap',
                                                borderTopLeftRadius: sharpEdges ? 0 : 'var(--canvas-radius-md)',
                                                borderTopRightRadius: sharpEdges ? 0 : 'var(--canvas-radius-md)',
                                                borderBottomLeftRadius: sharpEdges ? 0 : msg.role === 'user' ? 'var(--canvas-radius-md)' : '4px',
                                                borderBottomRightRadius: sharpEdges ? 0 : msg.role === 'user' ? '4px' : 'var(--canvas-radius-md)',
                                                ...(msg.role === 'user' && !dimBubbles ? { backgroundColor: accentColor, borderColor: accentColor, color: accentTextColor } : {}),
                                            }}
                                        >
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="flex flex-col gap-2 mb-2">
                                                    {msg.attachments.map((file, idx: number) => (
                                                        file.mimeType.startsWith('image/') ? (
                                                            <img
                                                                key={idx}
                                                                src={file.data}
                                                                alt={file.name}
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
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
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
