
'use client';

import React, { useState, useEffect } from 'react';
import { Node } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { GripVertical, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clsx } from 'clsx';

interface NoteNodeProps {
    node: Node;
    updatePos: (x: number, y: number) => void;
    updateContent: (content: string) => void;
    onDelete: () => void;
    onSelect: () => void;
    onMouseDown: () => void;

    isSelected: boolean;
    setGlobalSelection: (selection: { text: string; x: number; y: number } | null) => void;
    onAddToContext: (text: string, nodeId: string) => void;
}

export const NoteNode = React.memo(({ node, updatePos, updateContent, onDelete, onSelect, onMouseDown, isSelected, setGlobalSelection, onAddToContext }: NoteNodeProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [didDrag, setDidDrag] = useState(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        onMouseDown();
        if ((e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - node.x, y: e.clientY - node.y });
            setDidDrag(false);
            e.stopPropagation();
        } else {
            setDidDrag(false);
        }
    };

    // Removed auto-focus to allow typing in system prompt and notes
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

    return (
        <div
            className={clsx(
                "absolute pointer-events-auto",
                !isDragging && "transition-all duration-200",
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
            onMouseUp={(e) => {
                // Selection handled globally in InfiniteCanvas
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={clsx(
                "flex flex-col h-full border-2 transition-colors duration-200 rounded-none overflow-hidden",
                (isHovered || isDragging || isSelected) ? "border-black bg-amber-50 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" : "border-transparent bg-transparent shadow-none"
            )}>
                <div
                    className={clsx(
                        "drag-handle flex items-center justify-between px-4 py-2 bg-amber-100 border-b-2 border-black cursor-grab active:cursor-grabbing shrink-0 transition-opacity",
                        (isHovered || isDragging || isSelected) ? "opacity-100" : "opacity-0"
                    )}
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex items-center gap-2">
                        <GripVertical size={14} />
                        <span className="text-[9px] font-black uppercase tracking-tight">Note</span>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-none p-0 hover:bg-blue-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddToContext(node.content || '', node.id);
                            }}
                            title="Add note to context"
                        >
                            <Plus size={18} className={isSelected ? 'text-blue-600' : ''} />
                        </Button>
                        <X size={20} className="cursor-pointer" onClick={onDelete} />
                    </div>
                </div>
                <Textarea
                    value={node.content}
                    onChange={(e) => updateContent(e.target.value)}
                    className="w-full h-full bg-transparent border-none focus-visible:ring-0 resize-none px-5 py-3 text-sm font-semibold text-neutral-800 leading-tight rounded-none"
                    placeholder="Notes..."
                />
            </div>
        </div>
    );
});

NoteNode.displayName = 'NoteNode';
