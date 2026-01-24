
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Node } from '@/types';
import { Card } from '@/components/ui/card';
import { GripVertical, X, Eraser, Pencil, Square, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clsx } from 'clsx';

interface DrawingNodeProps {
    node: Node;
    updatePos: (x: number, y: number) => void;
    onDelete: () => void;
    onSelect: () => void;
    onMouseDown: () => void;
    isSelected: boolean;
}

export const DrawingNode = ({ node, updatePos, onDelete, onSelect, onMouseDown, isSelected }: DrawingNodeProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;
    }, []);

    const startDrawing = (e: React.MouseEvent) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.strokeStyle = tool === 'pen' ? '#000' : '#fff';
        ctx.lineWidth = tool === 'pen' ? 2 : 20;
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => setIsDrawing(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        onMouseDown();
        if ((e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - node.x, y: e.clientY - node.y });
            e.stopPropagation();
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                updatePos(e.clientX - dragStart.x, e.clientY - dragStart.y);
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
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={clsx(
                "flex flex-col h-full border-2 transition-colors duration-200 rounded-none overflow-hidden",
                (isHovered || isDragging || isSelected) ? "border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" : "border-transparent bg-transparent shadow-none"
            )}>
                <div
                    className={clsx(
                        "drag-handle flex items-center justify-between p-1 bg-neutral-100 border-b-2 border-black cursor-grab active:cursor-grabbing shrink-0 transition-opacity",
                        (isHovered || isDragging || isSelected) ? "opacity-100" : "opacity-0"
                    )}
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex items-center gap-1">
                        <GripVertical size={14} />
                        <div className="flex gap-0.5 overflow-hidden ml-1">
                            <Button size="icon" variant="ghost" className="h-5 w-5 rounded-none p-0" onClick={() => setTool('pen')}>
                                <Pencil size={10} className={tool === 'pen' ? 'text-blue-600' : ''} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-5 w-5 rounded-none p-0" onClick={() => setTool('eraser')}>
                                <Eraser size={10} className={tool === 'eraser' ? 'text-blue-600' : ''} />
                            </Button>
                        </div>
                    </div>
                    <X size={14} className="cursor-pointer" onClick={onDelete} />
                </div>
                <canvas
                    ref={canvasRef}
                    width={node.width}
                    height={node.height - 35}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="cursor-crosshair bg-white"
                />
            </div>
        </div>
    );
};
