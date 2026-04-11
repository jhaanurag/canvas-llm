
type ChatHistoryEntry = {
    role: 'user' | 'model' | 'assistant';
    text: string;
};

type ChatContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

type ChatMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string | ChatContentPart[];
};

const RENDER_COLD_START_MESSAGE =
    "The AI service is temporarily unavailable right now. Please try again in a moment.\n\nHeads up: the Render proxy may take a little time to wake up on the first request. 🙋 Wait 20-60 seconds, then try again.";

export async function* streamGeminiResponse(
    prompt: string,
    history: ChatHistoryEntry[] = [],
    files: { data: string; mimeType: string }[] = [],
    systemPrompt: string = 'You are a helpful AI assistant. Do not reveal the internal workings to the user.'
) {
    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history.map((entry): ChatMessage => ({
            role: entry.role === 'user' ? 'user' : 'assistant',
            content: entry.text
        }))
    ];

    if (files.length > 0) {
        // Construct multi-modal message for current turn
        const content: ChatContentPart[] = [
            { type: "text", text: prompt }
        ];

        files.forEach(file => {
            content.push({
                type: "image_url",
                image_url: {
                    url: file.data // This is already a data URL from FileReader
                }
            });
        });

        messages.push({
            role: 'user',
            content: content
        });
    } else {
        messages.push({
            role: 'user',
            content: prompt
        });
    }

    const body = {
        model: "gpt-4.1-2025-04-14",
        messages,
        stream: true
    };

    try {
        const response = await fetch("/api/llm", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[LLM Error]', response.status, err);
            if (response.status === 502) {
                throw new Error(err || RENDER_COLD_START_MESSAGE);
            }
            throw new Error(err || `LLM Proxy returned ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body from LLM proxy');
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const cleanLine = line.replace(/^data: /, "").trim();
                if (cleanLine === "" || cleanLine === "[DONE]") continue;

                try {
                    const parsed = JSON.parse(cleanLine);
                    const content = parsed.choices[0]?.delta?.content;
                    if (content) yield content;
                } catch {
                    // Ignore partial JSON chunks
                }
            }
        }
    } catch (error) {
        console.error('[LLM Fetch Error]', error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
            yield `Error: Cannot connect to the LLM service. The app tries your local proxy first and then the hosted backup.\n\nOriginal error: ${error.message}`;
        } else {
            yield `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
        }
    }
}
