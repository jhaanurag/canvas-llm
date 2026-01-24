
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Node, Message } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { streamGeminiResponse } from '@/lib/llm';
import { v4 as uuidv4 } from 'uuid';
import { Send, Plus, X, GripVertical, FileText, Paperclip, Settings, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatNodeProps {
    node: Node;
    activeContextId?: string | null;
    setActiveContextId: (id: string | null) => void;
    updatePos: (x: number, y: number) => void;
    updateMessages: (messages: Message[]) => void;
    updateContent: (content: string) => void;
    onBranch: (selection: string, type: 'expand' | 'custom', prompt?: string) => void;
    onDelete: () => void;
    onSelect: () => void;
    onMouseDown: () => void;
    onAddToContext: (text: string, nodeId: string) => void;
    setGlobalSelection: (selection: { text: string; x: number; y: number } | null) => void;
    isSelected: boolean;
    selectedNodesContext?: Node[];
}

export const ChatNode = ({
    node,
    activeContextId,
    setActiveContextId,
    updatePos,
    updateMessages,
    updateContent,
    onBranch,
    onDelete,
    onSelect,
    onMouseDown,
    onAddToContext,
    setGlobalSelection,
    isSelected,
    selectedNodesContext = []
}: ChatNodeProps) => {
    const [input, setInput] = useState(node.initialPrompt || '');

    // Sync input with initialPrompt when it arrives (since it's set via setTimeout)
    useEffect(() => {
        if (node.initialPrompt && input === '' && node.messages.length === 0) {
            setInput(node.initialPrompt);
        }
    }, [node.initialPrompt]);
    const [isDragging, setIsDragging] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [didDrag, setDidDrag] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<{ data: string; mimeType: string; name: string }[]>([]);
    const [showSystemPrompt, setShowSystemPrompt] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState(node.systemPrompt || 'You are a helpful AI assistant.');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [title, setTitle] = useState(node.title || '');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);



    const scrollRef = useRef<HTMLDivElement>(null);
    const isActive = isHovered || isDragging || isSelected || input || attachedFiles.length > 0;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [node.messages]);

    const handleMouseDown = (e: React.MouseEvent) => {
        onMouseDown();
        if ((e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - node.x, y: e.clientY - node.y });
            setDidDrag(false);
            e.stopPropagation();
        } else {
            // Reset didDrag when clicking in the node content area
            setDidDrag(false);
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                updatePos(e.clientX - dragStart.x, e.clientY - dragStart.y);
                setDidDrag(true);
            }
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
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
        if (selectedNodesContext.length > 0) {
            const contexts = selectedNodesContext.map(n => {
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

    const onMouseUp = (e: React.MouseEvent) => {
        // Selection handled globally in InfiniteCanvas
    };

    return (
        <div
            className={clsx(
                "absolute pointer-events-auto",
                activeContextId === node.id ? "scale-[1.02]" : "",
                isSelected ? "ring-2 ring-blue-500" : "",
                isDragging && "select-none cursor-grabbing"
            )}
            style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                zIndex: isDragging ? 100 : 10
            }}
            onMouseUp={onMouseUp}
            onMouseEnter={() => {
                setIsHovered(true);
                if (node.parentId) setActiveContextId(node.parentId);
            }}
            onMouseLeave={() => {
                setIsHovered(false);
                setActiveContextId(null);
            }}
        >
            <Card
                className={clsx(
                    "flex flex-col h-full border-2 rounded-none overflow-hidden",
                    (isHovered || isDragging || isSelected) ? "border-black bg-white" : "border-transparent bg-transparent"
                )}
                style={{ padding: 0, gap: 0 }}
            >
                <div
                    className={clsx(
                        "drag-handle flex items-center justify-between px-4 py-2 bg-neutral-100 border-b-2 border-black cursor-grab active:cursor-grabbing shrink-0",
                        (isHovered || isDragging || isSelected) ? "opacity-100" : "opacity-0"
                    )}
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex items-center gap-2">
                        <GripVertical size={14} />
                        {isEditingTitle ? (
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={() => {
                                    setIsEditingTitle(false);
                                    updateContent(title);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsEditingTitle(false);
                                        updateContent(title);
                                    }
                                }}
                                className="text-[9px] font-black uppercase tracking-tight bg-transparent border-none outline-none w-20"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                className="text-[9px] font-black uppercase tracking-tight cursor-pointer hover:text-blue-600"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingTitle(true);
                                }}
                            >
                                {title || 'Untitled'}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2 items-center">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-none p-0 hover:bg-blue-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                const allText = node.messages.map((m: Message) => `${m.role}: ${m.text}`).join('\n\n');
                                onAddToContext(allText, node.id);
                            }} title="Add chat to context"
                        >
                            <Plus size={18} className={isSelected ? 'text-blue-600' : ''} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-none p-0" onClick={(e) => { e.stopPropagation(); setShowSystemPrompt(!showSystemPrompt); }}>
                            <Settings size={18} className={showSystemPrompt ? 'text-blue-600' : ''} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-none p-0" onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); }}>
                            <FileText size={18} />
                        </Button>
                        <X size={20} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onDelete(); }} />
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative">
                    {node.sourceSelection && (
                        <div className={clsx(
                            "p-2 border-b border-black text-[10px] italic overflow-hidden whitespace-nowrap text-ellipsis shrink-0 font-medium",
                            (isHovered || isDragging) ? "opacity-100" : "opacity-30",
                            activeContextId === node.parentId ? "bg-black text-white" : "bg-neutral-50"
                        )}>
                            Origin: "{node.sourceSelection}"
                        </div>
                    )}

                    {showSystemPrompt ? (
                        <div className="flex-1 flex flex-col px-5 py-3 bg-blue-50 overflow-hidden border-b-2 border-black">
                            <span className="text-[11px] font-black mb-1 uppercase tracking-tight">SYSTEM PROMPT</span>
                            <Textarea
                                className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs p-0 resize-none rounded-none"
                                value={systemPrompt}
                                onChange={(e) => {
                                    const newPrompt = e.target.value;
                                    setSystemPrompt(newPrompt);
                                    updateContent(newPrompt);
                                }}
                                placeholder="Set the AI's behavior..."
                            />
                        </div>
                    ) : showNotes ? (
                        <div className="flex-1 flex flex-col px-5 py-3 bg-amber-50 overflow-hidden">
                            <span className="text-[11px] font-black mb-1 uppercase tracking-tight">LOCAL NOTES</span>
                            <Textarea
                                className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs p-0 resize-none rounded-none"
                                value={node.content}
                                onChange={(e) => updateContent(e.target.value)}
                                placeholder="Notes..."
                            />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-transparent scrollbar-thin scrollbar-thumb-black scrollbar-track-transparent">
                            <div className="px-5 py-3 space-y-3">
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
                                                "px-4 py-2 text-xs border-2 border-black font-semibold leading-tight rounded-none break-words overflow-wrap-anywhere",
                                                msg.role === 'user' ? "bg-black text-white" : "bg-white",
                                            )}
                                            style={{ wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}
                                        >
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="flex flex-col gap-2 mb-2">
                                                    {msg.attachments.map((file: any, idx: number) => (
                                                        file.mimeType.startsWith('image/') ? (
                                                            <img
                                                                key={idx}
                                                                src={file.data}
                                                                alt={file.name}
                                                                className="max-w-full h-auto border border-white/20"
                                                            />
                                                        ) : (
                                                            <div key={idx} className="text-[10px] bg-white/20 p-1 truncate">
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
                                <div ref={scrollRef} />
                            </div>
                        </div>
                    )}
                </div>

                <div className={clsx(
                    "px-5 py-3 border-t-2 flex gap-3 shrink-0 bg-transparent",
                    isActive ? "border-black opacity-100" : "border-transparent opacity-40"
                )}>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                    <Button
                        size="icon"
                        variant="outline"
                        className={clsx(
                            "border-2 h-12 w-12 rounded-none hover:bg-black hover:text-white p-0 bg-transparent",
                            isActive ? "border-black" : "border-transparent"
                        )}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip size={20} />
                    </Button>
                    <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Ask AI..."
                        className={clsx(
                            "flex-1 border-2 focus-visible:ring-0 text-sm h-12 rounded-none bg-transparent font-semibold",
                            isActive ? "border-black" : "border-transparent"
                        )}
                    />
                    <Button
                        onClick={() => sendMessage()}
                        variant="outline"
                        className={clsx(
                            "border-2 h-12 px-5 hover:bg-black hover:text-white rounded-none bg-transparent",
                            isActive ? "border-black" : "border-transparent"
                        )}
                    >
                        <Send size={20} />
                    </Button>
                </div>
            </Card>
        </div>
    );
};
