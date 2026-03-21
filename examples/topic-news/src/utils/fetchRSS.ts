import Parser from 'rss-parser';

export interface Article {
    title: string;
    link: string;
    pubDate: string;
    sourceName: string;
    contentSnippet: string;
    topic: string;
    imageUrl?: string;
    description?: string;
}

const parser = new Parser();

export async function fetchRSS(topics: string[]): Promise<Article[]> {
    const allArticles: Article[] = [];

    for (const rawTopic of topics) {
        const encodedTopic = encodeURIComponent(rawTopic.trim());
        const googleRssUrl = `https://news.google.com/rss/search?q=${encodedTopic}&hl=en-US&gl=US&ceid=US:en`;

        try {
            const feed = await parser.parseURL(googleRssUrl);

            // Process articles concurrently
            const articlesPromises = (feed.items || []).map(async (item: any) => {
                // Parse title & source from "Real Title - Source Name" format
                let title = item.title || "Untitled Article";
                let source = "Unknown Source";

                if (title.includes(" - ")) {
                    const parts = title.split(" - ");
                    source = parts.pop() || source;
                    title = parts.join(" - ");
                }

                const articleLink = item.link || "";

                const description = item.contentSnippet || item.content || item.summary || "";
                const rssSnippet = description
                    .replace(/<[^>]*>?/gm, "")
                    .substring(0, 150);

                return {
                    title,
                    link: articleLink,
                    pubDate: item.pubDate || new Date().toISOString(),
                    sourceName: source,
                    contentSnippet: rssSnippet,
                    topic: rawTopic,
                };
            });

            const articles = await Promise.all(articlesPromises);
            allArticles.push(...articles);
        } catch (error) {
            console.error(`Error fetching RSS for topic "${rawTopic}":`, error);
        }
    }

    // Sort by date descending
    allArticles.sort(
        (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    return allArticles;
}
