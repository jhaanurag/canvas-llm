
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
    isExiting?: boolean;
    isBeautifulUI?: boolean;
    sharpEdges?: boolean;
    accentColor?: string;
    setGlobalSelection: (selection: { text: string; x: number; y: number } | null) => void;
    onAddToContext: (text: string, nodeId: string) => void;
}

const NoteNodeComponent = ({ node, updatePos, updateContent, onDelete, onSelect, onMouseDown, isSelected, isExiting = false, isBeautifulUI = false, sharpEdges = false, accentColor = '#0f766e', setGlobalSelection, onAddToContext }: NoteNodeProps) => {
    const motionClass = 'transition-[background-color,border-color,box-shadow,color,opacity,transform] duration-200 ease-out';
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const shellRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[18px]';
    const outerRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[18px]';
    const controlRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[10px]';

    const cssVars = {
        '--node-accent': accentColor,
        '--node-accent-15': `${accentColor}26`,
        '--node-accent-70': `${accentColor}b3`,
    } as React.CSSProperties;

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

    // Removed auto-focus to allow typing in system prompt and notes
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

    return (
        <div
            className={clsx(
                "absolute pointer-events-auto",
                outerRadiusClass,
                isBeautifulUI && motionClass,
                isSelected && !isDragging ? "ring-2" : "",
                isDragging && "select-none cursor-grabbing",
                isBeautifulUI && (isExiting ? "pointer-events-none opacity-0 scale-[0.97] translate-y-2" : "opacity-100 scale-100 translate-y-0")
            )}
            style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                zIndex: isDragging ? 100 : 10,
                ...cssVars,
                ...(isSelected && !isDragging ? { boxShadow: `0 0 0 2px ${accentColor}b3` } : {})
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onPointerDown={handlePointerDown}
        >
            <div className={clsx(
                "flex h-full flex-col overflow-hidden border",
                shellRadiusClass,
                isBeautifulUI && motionClass,
                (isHovered || isDragging || isSelected)
                    ? isBeautifulUI
                        ? "border-[#1b2b33]/35 bg-[#fff6dd] shadow-[0_16px_36px_rgba(33,36,41,0.16)]"
                        : "border-[#1b2b33]/35 bg-[#fff6dd]"
                    : "border-transparent bg-transparent"
            )}>
                <div
                    className={clsx(
                        "drag-handle flex h-10 shrink-0 cursor-grab items-center justify-between border-b border-[#1b2b33]/20 bg-[#ffe5a8]/80 px-3.5 active:cursor-grabbing",
                        isBeautifulUI && motionClass,
                        (isHovered || isDragging || isSelected) ? "opacity-100" : "opacity-0"
                    )}
                    style={{ touchAction: 'none' }}
                >
                    <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-[#1b2b33]/70" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#22363f]">Note</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            data-no-drag
                            size="icon"
                            variant="ghost"
                            className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", controlRadiusClass, isBeautifulUI && motionClass)}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddToContext(node.content || '', node.id);
                            }}
                            title="Add note to context"
                        >
                            <Plus size={16} style={isSelected ? { color: accentColor } : undefined} />
                        </Button>
                        <X data-no-drag size={16} className={clsx("cursor-pointer text-[#6f4951] hover:text-[#b42318]", isBeautifulUI && motionClass)} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }} />
                    </div>
                </div>
                <Textarea
                    value={node.content}
                    onChange={(e) => updateContent(e.target.value)}
                    className={clsx("h-full w-full resize-none border-none bg-transparent px-4 py-3 text-sm leading-tight text-[#22363f] focus-visible:ring-0", isBeautifulUI && motionClass)}
                    placeholder="Notes..."
                />
            </div>
        </div>
    );
};

export const NoteNode = React.memo(NoteNodeComponent, (prev, next) => (
    prev.node === next.node &&
    prev.isSelected === next.isSelected &&
    prev.isExiting === next.isExiting &&
    prev.isBeautifulUI === next.isBeautifulUI &&
    prev.sharpEdges === next.sharpEdges
));

NoteNode.displayName = 'NoteNode';
