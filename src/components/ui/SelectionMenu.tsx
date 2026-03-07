
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, HelpCircle, X } from 'lucide-react';
import { clsx } from 'clsx';

interface SelectionMenuProps {
    x: number;
    y: number;
    isBeautifulUI?: boolean;
    sharpEdges?: boolean;
    accentColor?: string;
    onExpand: () => void;
    onCustomAsk: (prompt: string) => void;
    onAddToContext: () => void;
    onClose: () => void;
}

export const SelectionMenu = ({ x, y, isBeautifulUI = false, sharpEdges = false, accentColor = '#0f766e', onExpand, onCustomAsk, onAddToContext, onClose }: SelectionMenuProps) => {
    const [isCustom, setIsCustom] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const motionClass = 'transition-[background-color,border-color,box-shadow,color,opacity,transform] duration-200 ease-out';
    const shellRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[18px]';
    const controlRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[10px]';

    const cssVars = {
        '--node-accent': accentColor,
        '--node-accent-15': `${accentColor}26`,
        '--node-accent-70': `${accentColor}b3`,
        '--node-accent-dark': accentColor === '#0f766e' ? '#0b5a54' : accentColor
    } as React.CSSProperties;

    return (
        <div
            data-selection-menu="true"
            className={clsx(
                "fixed z-[9999] flex items-center gap-1.5 border border-[#1b2b33]/30 bg-[#fff8ed] px-1.5 py-1.5",
                shellRadiusClass,
                isBeautifulUI && motionClass,
                isBeautifulUI && "shadow-[0_8px_18px_rgba(33,36,41,0.2)]"
            )}
            style={{ left: x, top: y, ...cssVars }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {!isCustom ? (
                <>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={clsx("h-8 border border-[#1b2b33]/20 bg-[#fff8ed]/80 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] hover:bg-[color:var(--node-accent)] hover:text-[#f8fffd]", controlRadiusClass, isBeautifulUI && motionClass)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={onExpand}
                    >
                        <Search size={14} className="mr-1.5" />
                        Expand
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={clsx("h-8 border border-[#1b2b33]/20 bg-[#fff8ed]/80 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] hover:bg-[color:var(--node-accent)] hover:text-[#f8fffd]", controlRadiusClass, isBeautifulUI && motionClass)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setIsCustom(true)}
                    >
                        <HelpCircle size={14} className="mr-1.5" />
                        Ask
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={clsx("h-8 border border-[#1b2b33]/20 bg-[#fff8ed]/80 px-3 text-[11px] font-semibold hover:bg-[color:var(--node-accent)] hover:text-[#f8fffd]", controlRadiusClass, isBeautifulUI && motionClass)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={onAddToContext}
                    >
                        <Plus size={16} />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={clsx("h-8 border border-red-500/25 px-2 text-[11px] font-semibold text-red-700 hover:bg-red-100", controlRadiusClass, isBeautifulUI && motionClass)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={onClose}
                    >
                        <X size={16} />
                    </Button>
                </>
            ) : (
                <div className="flex items-center gap-1 px-1 py-0.5">
                    <Input
                        autoFocus
                        className={clsx("h-8 w-56 border border-[#1b2b33]/25 bg-[#fffaf2] text-[11px] font-medium placeholder:text-[#617177] focus-visible:ring-2", controlRadiusClass, isBeautifulUI && motionClass)}
                        placeholder="Ask about selection..."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onCustomAsk(customPrompt.trim());
                            }
                            if (e.key === 'Escape') setIsCustom(false);
                        }}
                    />
                    <Button
                        size="sm"
                        className={clsx("h-8 bg-[color:var(--node-accent)] px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f8fffd] hover:bg-[color:var(--node-accent-dark)]", controlRadiusClass, isBeautifulUI && motionClass)}
                        onClick={() => onCustomAsk(customPrompt.trim())}
                    >
                        Send
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={clsx("h-8 border border-red-500/25 px-2 text-red-700 hover:bg-red-100", controlRadiusClass, isBeautifulUI && motionClass)}
                        onClick={() => setIsCustom(false)}
                    >
                        <X size={16} />
                    </Button>
                </div>
            )}
        </div>
    );
};
