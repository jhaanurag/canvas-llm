
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, HelpCircle, X } from 'lucide-react';

interface SelectionMenuProps {
    x: number;
    y: number;
    onExpand: () => void;
    onCustomAsk: (prompt: string) => void;
    onAddToContext: () => void;
    onClose: () => void;
}

export const SelectionMenu = ({ x, y, onExpand, onCustomAsk, onAddToContext, onClose }: SelectionMenuProps) => {
    const [isCustom, setIsCustom] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');

    return (
        <div
            className="fixed z-[3000] bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-1.5 flex gap-1 items-center animate-in fade-in zoom-in duration-100"
            style={{ left: x, top: y }}
        >
            {!isCustom ? (
                <>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs font-bold border-r-2 border-black rounded-none hover:bg-black hover:text-white"
                        onClick={onExpand}
                    >
                        <Search size={14} className="mr-1" />
                        EXPAND
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs font-bold border-r-2 border-black rounded-none hover:bg-black hover:text-white"
                        onClick={() => setIsCustom(true)}
                    >
                        <HelpCircle size={14} className="mr-1" />
                        ASK
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs font-bold rounded-none hover:bg-black hover:text-white"
                        onClick={onAddToContext}
                    >
                        <Plus size={14} />
                    </Button>
                    <div className="w-[1px] h-4 bg-neutral-300 mx-1" />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-1 text-xs font-bold rounded-none hover:bg-red-100 text-neutral-400 hover:text-red-500"
                        onClick={onClose}
                    >
                        <X size={14} />
                    </Button>
                </>
            ) : (
                <div className="flex gap-1">
                    <Input
                        autoFocus
                        className="h-8 text-xs border-2 border-black rounded-none w-48 focus-visible:ring-0"
                        placeholder="Ask anything about this selection..."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onCustomAsk(customPrompt);
                            if (e.key === 'Escape') setIsCustom(false);
                        }}
                    />
                    <Button
                        size="sm"
                        className="h-8 border-2 border-black bg-black text-white hover:bg-white hover:text-black rounded-none"
                        onClick={() => onCustomAsk(customPrompt)}
                    >
                        SEND
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 border-2 border-black rounded-none hover:bg-red-100"
                        onClick={() => setIsCustom(false)}
                    >
                        <X size={14} />
                    </Button>
                </div>
            )}
        </div>
    );
};
