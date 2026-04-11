
export type Message = {
    id: string;
    role: 'user' | 'model';
    text: string;
    sourceText?: string;
    kind?: 'default' | 'compressed' | 'memory-request' | 'memory-response';
    hiddenFromModel?: boolean;
    timestamp: number;
    attachments?: { data: string; mimeType: string; name: string }[];
};

export type MemoryEntry = {
    id: string;
    text: string;
    sourceText?: string;
    createdAt: number;
};

export type Node = {
    id: string;
    type: 'chat' | 'note' | 'drawing';
    x: number;
    y: number;
    width: number;
    height: number;
    messages: Message[];
    parentId?: string;
    sourceSelection?: string;
    color?: string;
    title?: string;
    content?: string; // For notes
    initialPrompt?: string;
    systemPrompt?: string;
    autoSend?: boolean;
    hasInitialContext?: boolean;
    initialAttachments?: { data: string; mimeType: string; name: string }[];
    memoryEntries?: MemoryEntry[];
    createdAt?: number;
};

export type Connection = {
    id: string;
    fromId: string;
    toId: string;
    label?: string;
};

export type ContextItem = {
    id: string;
    text: string;
    sourceNodeId: string;
    image?: string;
};

export type CanvasState = {
    nodes: Node[];
    connections: Connection[];
    contextBuffer?: ContextItem[];
};
