
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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white border-2 border-black p-1 flex gap-1 z-[1000]">
            <Button
                variant="ghost"
                size="sm"
                className="rounded-none hover:bg-black hover:text-white"
                onClick={onRecenter}
            >
                <Home size={18} />
            </Button>
            <div className="w-[2px] bg-black mx-1" />
            <Button
                variant={activeTool === 'select' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none border-2 border-transparent data-[active=true]:border-black"
                onClick={() => setActiveTool('select')}
                data-active={activeTool === 'select'}
            >
                <MousePointer2 size={18} />
            </Button>
            <div className="w-[2px] bg-black mx-1" />
            <Button
                variant="ghost"
                size="sm"
                className="rounded-none hover:bg-black hover:text-white"
                onClick={() => onAddNode('chat')}
            >
                <MessageSquare size={18} className="mr-2" />
                CHAT
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="rounded-none hover:bg-black hover:text-white"
                onClick={() => onAddNode('note')}
            >
                <FileText size={18} className="mr-2" />
                NOTE
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="rounded-none hover:bg-black hover:text-white"
                onClick={() => onAddNode('drawing')}
            >
                <Pencil size={18} className="mr-2" />
                DRAW
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="rounded-none hover:bg-black hover:text-white"
            >
                <ImageIcon size={18} className="mr-2" />
                FILES
            </Button>
        </div>
    );
};
