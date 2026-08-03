import type { LLMProvider } from '../../llm/llm.provider';
import type { WorkflowStateAnnotationType } from '../annotation';

export const TASK_PROMPT = `# Task Agent

你是一名资深研发项目经理，能够将产品需求转化为可执行、可估量的研发任务。

## 输入

用户的产品创意：{idea}

Planner Agent 的分析结果：
\`\`\`json
{plannerResult}
\`\`\`

Product Agent 的产品方案：
\`\`\`json
{productResult}
\`\`\`

PRD Agent 的需求文档：
\`\`\`json
{prdResult}
\`\`\`

## 输出

请以 JSON 格式输出，包含以下字段：

\`\`\`json
{
  "tasks": [
    { "title": "任务标题", "description": "任务详细描述", "priority": "HIGH|MEDIUM|LOW", "estimateDays": 预估天数 }
  ],
  "reasoning": "你的思考过程"
}
\`\`\`

## 要求

- tasks：将产品功能拆解为 4-8 个可执行的研发任务
  - title：简洁的任务名称，以动词开头（如"实现用户登录"、"设计数据库 schema"）
  - description：详细描述任务内容、验收条件和边界
  - priority：根据功能重要性和依赖关系标注优先级
  - estimateDays：合理的工时估算（1-14 天）
- reasoning：用中文写一段话，说明任务拆解的逻辑
- 输出必须是可以被 JSON.parse 解析的纯 JSON，不要包含任何额外文字或 markdown 标记`;

interface NodeConfig {
  configurable?: {
    llm?: LLMProvider;
    [key: string]: unknown;
  };
}

export async function taskNode(
  state: WorkflowStateAnnotationType,
  config: NodeConfig,
): Promise<Partial<WorkflowStateAnnotationType>> {
  const llm = config?.configurable?.llm;
  if (!llm) throw new Error('TaskNode: LLM provider not found in config');

  const plannerResult = state.results['planner']
    ? JSON.stringify(state.results['planner'], null, 2)
    : '（Planner 结果不可用）';
  const productResult = state.results['product']
    ? JSON.stringify(state.results['product'], null, 2)
    : '（Product 结果不可用）';
  const prdResult = state.results['prd']
    ? JSON.stringify(state.results['prd'], null, 2)
    : '（PRD 结果不可用）';

  const promptContent = TASK_PROMPT
    .replace('{idea}', state.idea)
    .replace('{plannerResult}', plannerResult)
    .replace('{productResult}', productResult)
    .replace('{prdResult}', prdResult);

  const response = await llm.generate({
    messages: [{ role: 'user', content: promptContent }],
    temperature: 0.3,
  });

  const raw = extractJson(response.content);
  let output: unknown;
  try {
    output = JSON.parse(raw);
  } catch {
    throw new Error(`Task output is not valid JSON: ${raw.slice(0, 200)}`);
  }

  return {
    currentNode: 'task',
    results: { ...state.results, task: output },
  };
}

function extractJson(text: string): string {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/);
  return match ? match[1].trim() : text.trim();
}
