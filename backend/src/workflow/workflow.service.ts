import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { compiledGraph, makeGraphConfig } from './graph';
import type { WorkflowStateAnnotationType } from './annotation';
import { PrismaService } from '../prisma/prisma.service';
import { LLM_PROVIDER, type LLMProvider } from '../llm/llm.provider';

export type AgentEventType =
  | 'run.started'
  | 'node.started'
  | 'node.delta'
  | 'node.completed'
  | 'node.failed'
  | 'run.completed';

export interface AgentEvent {
  type: AgentEventType;
  runId: string;
  node?: string;
  data?: unknown;
  timestamp: string;
}

export type EventCallback = (event: AgentEvent) => void;

@Injectable()
export class WorkflowService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
  ) {}

  onModuleInit() {
    this.logger.log('WorkflowService initialized with LLM provider');
  }

  async createRun(projectId: string): Promise<string> {
    const run = await this.prisma.workflowRun.create({
      data: {
        project: { connect: { id: projectId } },
        status: 'RUNNING',
      },
    });
    return run.id;
  }

  private async persistAgentRun(
    runId: string,
    agentName: string,
    status: 'SUCCESS' | 'FAILED',
    input: unknown,
    output: unknown,
    durationMs: number,
    tokenUsage: number | undefined,
  ): Promise<void> {
    await this.prisma.agentRun.create({
      data: {
        workflowRunId: runId,
        agentName,
        status,
        input: input as object,
        output: output as object,
        durationMs,
        tokenUsage,
      },
    });
  }

  /**
   * Execute the workflow graph with streaming events.
   * Fires onEvent callbacks as each node starts, completes, or fails.
   * Also persists AgentRun records to the database.
   */
  async run(
    projectId: string,
    runId: string,
    idea: string,
    onEvent: EventCallback,
  ): Promise<void> {
    onEvent({ type: 'run.started', runId, timestamp: new Date().toISOString() });

    const initialState: WorkflowStateAnnotationType = {
      projectId,
      runId,
      idea,
      currentNode: '',
      error: null,
      results: {},
    };

    const graphConfig = makeGraphConfig(this.llm);

    try {
      // Stream the graph using LangGraph's stream() method.
      // This yields per-node intermediate states so we can emit events.
      let tokenUsage: number | undefined;

      for await (const chunk of await compiledGraph.stream(initialState, graphConfig)) {
        for (const [nodeName, nodeState] of Object.entries(chunk)) {
          onEvent({
            type: 'node.started',
            runId,
            node: nodeName,
            timestamp: new Date().toISOString(),
          });

          const nodeOutput = (nodeState as Partial<WorkflowStateAnnotationType>).results?.[nodeName];
          if (nodeOutput !== undefined) {
            onEvent({
              type: 'node.delta',
              runId,
              node: nodeName,
              data: nodeOutput,
              timestamp: new Date().toISOString(),
            });

            onEvent({
              type: 'node.completed',
              runId,
              node: nodeName,
              data: nodeOutput,
              timestamp: new Date().toISOString(),
            });

            // Persist AgentRun record asynchronously (non-blocking)
            const startTime = Date.now();
            await this.persistAgentRun(
              runId,
              nodeName,
              'SUCCESS',
              { idea, results: initialState.results },
              nodeOutput,
              Date.now() - startTime,
              tokenUsage,
            );
          }
        }
      }

      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'COMPLETED', currentNode: 'task' },
      });
      onEvent({ type: 'run.completed', runId, timestamp: new Date().toISOString() });
      this.logger.log(`Run ${runId} completed successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Workflow execution failed';
      this.logger.error(`Run ${runId} failed: ${message}`);

      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'FAILED', currentNode: 'unknown' },
      });
      onEvent({
        type: 'node.failed',
        runId,
        node: 'unknown',
        data: { message },
        timestamp: new Date().toISOString(),
      });
      onEvent({ type: 'run.completed', runId, timestamp: new Date().toISOString() });
    }
  }

  async getRun(runId: string) {
    return this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { agentRuns: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getRunsByProject(projectId: string) {
    return this.prisma.workflowRun.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getResults(runId: string) {
    const agentRuns = await this.prisma.agentRun.findMany({
      where: { workflowRunId: runId },
      orderBy: { createdAt: 'asc' },
    });
    if (!agentRuns.length) return null;

    const results: Record<string, unknown> = {};
    for (const agentRun of agentRuns) {
      if (agentRun.output) {
        results[agentRun.agentName] = agentRun.output;
      }
    }
    return results;
  }
}
