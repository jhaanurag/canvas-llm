
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search, X } from 'lucide-react';
import { clsx } from 'clsx';

interface SelectionMenuProps {
    x: number;
    y: number;
    isBeautifulUI?: boolean;
    sharpEdges?: boolean;
    accentColor?: string;
    onExpand: () => void;
    onAddToContext: () => void;
    onClose: () => void;
}

export const SelectionMenu = ({ x, y, isBeautifulUI = false, sharpEdges = false, accentColor = '#0f766e', onExpand, onAddToContext, onClose }: SelectionMenuProps) => {
    const shellRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius)]';
    const controlRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-[var(--canvas-radius-sm)]';

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
                isBeautifulUI && "shadow-[0_8px_18px_rgba(33,36,41,0.2)]"
            )}
            style={{ left: x, top: y, ...cssVars }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <Button
                size="sm"
                variant="ghost"
                className={clsx("h-8 border border-[#1b2b33]/20 bg-[#fff8ed]/80 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] hover:bg-[color:var(--node-accent)] hover:text-[#f8fffd]", controlRadiusClass)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onExpand}
            >
                <Search size={14} className="mr-1.5" />
                Expand
            </Button>
            <Button
                size="sm"
                variant="ghost"
                className={clsx("h-8 border border-[#1b2b33]/20 bg-[#fff8ed]/80 px-3 text-[11px] font-semibold hover:bg-[color:var(--node-accent)] hover:text-[#f8fffd]", controlRadiusClass)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onAddToContext}
            >
                <Plus size={16} />
            </Button>
            <Button
                size="sm"
                variant="ghost"
                className={clsx("h-8 border border-red-500/25 px-2 text-[11px] font-semibold text-red-700 hover:bg-red-100", controlRadiusClass)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClose}
            >
                <X size={16} />
            </Button>
        </div>
    );
};
