
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Node } from '@/types';
import { GripVertical, X, Eraser, Pencil, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clsx } from 'clsx';

interface DrawingNodeProps {
    node: Node;
    updatePos: (x: number, y: number) => void;
    onDelete: () => void;
    onMouseDown: () => void;
    isBeautifulUI?: boolean;
    sharpEdges?: boolean;
    accentColor?: string;
    onAddToContext?: (text: string, sourceNodeId: string, image?: string) => void;
}

const DrawingNodeComponent = ({ node, updatePos, onDelete, onMouseDown, isBeautifulUI = false, sharpEdges = false, accentColor = '#0f766e', onAddToContext }: DrawingNodeProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
    const [hasStrokes, setHasStrokes] = useState(false);
    const [contextFeedback, setContextFeedback] = useState(false);

    const cssVars = {
        '--node-accent': accentColor,
        '--node-accent-15': `${accentColor}26`,
        '--node-accent-70': `${accentColor}b3`,
    } as React.CSSProperties;
    const shellRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius)]';
    const outerRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius)]';
    const controlRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius-sm)]';

    const detectCanvasInk = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 3; i < data.length; i += 16) {
            if (data[i] > 0) return true;
        }
        return false;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;
    }, []);

    useEffect(() => {
        if (!contextFeedback) return;
        const timer = window.setTimeout(() => setContextFeedback(false), 1800);
        return () => window.clearTimeout(timer);
    }, [contextFeedback]);

    const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        onMouseDown();
        e.stopPropagation();
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    };

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        e.stopPropagation();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = tool === 'pen' ? 2 : 20;
        
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = (e?: React.PointerEvent<HTMLCanvasElement>) => {
        if (e) {
            e.stopPropagation();
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        }
        const canvas = canvasRef.current;
        if (canvas) {
            setHasStrokes(detectCanvasInk(canvas));
        }
        setIsDrawing(false);
    };

    const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('[data-no-drag]')) {
            return;
        }
        onMouseDown();
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        setDragStart({ x: e.clientX - node.x, y: e.clientY - node.y });
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

    return (
        <div
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
        >
            <div className={clsx(
                "flex h-full flex-col overflow-hidden border",
                shellRadiusClass,
                (isHovered || isDragging)
                    ? isBeautifulUI
                        ? "border-[#1b2b33]/35 bg-[#fffaf2] shadow-[0_16px_36px_rgba(33,36,41,0.16)]"
                        : "border-[#1b2b33]/35 bg-[#fffaf2]"
                    : "border-transparent bg-transparent"
            )}>
                <div
                    className={clsx(
                        "drag-handle flex h-10 shrink-0 cursor-grab items-center justify-between border-b border-[#1b2b33]/20 bg-[#eef5f8]/90 px-3.5 active:cursor-grabbing",
                        (isHovered || isDragging) ? "opacity-100" : "opacity-0"
                    )}
                    onPointerDown={handleDragStart}
                    style={{ touchAction: 'none' }}
                >
                    <div className="flex items-center gap-1">
                        <GripVertical size={14} className="text-[#1b2b33]/70" />
                        <div className="ml-1 flex gap-1 overflow-hidden">
                            <Button data-no-drag size="icon" variant="ghost" className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", controlRadiusClass)} onClick={() => setTool('pen')}>
                                <Pencil size={12} style={tool === 'pen' ? { color: accentColor } : undefined} />
                            </Button>
                            <Button data-no-drag size="icon" variant="ghost" className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", controlRadiusClass)} onClick={() => setTool('eraser')}>
                                <Eraser size={12} style={tool === 'eraser' ? { color: accentColor } : undefined} />
                            </Button>
                            {onAddToContext && (
                                <Button data-no-drag size="icon" variant="ghost" className={clsx("h-7 w-7 p-0 hover:bg-[color:var(--node-accent-15)]", controlRadiusClass)} title="Add to Context" onClick={() => {
                                    const canvas = canvasRef.current;
                                    if(canvas) {
                                         // Create a scaled-down temporary canvas to reduce size/resolution
                                         const scaleFactor = 0.5; // Reduce resolution by half
                                         const tempCanvas = document.createElement('canvas');
                                         tempCanvas.width = canvas.width * scaleFactor;
                                         tempCanvas.height = canvas.height * scaleFactor;
                                         const ctx = tempCanvas.getContext('2d');
                                         if (ctx) {
                                             ctx.fillStyle = '#FFFFFF';
                                             ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                                             ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
                                            
                                             // For now, continue sending as base64 string for GenAI compatibility
                                             // but compress using jpeg at reduced quality
                                             onAddToContext("Drawing", node.id, tempCanvas.toDataURL('image/jpeg', 0.8));
                                             setContextFeedback(true);
                                         }
                                    }
                                }}>
                                    <CheckSquare size={12} />
                                </Button>
                            )}
                        </div>
                    </div>
                    <X data-no-drag size={14} className="cursor-pointer text-[#6f4951] hover:text-[#b42318]" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }} />
                </div>
                <canvas
                    ref={canvasRef}
                    width={node.width}
                    height={node.height - 40}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
                    className={clsx(
                        "block cursor-crosshair",
                        (isHovered || isDragging)
                            ? "bg-white/95"
                            : hasStrokes
                                ? "bg-transparent"
                                : "bg-white/40"
                    )}
                    style={{
                        touchAction: 'none',
                        borderBottomLeftRadius: sharpEdges ? 0 : 'var(--canvas-radius)',
                        borderBottomRightRadius: sharpEdges ? 0 : 'var(--canvas-radius)'
                    }}
                />
            </div>
            <div
                className={clsx(
                    "absolute left-4 z-0 border border-[#1b2b33]/20 px-3 py-1 shadow-sm pointer-events-none",
                    contextFeedback ? "opacity-100 top-[calc(100%-4px)]" : "opacity-0 top-[calc(100%-16px)]",
                    (isHovered || isDragging) ? "bg-[#fffdf7]" : "bg-transparent",
                    sharpEdges ? "rounded-none" : "rounded-b-[var(--canvas-radius-sm)]"
                )}
            >
                <div className="flex items-center gap-1.5 opacity-80">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                    <span className="text-[10px] font-medium tracking-wide text-[#1b2b33]">Image added</span>
                </div>
            </div>
        </div>
    );
};

export const DrawingNode = React.memo(DrawingNodeComponent, (prev, next) => (
    prev.node === next.node &&
    prev.isBeautifulUI === next.isBeautifulUI &&
    prev.sharpEdges === next.sharpEdges
));
