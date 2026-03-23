import { NextResponse } from 'next/server';
import { getArticleIndex } from '@/utils/endeeClient';
import { getEmbedding } from '@/utils/embeddings';

interface RecommendBody {
    articleLink: string;
    title: string;
    contentSnippet?: string;
    topK?: number;
}

/**
 * POST /api/endee/recommend
 * Given an article (by link + text), finds the most semantically similar
 * articles stored in Endee. The current article itself is excluded from results.
 */
export async function POST(request: Request) {
    try {
        const { articleLink, title, contentSnippet, topK = 6 }: RecommendBody =
            await request.json();

        if (!title) {
            return NextResponse.json({ results: [] });
        }

        // Embed the article text (same method used at upsert time)
        const text = `${title}. ${contentSnippet || ''}`.slice(0, 512);
        const vector = await getEmbedding(text);

        const index = await getArticleIndex();
        const rawResults = await index.query({ vector, topK });

        // Map and filter out the article itself
        const results = (rawResults || [])
            .map((r: any) => ({
                id: r.id,
                similarity: r.similarity,
                title: r.meta?.title || '',
                link: r.meta?.link || '',
                sourceName: r.meta?.sourceName || '',
                pubDate: r.meta?.pubDate || '',
                topic: r.meta?.topic || '',
                contentSnippet: r.meta?.contentSnippet || '',
            }))
            .filter((r: any) => r.link !== articleLink && r.similarity < 0.9999);

        return NextResponse.json({ results: results.slice(0, topK - 1) });
    } catch (err: any) {
        console.warn('[Endee] Recommend failed:', err.message);
        return NextResponse.json(
            { results: [], error: 'Endee recommendations unavailable.' },
            { status: 503 }
        );
    }
}
