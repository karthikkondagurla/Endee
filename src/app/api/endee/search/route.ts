import { NextResponse } from 'next/server';
import { getArticleIndex } from '@/utils/endeeClient';
import { getEmbedding } from '@/utils/embeddings';

interface SearchBody {
    query: string;
    topK?: number;
}

/**
 * POST /api/endee/search
 * Embeds the query and returns the top-K most semantically similar articles from Endee.
 */
export async function POST(request: Request) {
    try {
        const { query, topK = 5 }: SearchBody = await request.json();

        if (!query || query.trim().length === 0) {
            return NextResponse.json({ results: [] });
        }

        const queryVector = await getEmbedding(query.trim());
        const index = await getArticleIndex();

        const rawResults = await index.query({ vector: queryVector, topK });

        // Map Endee results back to Article-shaped objects for the frontend
        const results = (rawResults || []).map((r: any) => ({
            id: r.id,
            similarity: r.similarity,
            title: r.meta?.title || '',
            link: r.meta?.link || '',
            sourceName: r.meta?.sourceName || '',
            pubDate: r.meta?.pubDate || '',
            topic: r.meta?.topic || '',
            contentSnippet: r.meta?.contentSnippet || '',
        }));

        return NextResponse.json({ results });
    } catch (err: any) {
        console.warn('[Endee] Search failed:', err.message);
        return NextResponse.json(
            { results: [], error: 'Endee search unavailable. Server may be offline.' },
            { status: 503 }
        );
    }
}
