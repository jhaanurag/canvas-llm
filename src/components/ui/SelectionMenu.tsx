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
    const shellRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-xl';
    const controlRadiusClass = sharpEdges ? 'rounded-none' : 'rounded-lg';

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
                "fixed z-[9999] flex items-center gap-1.5 border border-border bg-card/95 backdrop-blur-sm px-1.5 py-1.5 shadow-lg",
                shellRadiusClass
            )}
            style={{ left: x, top: y, ...cssVars }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <Button
                size="sm"
                variant="ghost"
                className={clsx("h-8 border border-border/80 bg-background/80 px-3 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-[color:var(--node-accent)] hover:text-white transition-colors", controlRadiusClass)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onExpand}
            >
                <Search size={14} className="mr-1.5" />
                Expand
            </Button>
            <Button
                size="sm"
                variant="ghost"
                className={clsx("h-8 border border-border/80 bg-background/80 px-2.5 text-xs font-semibold text-foreground hover:bg-[color:var(--node-accent)] hover:text-white transition-colors", controlRadiusClass)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onAddToContext}
                title="Add to Context"
            >
                <Plus size={16} />
            </Button>
            <Button
                size="sm"
                variant="ghost"
                className={clsx("h-8 border border-destructive/30 px-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors", controlRadiusClass)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClose}
                title="Close"
            >
                <X size={16} />
            </Button>
        </div>
    );
};
