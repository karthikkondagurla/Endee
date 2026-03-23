import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { getArticleIndex } from '@/utils/endeeClient';
import { getEmbedding } from '@/utils/embeddings';

export const maxDuration = 30;

interface RAGBody {
    question: string;
    apiKey: string;
    topK?: number;
}

/**
 * POST /api/rag
 * Retrieval-Augmented Generation: embed the question, retrieve top-K articles
 * from Endee, then ask Groq to answer using only those articles as context.
 * Returns a streamed response with inline citations [1], [2], …
 */
export async function POST(request: Request) {
    try {
        const { question, apiKey, topK = 5 }: RAGBody = await request.json();

        if (!question || !question.trim()) {
            return NextResponse.json({ error: 'Question is required' }, { status: 400 });
        }

        if (!apiKey || !apiKey.startsWith('gsk_')) {
            return NextResponse.json({ error: 'Valid Groq API key required' }, { status: 401 });
        }

        // 1. Embed the question
        let retrievedArticles: any[] = [];
        try {
            const questionVector = await getEmbedding(question.trim());
            const index = await getArticleIndex();
            const rawResults = await index.query({ vector: questionVector, topK });
            retrievedArticles = (rawResults || []).map((r: any) => ({
                title: r.meta?.title || 'Untitled',
                link: r.meta?.link || '',
                sourceName: r.meta?.sourceName || '',
                contentSnippet: r.meta?.contentSnippet || '',
                similarity: r.similarity,
            }));
        } catch (err) {
            console.warn('[RAG] Endee retrieval failed, answering without context:', err);
        }

        // 2. Build grounded prompt with citations
        const hasContext = retrievedArticles.length > 0;
        const contextBlock = hasContext
            ? retrievedArticles
                  .map(
                      (a, i) =>
                          `[${i + 1}] ${a.title}\nSource: ${a.sourceName}\n${a.contentSnippet}`
                  )
                  .join('\n\n')
            : 'No articles available in the knowledge base yet.';

        const systemPrompt = hasContext
            ? `You are a knowledgeable news analyst. Answer the user's question using ONLY the provided news articles as your source of truth. Cite sources inline using [1], [2], etc. after each claim. Be concise and factual. If the articles don't contain enough information to answer, say so clearly.`
            : `You are a helpful news analyst. No articles have been indexed yet. Politely tell the user to add topics first so articles can be indexed, then they can ask questions.`;

        const userMessage = hasContext
            ? `News Articles:\n${contextBlock}\n\nQuestion: ${question}`
            : `Question: ${question}`;

        // 3. Stream Groq response
        const groq = new Groq({ apiKey });
        const stream = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            model: 'llama-3.1-8b-instant',
            temperature: 0.2,
            stream: true,
        });

        // 4. Return as a ReadableStream (SSE-compatible)
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                // First send source metadata as JSON line
                const sourcesPayload = JSON.stringify({
                    type: 'sources',
                    sources: retrievedArticles.map((a, i) => ({
                        index: i + 1,
                        title: a.title,
                        link: a.link,
                        sourceName: a.sourceName,
                        similarity: a.similarity,
                    })),
                });
                controller.enqueue(encoder.encode(`data: ${sourcesPayload}\n\n`));

                for await (const chunk of stream) {
                    const token = chunk.choices[0]?.delta?.content || '';
                    if (token) {
                        const payload = JSON.stringify({ type: 'token', content: token });
                        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                    }
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                controller.close();
            },
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error: any) {
        console.error('[RAG] Error:', error);
        return NextResponse.json(
            { error: error?.message || 'RAG request failed' },
            { status: 500 }
        );
    }
}
