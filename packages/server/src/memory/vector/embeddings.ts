const VOCAB_SIZE = 4096;

function hashToken(token: string): number {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) - h + token.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % VOCAB_SIZE;
}

export function computeEmbedding(text: string): number[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (tokens.length === 0) return new Array(VOCAB_SIZE).fill(0);

  const tf = new Map<number, number>();
  for (const token of tokens) {
    const idx = hashToken(token);
    tf.set(idx, (tf.get(idx) ?? 0) + 1);
  }

  const vector = new Array(VOCAB_SIZE).fill(0);
  const maxFreq = Math.max(...tf.values());
  for (const [idx, freq] of tf) {
    vector[idx] = freq / maxFreq;
  }

  return vector;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function computeSimilarity(textA: string, textB: string): number {
  return cosineSimilarity(computeEmbedding(textA), computeEmbedding(textB));
}
