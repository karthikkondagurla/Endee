import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import * as cheerio from "cheerio";

export async function POST(request: Request) {
    try {
        const { apiKey, title, link } = await request.json();

        if (!apiKey || !apiKey.startsWith("gsk_")) {
            return NextResponse.json(
                { error: "Invalid or missing Groq API Key" },
                { status: 401 }
            );
        }

        if (!link) {
            return NextResponse.json(
                { error: "Missing article link" },
                { status: 400 }
            );
        }

        // Fetch and parse the original article
        let articleText = "";
        let ogImage = null;
        let author = null;

        try {
            const articleRes = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (articleRes.ok) {
                const html = await articleRes.text();
                const $ = cheerio.load(html);

                // Extract metadata
                ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
                author = $('meta[name="author"]').attr('content') || $('meta[property="article:author"]').attr('content') || $('.author-name').text() || null;

                // Grab paragraph text (very basic extraction)
                $('p').each((i, el) => {
                    articleText += $(el).text() + "\n\n";
                });
                // Truncate to avoid massive token usage
                articleText = articleText.substring(0, 15000);
            }
        } catch (e) {
            console.warn("Failed to scrape article text", e);
        }

        // Initialize Groq with the user's BYOK
        const groq = new Groq({ apiKey: apiKey });

        const prompt = `
        You are an expert news summarizer. I am giving you the title and the scraped text of a news article. 
        Your job is to provide exactly three things in a strict JSON format:
        1. A "short_summary" array of strings where each string is a very brief bullet point. Provide exactly 3-4 short bullet points (maximum 4 lines total) summarizing the article for a quick glance.
        2. A "detailed_summary" array where each item is a detailed paragraph (string) summarizing the article. Provide 3-4 comprehensive paragraphs to give the user a full understanding of the story. Do NOT use bullet points here, write full paragraphs.
        3. A "sentiment" string that is exactly one of these three words: "Positive", "Neutral", "Negative".

        Title: ${title}
        Article Text: ${articleText || "Text not available. Please try to infer a summary from the title."}

        Respond ONLY with a valid JSON object matching this TypeScript interface:
        {
            "short_summary": string[], // 3-4 short bullet points
            "detailed_summary": string[], // 3-4 comprehensive paragraphs
            "sentiment": "Positive" | "Neutral" | "Negative"
        }
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.1-8b-instant", // Fast, free inference model
            temperature: 0.1,
            response_format: { type: "json_object" }, // Ensures valid JSON return
        });

        const output = chatCompletion.choices[0]?.message?.content;

        if (!output) {
            throw new Error("Empty response from Groq");
        }

        const parsedResult = JSON.parse(output);

        // Inject scraped metadata into the result
        parsedResult.ogImage = ogImage;
        parsedResult.author = author;

        return NextResponse.json(parsedResult);

    } catch (error: any) {
        console.error("AI Summarization error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to generate AI summary" },
            { status: 500 }
        );
    }
}
