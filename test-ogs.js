// Inspect the FULL rss2json response to find where the real publisher URL is hidden
async function inspectRss2Json() {
    const topic = "AI";
    const googleRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(googleRssUrl)}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    // Inspect first 2 items fully
    for (const item of data.items.slice(0, 2)) {
        console.log("=== ARTICLE ===");
        console.log("title:", item.title);
        console.log("link:", item.link);
        console.log("guid:", item.guid);
        console.log("thumbnail:", item.thumbnail);
        console.log("enclosure:", JSON.stringify(item.enclosure));
        console.log("author:", item.author);

        // The description often contains HTML with the REAL article link
        console.log("description (raw HTML):", item.description?.substring(0, 500));

        // Try to extract real URL from description HTML
        const hrefMatch = item.description?.match(/href="(https?:\/\/(?!news\.google)[^"]+)"/);
        if (hrefMatch) {
            console.log(">>> REAL URL from description HTML:", hrefMatch[1]);
        }

        // Check all keys
        console.log("All keys:", Object.keys(item));
        console.log("---\n");
    }
}

inspectRss2Json();
