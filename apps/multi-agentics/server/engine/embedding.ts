/**
 * Lightweight, dependency-free text embeddings for the simulated Vector DB.
 *
 * This is not a neural embedding — it is a deterministic hashed bag-of-words
 * projection into a fixed-dimension unit vector. It is good enough to power a
 * believable semantic search demo (similar terms cluster together) without any
 * model download or network call, keeping the platform runnable out of the box.
 */

export const EMBED_DIM = 96

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is',
  'are', 'be', 'this', 'that', 'it', 'as', 'by', 'at', 'from', 'we', 'you',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

/** FNV-1a hash → stable bucket index. */
function hash(token: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % EMBED_DIM
}

/** Produce a normalised embedding vector for a piece of text. */
export function embed(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0)
  const tokens = tokenize(text)
  for (const token of tokens) {
    // Hash into two buckets to reduce collisions and add a sub-word signal.
    vec[hash(token)] += 1
    vec[hash(token + '#')] += 0.5
  }
  return normalize(vec)
}

export function normalize(vec: number[]): number[] {
  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm) || 1
  return vec.map((v) => v / norm)
}

/** Cosine similarity of two already-normalised vectors. */
export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let dot = 0
  for (let i = 0; i < n; i++) dot += a[i] * b[i]
  return dot
}
