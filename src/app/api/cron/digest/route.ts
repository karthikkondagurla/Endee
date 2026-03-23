import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { fetchRSS } from '@/utils/fetchRSS';
import { getEmbedding } from '@/utils/embeddings';
import { getArticleIndex } from '@/utils/endeeClient';

export const maxDuration = 60;

const DEFAULT_TOPICS = ['artificial intelligence', 'startups', 'climate tech', 'finance', 'geopolitics'];

/**
 * GET /api/cron/digest
 * Daily digest agent — called by Vercel Cron at 6AM UTC.
 * 1. Fetches latest RSS articles for configured topics
 * 2. Embeds and upserts them into Endee
 * 3. Retrieves top articles per topic from Endee
 * 4. Generates a structured AI briefing via Groq
 *
 * Protected by CRON_SECRET env var.
 */
export async function GET(request: Request) {
    // Auth: validate cron secret (Vercel sends it automatically when configured)
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();

    try {
        // 1. Determine topics
        const rawTopics = process.env.DIGEST_TOPICS || '';
        const topics = rawTopics
            ? rawTopics.split(',').map((t) => t.trim()).filter(Boolean)
            : DEFAULT_TOPICS;

        // 2. Fetch RSS articles
        const articles = await fetchRSS(topics);
        console.log(`[Digest] Fetched ${articles.length} articles for ${topics.length} topics`);

        // 3. Embed and upsert into Endee (best-effort)
        let upsertedCount = 0;
        try {
            const index = await getArticleIndex();
            const vectorItems = await Promise.all(
                articles.map(async (article) => {
                    const text = `${article.title}. ${article.contentSnippet || ''}`.slice(0, 512);
                    const vector = await getEmbedding(text);
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
            upsertedCount = vectorItems.length;
        } catch (endeeErr) {
            console.warn('[Digest] Endee upsert failed (non-fatal):', endeeErr);
        }

        // 4. Retrieve top articles per topic from Endee for the digest
        const topicSections: { topic: string; articles: any[] }[] = [];
        try {
            const index = await getArticleIndex();
            for (const topic of topics) {
                const topicVector = await getEmbedding(topic);
                const results = await index.query({ vector: topicVector, topK: 5 });
                if (results && results.length > 0) {
                    topicSections.push({
                        topic,
                        articles: results.map((r: any) => ({
                            title: r.meta?.title || '',
                            source: r.meta?.sourceName || '',
                            link: r.meta?.link || '',
                            snippet: r.meta?.contentSnippet || '',
                        })),
                    });
                }
            }
        } catch (endeeErr) {
            // Fallback: use raw fetched articles grouped by topic
            const grouped = topics.map((topic) => ({
                topic,
                articles: articles
                    .filter((a) => a.topic === topic)
                    .slice(0, 5)
                    .map((a) => ({
                        title: a.title,
                        source: a.sourceName,
                        link: a.link,
                        snippet: a.contentSnippet || '',
                    })),
            }));
            topicSections.push(...grouped);
        }

        // 5. Build Groq prompt for the digest
        const groqApiKey = process.env.GROQ_API_KEY;
        let digest: string | null = null;

        if (groqApiKey && topicSections.length > 0) {
            const contextBlocks = topicSections
                .filter((s) => s.articles.length > 0)
                .map((s) => {
                    const articleList = s.articles
                        .map((a, i) => `  ${i + 1}. ${a.title} (${a.source})`)
                        .join('\n');
                    return `## ${s.topic.toUpperCase()}\n${articleList}`;
                })
                .join('\n\n');

            const groq = new Groq({ apiKey: groqApiKey });
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a professional news curator writing a daily morning briefing. Be concise, insightful, and professional. Format with markdown headers per topic.',
                    },
                    {
                        role: 'user',
                        content: `Write a daily AI news digest based on these top stories per topic. For each topic write 2-3 sentences synthesizing the key themes. Include the most important development.\n\n${contextBlocks}`,
                    },
                ],
                model: 'llama-3.1-8b-instant',
                temperature: 0.3,
            });

            digest = completion.choices[0]?.message?.content || null;
        }

        return NextResponse.json({
            ok: true,
            generatedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            topicCount: topics.length,
            articlesFetched: articles.length,
            articlesIndexed: upsertedCount,
            digest,
            topics: topicSections.map((s) => ({
                topic: s.topic,
                articleCount: s.articles.length,
                topArticles: s.articles.slice(0, 3),
            })),
        });
    } catch (error: any) {
        console.error('[Digest] Cron job failed:', error);
        return NextResponse.json(
            { error: error?.message || 'Digest generation failed' },
            { status: 500 }
        );
    }
}
