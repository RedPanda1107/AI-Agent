import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { WorkflowService } from './workflow.service';
import { StartWorkflowDto } from './dto/start-workflow.dto';

/**
 * In-memory registry mapping runId -> set of SSE response objects.
 * When the workflow emits an event for a runId, all SSE clients subscribed
 * to that run receive the event.
 *
 * Key design:
 * - POST /workflow/start  → creates run, starts workflow, registers SSE clients
 * - GET  /workflow/run/:runId/stream → subscribes to events for that runId
 */
const subscribers = new Map<string, Set<Response>>();

export function subscribeRun(runId: string, res: Response): void {
  if (!subscribers.has(runId)) subscribers.set(runId, new Set());
  subscribers.get(runId)!.add(res);
}

export function unsubscribeRun(runId: string, res: Response): void {
  subscribers.get(runId)?.delete(res);
  if (subscribers.get(runId)?.size === 0) subscribers.delete(runId);
}

@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  /**
   * POST /workflow/start
   * Creates a WorkflowRun, starts the LangGraph execution (with SSE events),
   * and returns immediately with the runId.
   */
  @Post('start')
  @HttpCode(HttpStatus.ACCEPTED)
  async start(@Body() dto: StartWorkflowDto) {
    const runId = await this.workflow.createRun(dto.projectId);

    // Fire and forget the streaming execution.
    // The SSE endpoint (GET /workflow/run/:runId/stream) will pick up events.
    void this.workflow.run(dto.projectId, runId, dto.idea, (event) => {
      const clients = subscribers.get(runId);
      if (!clients || clients.size === 0) return;

      const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
      for (const client of clients) {
        client.write(payload);
      }
    });

    return { runId, projectId: dto.projectId };
  }

  /**
   * GET /workflow/run/:runId/stream
   * Server-Sent Events endpoint. Clients connect to receive real-time
   * node lifecycle events: run.started, node.started, node.delta,
   * node.completed, node.failed, run.completed.
   */
  @Get('run/:runId/stream')
  async stream(@Param('runId') runId: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    subscribeRun(runId, res);

    // Send a connected confirmation so the client knows the pipe is open
    res.write(`event: connected\ndata: ${JSON.stringify({ runId })}\n\n`);

    res.on('close', () => {
      unsubscribeRun(runId, res);
      res.end();
    });
  }

  /**
   * GET /workflow/run/:runId
   * Returns the current state of a workflow run including all agent outputs.
   */
  @Get('run/:runId')
  async getRun(@Param('runId') runId: string) {
    const run = await this.workflow.getRun(runId);
    if (!run) return { error: 'Run not found' };
    return run;
  }

  /**
   * GET /workflow/run/:runId/results
   * Returns the aggregated results from all completed agents in a run.
   */
  @Get('run/:runId/results')
  async getResults(@Param('runId') runId: string) {
    const results = await this.workflow.getResults(runId);
    return results ?? { error: 'No results yet' };
  }

  /**
   * GET /workflow/project/:projectId/runs
   * Returns all workflow runs for a project.
   */
  @Get('project/:projectId/runs')
  async getProjectRuns(@Param('projectId') projectId: string) {
    return this.workflow.getRunsByProject(projectId);
  }

  /**
   * POST /workflow/run/:runId/persist
   * Persists the workflow run results into Document and Task records.
   * Finds the 'prd' agent run output and saves it as a Document (type PRD),
   * and finds the 'task' agent run output.tasks array to create Task records.
   */
  @Post('run/:runId/persist')
  async persistResults(@Param('runId') runId: string) {
    const run = await this.workflow.getRun(runId);
    if (!run) return { error: 'Run not found' };
    return this.workflow.persistResults(runId, run.projectId);
  }
}
