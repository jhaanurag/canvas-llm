
export type Message = {
    id: string;
    role: 'user' | 'model';
    text: string;
    sourceText?: string;
    timestamp: number;
    attachments?: { data: string; mimeType: string; name: string }[];
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
};
