
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyB3d2RSwGrBrCLniPc-hATfgf0WqskpzLY';

// Using the pattern provided in the prompt docs
export async function* streamGeminiResponse(
    prompt: string,
    history: { role: 'user' | 'model'; parts: { text: string }[] }[] = [],
    files: { data: string; mimeType: string }[] = []
) {
    const ai = new GoogleGenAI({
        apiKey: API_KEY,
    });

    const model = 'gemini-flash-lite-latest';

    const contents = history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: h.parts
    }));

    // Add the current prompt
    const currentParts: any[] = [{ text: prompt }];
    files.forEach(file => {
        currentParts.push({
            inlineData: {
                data: file.data.split(',')[1],
                mimeType: file.mimeType
            }
        });
    });

    contents.push({
        role: 'user',
        parts: currentParts
    });

    const response = await ai.models.generateContentStream({
        model,
        contents,
        config: {
            thinkingConfig: {
                thinkingBudget: 0,
            },
        }
    });

    for await (const chunk of response) {
        if (chunk.text) {
            yield chunk.text;
        }
    }
}
