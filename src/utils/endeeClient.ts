import { Endee, Precision } from 'endee';

const ENDEE_BASE_URL = process.env.ENDEE_URL || 'http://localhost:8080/api/v1';
export const ARTICLE_INDEX_NAME = 'pigeon_articles';
const VECTOR_DIMENSION = 384; // all-MiniLM-L6-v2 output dimension

let clientInstance: Endee | null = null;

function getClient(): Endee {
    if (!clientInstance) {
        clientInstance = new Endee();
        clientInstance.setBaseUrl(ENDEE_BASE_URL);
    }
    return clientInstance;
}

/**
 * Returns the pigeon_articles index, creating it if it doesn't already exist.
 * Throws if the Endee server is not reachable.
 */
export async function getArticleIndex() {
    const client = getClient();

    try {
        // Try to get the existing index first
        return await client.getIndex(ARTICLE_INDEX_NAME);
    } catch {
        // Index doesn't exist – create it
        await client.createIndex({
            name: ARTICLE_INDEX_NAME,
            dimension: VECTOR_DIMENSION,
            spaceType: 'cosine',
            precision: Precision.INT8,
        });
        return await client.getIndex(ARTICLE_INDEX_NAME);
    }
}
