
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Node, Message } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { streamGeminiResponse } from '@/lib/llm';
import { v4 as uuidv4 } from 'uuid';
import { Send, Plus, X, GripVertical, FileText, Paperclip, Settings, Droplets } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatNodeProps {
    node: Node;
    activeContextId?: string | null;
    setActiveContextId: (id: string | null) => void;
    updatePos: (x: number, y: number) => void;
    updateMessages: (messages: Message[]) => void;
    updateContent: (content: string) => void;
    updateTitle: (title: string) => void;
    updateSystemPrompt: (prompt: string) => void;
    onDelete: () => void;
    onSelect: () => void;
    onMouseDown: () => void;
    onAddToContext: (text: string, nodeId: string) => void;
    setGlobalSelection: (selection: { text: string; x: number; y: number } | null) => void;
    isSelected: boolean;
    isBeautifulUI?: boolean;
    sharpEdges?: boolean;
    accentColor?: string;
    selectedNodesContext?: Node[];
}

const ChatNodeComponent = ({
    node,
    activeContextId,
    setActiveContextId,
    updatePos,
    updateMessages,
    updateContent,
    updateTitle,
    updateSystemPrompt,
    onDelete,
    onSelect,
    onMouseDown,
    onAddToContext,
    setGlobalSelection,
    isSelected,
    isBeautifulUI = false,
    sharpEdges = false,
    accentColor = '#0f766e',
    selectedNodesContext = []
}: ChatNodeProps) => {
    const motionClass = 'transition-[background-color,border-color,box-shadow,color,opacity,transform] duration-200 ease-out';
    const shellRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[18px]';
    const outerRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[18px]';
    const headerButtonRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[8px]';
    const controlRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[10px]';
    const bubbleRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[12px]';

    const cssVars = {
        '--node-accent': accentColor,
        '--node-accent-15': `${accentColor}26`,
        '--node-accent-70': `${accentColor}b3`,
        '--node-accent-dark': accentColor, // optionally darken
    } as React.CSSProperties;

    const [input, setInput] = useState(node.initialPrompt || '');

    // Sync input with initialPrompt when it arrives (since it's set via setTimeout)
    useEffect(() => {
        if (node.initialPrompt && input === '' && node.messages.length === 0) {
            setInput(node.initialPrompt);
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.setSelectionRange(0, 0);
                }
            }, 10);
        }
    }, [node.initialPrompt]);
    const [isDragging, setIsDragging] = useState(false);
    const [activePanel, setActivePanel] = useState<'chat' | 'system' | 'notes'>('chat');
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);



    const messagesViewportRef = useRef<HTMLDivElement>(null);
    const showChrome = isHovered || isDragging || isEditingTitle;
    const isActive = showChrome || input || attachedFiles.length > 0;
    const dimBubbles = bubbleTransparencyMode === 'auto' && !showChrome;

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
            onSelect();
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
        let text = overridePrompt || input;
        if (!text.trim() && attachedFiles.length === 0) return;

        // Aggregating context from selected nodes
        const extraContextNodes = selectedNodesContext.filter((n) => n.id !== node.id);
        if (extraContextNodes.length > 0) {
            const contexts = extraContextNodes.map(n => {
                const lastMsgs = n.messages.slice(-3).map(m => `[${m.role}]: ${m.text}`).join('\n');
                return `### Context from ${n.type} node (${n.id})\n${n.content ? `Notes: ${n.content}\n` : ''}${lastMsgs}`;
            }).join('\n\n');
            text = `Using this additional context:\n${contexts}\n\nMy Question: ${text}`;
        }

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

    return (
        <div
            className={clsx(
                "absolute pointer-events-auto",
                outerRadiusClass,
                isBeautifulUI && motionClass,
                isBeautifulUI && activeContextId === node.id ? "scale-[1.01]" : "",
                isSelected && showChrome && !isDragging ? "ring-2" : "",
                isDragging && "select-none cursor-grabbing"
            )}
            style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                zIndex: isDragging ? 100 : 10,
                ...cssVars,
                ...(isSelected && showChrome && !isDragging ? { boxShadow: `0 0 0 2px ${accentColor}b3` } : {})
            }}
            onMouseEnter={() => {
                setIsHovered(true);
                if (node.parentId) setActiveContextId(node.parentId);
            }}
            onMouseLeave={() => {
                setIsHovered(false);
                setActiveContextId(null);
            }}
            onPointerDown={handlePointerDown}
        >
            <Card
                className={clsx(
                    "flex relative z-10 h-full flex-col overflow-hidden border",
                    shellRadiusClass,
                    isBeautifulUI && motionClass,
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
                        isBeautifulUI && motionClass,
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
                                    isBeautifulUI && motionClass
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
                            className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", headerButtonRadiusClass, isBeautifulUI && motionClass)}
                            onClick={(e) => {
                                e.stopPropagation();
                                const allText = node.messages.map((m: Message) => `${m.role}: ${m.text}`).join('\n\n');
                                onAddToContext(allText, node.id);
                            }} title="Add chat to context"
                        >
                            <Plus size={16} style={isSelected ? { color: accentColor } : undefined} />
                        </Button>
                        <Button
                            data-no-drag
                            size="icon"
                            variant="ghost"
                            className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", headerButtonRadiusClass, isBeautifulUI && motionClass)}
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
                            className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", headerButtonRadiusClass, isBeautifulUI && motionClass)}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActivePanel((prev) => (prev === 'notes' ? 'chat' : 'notes'));
                            }}
                        >
                            <FileText size={16} style={activePanel === 'notes' ? { color: accentColor } : undefined} />
                        </Button>
                        <Button
                            data-no-drag
                            size="icon"
                            variant="ghost"
                            className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", headerButtonRadiusClass, isBeautifulUI && motionClass)}
                            onClick={(e) => {
                                e.stopPropagation();
                                setBubbleTransparencyMode((prev) => prev === 'auto' ? 'solid' : 'auto');
                            }}
                            title={bubbleTransparencyMode === 'auto' ? 'Bubble transparency: Auto' : 'Bubble transparency: Solid'}
                        >
                            <Droplets size={16} style={bubbleTransparencyMode === 'auto' ? { color: accentColor } : undefined} />
                        </Button>
                        <X data-no-drag size={16} className={clsx("cursor-pointer text-[#6f4951] hover:text-[#b42318]", isBeautifulUI && motionClass)} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }} />
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative">
                    {node.sourceSelection && (
                        <div className={clsx(
                            "shrink-0 overflow-hidden text-ellipsis whitespace-nowrap border-b border-[#1b2b33]/20 p-2 text-[10px] italic font-medium",
                            isBeautifulUI && motionClass,
                            (isHovered || isDragging) ? "opacity-100" : "opacity-30",
                            activeContextId === node.parentId ? "text-[#f8fffd]" : "bg-[#f4eee0] text-[#1b2b33]"
                        )}>
                            Origin: &quot;{node.sourceSelection}&quot;
                        </div>
                    )}

                    {activePanel === 'system' ? (
                        <div className="flex flex-1 flex-col overflow-hidden border-b border-[#1b2b33]/20 bg-[#def3f2] px-4 py-3">
                            <span className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1b2b33]">System Prompt</span>
                            <Textarea
                                className="flex-1 resize-none border-none bg-transparent p-0 text-xs text-[#1b2b33] focus-visible:ring-0"
                                value={systemPrompt}
                                onChange={(e) => {
                                    const newPrompt = e.target.value;
                                    setSystemPrompt(newPrompt);
                                    updateSystemPrompt(newPrompt);
                                }}
                                placeholder="Set the AI's behavior..."
                            />
                        </div>
                    ) : activePanel === 'notes' ? (
                        <div className="flex flex-1 flex-col overflow-hidden bg-[#fff0cf] px-4 py-3">
                            <span className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1b2b33]">Local Notes</span>
                            <Textarea
                                className="flex-1 resize-none border-none bg-transparent p-0 text-xs text-[#1b2b33] focus-visible:ring-0"
                                value={node.content}
                                onChange={(e) => updateContent(e.target.value)}
                                placeholder="Notes..."
                            />
                        </div>
                    ) : (
                        <div
                            ref={messagesViewportRef}
                            data-no-pan
                            className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent"
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <div className="space-y-3 px-4 py-3">
                                {node.messages.map((msg: Message) => (
                                    <div
                                        key={msg.id}
                                        className={clsx(
                                            "flex flex-col max-w-[94%]",
                                            msg.role === 'user' ? "ml-auto items-end" : "items-start"
                                        )}
                                    >
                                        <div
                                            className={clsx(
                                                "break-words px-4 py-2 text-xs leading-tight overflow-wrap-anywhere border font-medium",
                                                bubbleRadiusClass,
                                                dimBubbles ? "opacity-80" : "opacity-100",
                                                msg.role === 'user'
                                                    ? "text-[#f8fffd]"
                                                    : "border-[#1b2b33]/20 bg-[#fffdf7] text-[#1b2b33]",
                                                isBeautifulUI && "shadow-[0_2px_7px_rgba(33,36,41,0.09)]"
                                            )}
                                            style={{
                                                wordWrap: 'break-word',
                                                overflowWrap: 'break-word',
                                                whiteSpace: 'pre-wrap',
                                                ...(msg.role === 'user' ? { backgroundColor: accentColor, borderColor: accentColor } : {}),
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
                    isBeautifulUI && motionClass,
                    isActive ? "border-[#1b2b33]/22 opacity-100" : "border-transparent opacity-50"
                )}>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                    <Button
                        size="icon"
                        variant="outline"
                        className={clsx(
                            "h-10 w-10 border p-0 bg-transparent hover:bg-[color:var(--node-accent)] hover:text-[#f8fffd]",
                            controlRadiusClass,
                            isBeautifulUI && motionClass,
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
                            "h-10 min-h-10 max-h-10 flex-1 resize-none border bg-[#fffdf7] px-3 py-2 text-sm leading-5 text-[#1b2b33] focus-visible:ring-2",
                            controlRadiusClass,
                            isBeautifulUI && motionClass,
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
                            isBeautifulUI && motionClass,
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
                    "absolute left-4 px-3 py-1 border border-[#1b2b33]/20 shadow-sm pointer-events-none transition-all duration-300 ease-out z-0 bg-[#fffdf7]",
                    isBeautifulUI && node.hasInitialContext && node.messages.length === 0
                        ? "opacity-100 top-[calc(100%-4px)]"
                        : "opacity-0 top-[calc(100%-16px)] pointer-events-none",
                    sharpEdges ? "rounded-none" : "rounded-b-lg"
                )}
            >
                <div className="flex items-center space-x-1.5 opacity-80">
                    <span 
                        className="inline-block w-1.5 h-1.5 rounded-full" 
                        style={{ backgroundColor: accentColor }} 
                    />
                    <span className="text-[10px] font-medium tracking-wide text-[#1b2b33]">
                        Context added
                    </span>
                </div>
            </div>
        </div>
    );
};

const sameSelectedContext = (prev: Node[] = [], next: Node[] = []) => {
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i += 1) {
        if (prev[i] !== next[i]) return false;
    }
    return true;
};

export const ChatNode = React.memo(ChatNodeComponent, (prev, next) => (
    prev.node === next.node &&
    prev.activeContextId === next.activeContextId &&
    prev.isSelected === next.isSelected &&
    prev.isBeautifulUI === next.isBeautifulUI &&
    prev.sharpEdges === next.sharpEdges &&
    sameSelectedContext(prev.selectedNodesContext, next.selectedNodesContext)
));
