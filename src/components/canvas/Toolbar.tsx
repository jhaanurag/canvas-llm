'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, FileText, Pencil, Image as ImageIcon, MousePointer2, Home } from 'lucide-react';

interface ToolbarProps {
    onAddNode: (type: 'chat' | 'note' | 'drawing') => void;
    activeTool: string;
    setActiveTool: (tool: string) => void;
    onRecenter: () => void;
}

export const Toolbar = ({ onAddNode, activeTool, setActiveTool, onRecenter }: ToolbarProps) => {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-sm border border-border p-1.5 flex items-center gap-1 rounded-xl shadow-md z-[1000]">
            <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-lg text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors"
                onClick={onRecenter}
                title="Recenter Canvas"
            >
                <Home size={16} />
            </Button>
            <div className="w-px h-5 bg-border mx-0.5" />
            <Button
                variant={activeTool === 'select' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0 rounded-lg text-foreground/80 hover:bg-secondary hover:text-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground transition-colors"
                onClick={() => setActiveTool('select')}
                data-active={activeTool === 'select'}
                title="Select Tool"
            >
                <MousePointer2 size={16} />
            </Button>
            <div className="w-px h-5 bg-border mx-0.5" />
            <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 rounded-lg text-xs font-semibold text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors"
                onClick={() => onAddNode('chat')}
            >
                <MessageSquare size={15} className="mr-1.5" />
                CHAT
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 rounded-lg text-xs font-semibold text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors"
                onClick={() => onAddNode('note')}
            >
                <FileText size={15} className="mr-1.5" />
                NOTE
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 rounded-lg text-xs font-semibold text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors"
                onClick={() => onAddNode('drawing')}
            >
                <Pencil size={15} className="mr-1.5" />
                DRAW
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 rounded-lg text-xs font-semibold text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors"
            >
                <ImageIcon size={15} className="mr-1.5" />
                FILES
            </Button>
        </div>
    );
};
