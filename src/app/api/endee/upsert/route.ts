import { NextResponse } from 'next/server';
import { getArticleIndex } from '@/utils/endeeClient';
import { getEmbedding } from '@/utils/embeddings';
import type { Article } from '@/utils/fetchRSS';

interface UpsertBody {
    articles: Article[];
}

/**
 * POST /api/endee/upsert
 * Embeds and stores a batch of articles in the Endee vector index.
 * The article link is used as the stable ID.
 */
export async function POST(request: Request) {
    try {
        const { articles }: UpsertBody = await request.json();

        if (!articles || articles.length === 0) {
            return NextResponse.json({ upserted: 0 });
        }

        const index = await getArticleIndex();

        // Build upsert payload: embed title + snippet for each article
        const vectorItems = await Promise.all(
            articles.map(async (article) => {
                const textToEmbed = `${article.title}. ${article.contentSnippet || ''}`.slice(0, 512);
                const vector = await getEmbedding(textToEmbed);

                return {
                    id: Buffer.from(article.link).toString('base64').slice(0, 64),
                    vector,
                    meta: {
                        title: article.title,
                        link: article.link,
                        sourceName: article.sourceName,
                        pubDate: article.pubDate,
                        topic: article.topic || '',
                        contentSnippet: (article.contentSnippet || '').slice(0, 300),
                    },
                };
            })
        );

        await index.upsert(vectorItems);

        return NextResponse.json({ upserted: vectorItems.length });
    } catch (err: any) {
        console.warn('[Endee] Upsert failed:', err.message);
        // Return a non-fatal error — the news feed still works without Endee
        return NextResponse.json(
            { upserted: 0, error: 'Endee upsert failed. Server may be offline.' },
            { status: 503 }
        );
    }
}
