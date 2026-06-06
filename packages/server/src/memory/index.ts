export { BaseMemoryStrategy } from "./strategy";
export { FileMemoryStrategy } from "./strategies/file-memory";
// export { HyMemoryStrategy } from "./strategies/hy/strategy"; // Commented out due to missing vector/embeddings dependency
export {
  getAllEntries,
  addEntry,
  replaceEntry,
  removeEntry,
  searchEntries,
} from "./store";
export {
  saveSession,
  getRecentSessions,
  searchSessions,
  getSessionById,
  deleteSession,
} from "./sessions";
export { TrajectoryDB } from "./trajectories";
export type {
  Trajectory,
  TrajectoryStep,
  TrajectoryPreference,
} from "./trajectories";
// Vector store and embeddings modules removed - commenting out exports
// export { VectorStore } from "./vector/vector-store";
// export type {
//   VectorSearchResult,
//   VectorEntry,
// } from "./vector/vector-store";
// export {
//   computeEmbedding,
//   cosineSimilarity,
//   computeSimilarity,
// } from "./vector/embeddings";
export {
  extractMemoriesFromConversation,
  Changelog,
} from "./utils";
export type { ChangeEntry } from "./utils";
