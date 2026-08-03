import { Annotation } from '@langchain/langgraph';

/**
 * LangGraph State annotation for the product-manager workflow.
 *
 * NOTE: LangGraph JS does not support custom reducers in Annotation.Root.
 * Results from each node are accumulated by spreading the update in each node:
 *   return { results: { ...state.results, [nodeName]: nodeOutput } }
 *
 * The `results` field is typed as Record<string, unknown>; Zod schemas in
 * schemas/index.ts validate the actual sub-structure at the node level.
 */
export const WorkflowStateAnnotation = Annotation.Root({
  projectId: Annotation<string>(),
  runId: Annotation<string>(),
  idea: Annotation<string>(),
  currentNode: Annotation<string>(),
  error: Annotation<string | null>(),
  results: Annotation<Record<string, unknown>>(),
});

/** The state type consumed/produced by graph nodes (matches the annotation above). */
export type WorkflowStateAnnotationType = {
  projectId: string;
  runId: string;
  idea: string;
  currentNode: string;
  error: string | null;
  results: Record<string, unknown>;
};
