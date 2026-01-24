
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
            data-selection-menu="true"
            className="fixed z-[9999] bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] px-1.5 py-1 flex gap-1.5 items-center"
            style={{ left: x, top: y }}
        >
            {!isCustom ? (
                <>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-4 text-[11px] font-black border-r border-black rounded-none hover:bg-black hover:text-white uppercase"
                        onClick={onExpand}
                    >
                        <Search size={14} className="mr-2" />
                        EXPAND
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-4 text-[11px] font-black border-r border-black rounded-none hover:bg-black hover:text-white uppercase"
                        onClick={() => setIsCustom(true)}
                    >
                        <HelpCircle size={14} className="mr-2" />
                        ASK
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-3 text-[11px] font-black rounded-none hover:bg-black hover:text-white"
                        onClick={onAddToContext}
                    >
                        <Plus size={18} />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[11px] font-black rounded-none hover:bg-red-500 hover:text-white text-neutral-400"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </Button>
                </>
            ) : (
                <div className="flex gap-1 items-center px-1 py-0.5">
                    <Input
                        autoFocus
                        className="h-8 text-[11px] border-2 border-black rounded-none w-56 focus-visible:ring-0 font-bold placeholder:text-neutral-400"
                        placeholder="Ask about selection..."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onCustomAsk(customPrompt);
                            if (e.key === 'Escape') setIsCustom(false);
                        }}
                    />
                    <Button
                        size="sm"
                        className="h-8 px-4 border-2 border-black bg-black text-white hover:bg-white hover:text-black rounded-none font-black text-[11px] uppercase"
                        onClick={() => onCustomAsk(customPrompt)}
                    >
                        SEND
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 border-2 border-black rounded-none hover:bg-red-500 hover:text-white text-neutral-400"
                        onClick={() => setIsCustom(false)}
                    >
                        <X size={18} />
                    </Button>
                </div>
            )}
        </div>
    );
};
