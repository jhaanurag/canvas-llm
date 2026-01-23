
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Node, Message } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { streamGeminiResponse } from '@/lib/gemini';
import { v4 as uuidv4 } from 'uuid';
import { Send, Plus, X, GripVertical, FileText, Paperclip, CheckSquare, Square } from 'lucide-react';
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
    onAddToContext: (text: string) => void;
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
    const [input, setInput] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [didDrag, setDidDrag] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<{ data: string; mimeType: string; name: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

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
        if (node.initialPrompt && node.messages.length === 0) {
            sendMessage(node.initialPrompt);
        }
    }, [node.initialPrompt]);

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
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const stream = streamGeminiResponse(text, history, filesToSend);
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
        if (didDrag) return;
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text && text.length > 0) {
            const range = sel!.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setGlobalSelection({
                text: text,
                x: rect.left,
                y: rect.bottom + 40, // More down as requested
            });
        } else {
            // Clear selection if user clicked but didn't select anything
            setGlobalSelection(null);
        }
        // Don't clear on every mouseup, or it disappears when clicking the menu
    };

    return (
        <div
            className={clsx(
                "absolute pointer-events-auto",
                !isDragging && "transition-all duration-200",
                activeContextId === node.id ? "scale-[1.02]" : "",
                isSelected ? "ring-4 ring-black" : "",
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
            <Card className={clsx(
                "flex flex-col h-full border-2 transition-colors duration-200 rounded-none overflow-hidden",
                (isHovered || isDragging || isSelected) ? "border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" : "border-transparent bg-transparent shadow-none"
            )}>
                <div
                    className={clsx(
                        "drag-handle flex items-center justify-between p-2 bg-neutral-100 border-b-2 border-black cursor-grab active:cursor-grabbing shrink-0 transition-opacity",
                        (isHovered || isDragging || isSelected) ? "opacity-100" : "opacity-0"
                    )}
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex items-center gap-2">
                        <GripVertical size={16} />
                        <button onClick={(e) => { e.stopPropagation(); onSelect(); }} className="hover:bg-neutral-200 p-1">
                            {isSelected ? <CheckSquare size={14} fill="black" stroke="white" /> : <Square size={14} />}
                        </button>
                        <span className="text-[10px] font-bold uppercase tracking-tight">
                            {node.parentId ? 'BRANCH' : 'MAIN'}
                        </span>
                    </div>
                    <div className="flex gap-2 items-center">
                        {selectedNodesContext.length > 0 && <span className="text-[8px] bg-black text-white px-1">+{selectedNodesContext.length} CTX</span>}
                        <Button size="icon" variant="ghost" className="h-6 w-6 rounded-none p-0" onClick={() => setShowNotes(!showNotes)}>
                            <FileText size={14} />
                        </Button>
                        <X size={16} className="cursor-pointer" onClick={onDelete} />
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative">
                    {node.sourceSelection && (
                        <div className={clsx(
                            "p-2 border-b border-black text-[10px] italic overflow-hidden whitespace-nowrap text-ellipsis shrink-0 font-medium transition-opacity",
                            (isHovered || isDragging) ? "opacity-100" : "opacity-30",
                            activeContextId === node.parentId ? "bg-black text-white" : "bg-neutral-50"
                        )}>
                            Origin: "{node.sourceSelection}"
                        </div>
                    )}

                    {showNotes ? (
                        <div className="flex-1 flex flex-col p-2 bg-amber-50 overflow-hidden">
                            <span className="text-[10px] font-bold mb-1">LOCAL NOTES</span>
                            <Textarea
                                className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs p-0 resize-none rounded-none font-medium"
                                value={node.content}
                                onChange={(e) => updateContent(e.target.value)}
                                placeholder="Capture thoughts here..."
                            />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-black scrollbar-track-transparent">
                            <div className="p-3 space-y-4">
                                {node.messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={clsx(
                                            "flex flex-col max-w-[94%]",
                                            msg.role === 'user' ? "ml-auto items-end" : "items-start"
                                        )}
                                    >
                                        <div
                                            className={clsx(
                                                "p-2 text-xs border-2 border-black font-semibold leading-relaxed rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                                                msg.role === 'user' ? "bg-black text-white" : "bg-white",
                                            )}
                                        >
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
                    "p-3 border-t-2 border-black flex gap-2 shrink-0 bg-neutral-100 transition-opacity",
                    (isHovered || isDragging || input || attachedFiles.length > 0) ? "opacity-100" : "opacity-0"
                )}>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                    <Button
                        size="icon"
                        variant="outline"
                        className="border-2 border-black h-8 w-8 rounded-none hover:bg-black hover:text-white"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip size={14} />
                    </Button>
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Talk with AI..."
                        className="flex-1 border-2 border-black focus-visible:ring-0 text-xs h-8 rounded-none bg-white font-bold"
                    />
                    <Button
                        onClick={() => sendMessage()}
                        variant="outline"
                        className="border-2 border-black h-8 px-2 hover:bg-black hover:text-white rounded-none focus:bg-black focus:text-white"
                    >
                        <Send size={14} />
                    </Button>
                </div>
            </Card>
        </div>
    );
};
