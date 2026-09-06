
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
    onMouseDown: () => void;

    isBeautifulUI?: boolean;
    sharpEdges?: boolean;
    accentColor?: string;
    setGlobalSelection: (selection: { text: string; x: number; y: number } | null) => void;
    onAddToContext: (text: string, nodeId: string) => void;
}

const NoteNodeComponent = ({ node, updatePos, updateContent, onDelete, onMouseDown, isBeautifulUI = false, sharpEdges = false, accentColor = '#0f766e', setGlobalSelection, onAddToContext }: NoteNodeProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [contextFeedback, setContextFeedback] = useState(false);
    const shellRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius)]';
    const outerRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius)]';
    const controlRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius-sm)]';

    const cssVars = {
        '--node-accent': accentColor,
        '--node-accent-15': `${accentColor}26`,
        '--node-accent-70': `${accentColor}b3`,
    } as React.CSSProperties;

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const isDragHandle = Boolean(target.closest('.drag-handle') && !target.closest('[data-no-drag]'));
        if (isDragHandle) {
            onMouseDown();
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsDragging(true);
            setDragStart({ x: e.clientX - node.x, y: e.clientY - node.y });
            e.stopPropagation();
        }
    };

    useEffect(() => {
        if (!contextFeedback) return;
        const timer = window.setTimeout(() => setContextFeedback(false), 1800);
        return () => window.clearTimeout(timer);
    }, [contextFeedback]);

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
            data-node-id={node.id}
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
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onPointerDown={handlePointerDown}
        >
            <div className={clsx(
                "flex h-full flex-col overflow-hidden border",
                shellRadiusClass,
                (isHovered || isDragging)
                    ? isBeautifulUI
                        ? "border-border bg-card shadow-lg"
                        : "border-border bg-card"
                    : "border-transparent bg-transparent"
            )}>
                <div
                    className={clsx(
                        "drag-handle select-none flex h-9 shrink-0 cursor-grab items-center justify-between border-b border-border/60 bg-secondary/40 px-3 active:cursor-grabbing",
                        (isHovered || isDragging) ? "opacity-100" : "opacity-0"
                    )}
                    style={{ touchAction: 'none' }}
                >
                    <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            data-no-drag
                            size="icon"
                            variant="ghost"
                            className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", controlRadiusClass)}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddToContext(node.content || '', node.id);
                                setContextFeedback(true);
                            }}
                            title="Add note to context"
                        >
                            <Plus size={16} />
                        </Button>
                        <X data-no-drag size={16} className="cursor-pointer text-muted-foreground hover:text-destructive transition-colors" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }} />
                    </div>
                </div>
                <Textarea
                    value={node.content}
                    onChange={(e) => updateContent(e.target.value)}
                    className="h-full w-full resize-none border-none bg-transparent px-4 py-3 text-sm leading-tight text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                    placeholder="Notes..."
                />
            </div>
            <div
                className={clsx(
                    "absolute left-4 z-0 border border-border/60 px-2.5 py-1 shadow-sm pointer-events-none",
                    contextFeedback ? "opacity-100 top-[calc(100%-4px)]" : "opacity-0 top-[calc(100%-16px)]",
                    (isHovered || isDragging) ? "bg-card" : "bg-transparent",
                    sharpEdges ? "rounded-none" : "rounded-b-[var(--canvas-radius-sm)]"
                )}
            >
                <div className="flex items-center gap-1.5 opacity-80">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                    <span className="text-[10px] font-medium tracking-wide text-foreground">Context added</span>
                </div>
            </div>
        </div>
    );
};

export const NoteNode = React.memo(NoteNodeComponent, (prev, next) => (
    prev.node === next.node &&
    prev.isBeautifulUI === next.isBeautifulUI &&
    prev.sharpEdges === next.sharpEdges
));

NoteNode.displayName = 'NoteNode';
