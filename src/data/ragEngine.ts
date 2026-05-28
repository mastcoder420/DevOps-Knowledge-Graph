import { HistoricalPostMortem } from "./incidentData";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "in", "on", "of", "to", "for", "with", "by", "at", 
  "from", "is", "was", "were", "be", "been", "has", "have", "had", "that", "this", 
  "these", "those", "it", "its", "their", "they", "we", "our", "you", "i", "are", 
  "but", "as", "if", "then", "else", "when", "where", "how", "why", "who", "which"
]);

// Tokenize text into lowercase words, filtering out punctuation and stop words
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

// Compute term frequency for a document
function getTF(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  if (tokens.length === 0) return tf;
  
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  
  // Normalize TF
  for (const term in tf) {
    tf[term] = tf[term] / tokens.length;
  }
  return tf;
}

// Compute IDF for all terms in vocabulary
function getIDF(documentsTokens: string[][], vocabulary: Set<string>): Record<string, number> {
  const idf: Record<string, number> = {};
  const N = documentsTokens.length;
  
  vocabulary.forEach(term => {
    const docCount = documentsTokens.filter(tokens => tokens.includes(term)).length;
    // Classic IDF with smoothing
    idf[term] = Math.log(1 + (N / (1 + docCount)));
  });
  
  return idf;
}

// Vectorize a document based on TF-IDF
function vectorize(tf: Record<string, number>, idf: Record<string, number>, vocabulary: string[]): number[] {
  return vocabulary.map(term => (tf[term] || 0) * (idf[term] || 0));
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(v1: number[], v2: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    normA += v1[i] * v1[i];
    normB += v2[i] * v2[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RAGMatch {
  postMortem: HistoricalPostMortem;
  score: number; // Decimal similarity score (0 to 1)
}

/**
 * Searches the historical post-mortem reports and returns matched reports sorted by semantic relevance.
 */
export function queryPostMortems(queryText: string, database: HistoricalPostMortem[]): RAGMatch[] {
  const queryTokens = tokenize(queryText);
  if (queryTokens.length === 0) {
    return database.map(pm => ({ postMortem: pm, score: 0 }));
  }

  // Tokenize all documents (concatenating title, symptoms, and root_cause for matching)
  const docsTokens = database.map(pm => 
    tokenize(`${pm.title} ${pm.symptoms} ${pm.root_cause} ${pm.company}`)
  );

  // Build vocabulary
  const vocabulary = new Set<string>();
  queryTokens.forEach(t => vocabulary.add(t));
  docsTokens.forEach(tokens => tokens.forEach(t => vocabulary.add(t)));
  const vocabArray = Array.from(vocabulary);

  // Compute IDF
  const idf = getIDF(docsTokens, vocabulary);

  // Vectorize query
  const queryTF = getTF(queryTokens);
  const queryVector = vectorize(queryTF, idf, vocabArray);

  // Vectorize all documents and calculate similarity
  const matches: RAGMatch[] = database.map((pm, idx) => {
    const docTF = getTF(docsTokens[idx]);
    const docVector = vectorize(docTF, idf, vocabArray);
    const similarity = cosineSimilarity(queryVector, docVector);
    
    return {
      postMortem: pm,
      // Map to a human-friendly scale where even minor matches get highlighted, or clamp to [0, 1]
      score: Math.min(Math.max(similarity, 0), 1)
    };
  });

  // Sort matches by relevance score descending
  return matches.sort((a, b) => b.score - a.score);
}
