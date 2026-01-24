
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyB3d2RSwGrBrCLniPc-hATfgf0WqskpzLY';

// Using the pattern provided in the prompt docs


export async function* streamGeminiResponse(
    prompt: string,
    history: { role: 'user' | 'model' | 'assistant'; text: string }[] = [],
    files: { data: string; mimeType: string }[] = [],
    systemPrompt: string = 'You are a helpful AI assistant.'
) {
    const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.text
        }))
    ];

    if (files.length > 0) {
        // Construct multi-modal message for current turn
        const content: any[] = [
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
        const response = await fetch("http://localhost:4000/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer sk-anything"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[LLM Error]', response.status, err);
            throw new Error(`LLM Proxy returned ${response.status}: ${err}`);
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
                } catch (e) {
                    // Ignore partial JSON chunks
                }
            }
        }
    } catch (error) {
        console.error('[LLM Fetch Error]', error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
            yield `Error: Cannot connect to LLM proxy on localhost:4000. Please ensure:\n1. litellm is running on port 4001\n2. python3 litellm_proxy.py is running on port 4000\n\nOriginal error: ${error.message}`;
        } else {
            yield `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
        }
    }
}


