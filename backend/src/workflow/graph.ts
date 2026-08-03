import { StateGraph } from '@langchain/langgraph';
import { WorkflowStateAnnotation } from './annotation';
import {
  plannerNode,
  researchNode,
  productNode,
  prdNode,
  taskNode,
} from './nodes';
import type { LLMProvider } from '../llm/llm.provider';

interface NodeConfig {
  configurable?: {
    llm?: LLMProvider;
    [key: string]: unknown;
  };
}

const workflow = new StateGraph(WorkflowStateAnnotation)
  .addNode('planner', plannerNode)
  .addNode('research', researchNode)
  .addNode('product', productNode)
  .addNode('prd', prdNode)
  .addNode('task', taskNode)
  .addEdge('__start__', 'planner')
  .addEdge('planner', 'research')
  .addEdge('research', 'product')
  .addEdge('product', 'prd')
  .addEdge('prd', 'task')
  .addEdge('task', '__end__');

export const compiledGraph = workflow.compile();

export const AGENT_ORDER = ['planner', 'research', 'product', 'prd', 'task'] as const;
export type AgentName = (typeof AGENT_ORDER)[number];

/** Build a config object that injects the LLM provider into every node. */
export function makeGraphConfig(llm: LLMProvider): NodeConfig {
  return { configurable: { llm } };
}
