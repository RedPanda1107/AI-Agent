import type { LLMProvider } from '../../llm/llm.provider';
import type { WorkflowStateAnnotationType } from '../annotation';

export const PLANNER_PROMPT = `# Planner Agent

你是一名资深产品经理，擅长将用户的模糊创意拆解为清晰的目标、假设和风险。

## 输入

用户的原始产品创意描述：{idea}

## 输出

请以 JSON 格式输出，包含以下字段：

\`\`\`json
{
  "goals": ["目标1", "目标2"],
  "assumptions": ["假设1", "假设2"],
  "risks": ["风险1", "风险2"],
  "reasoning": "你的思考过程"
}
\`\`\`

## 要求

- goals：提炼出 2-4 个核心产品目标，用动词开头，简洁有力
- assumptions：列出 2-4 个关键假设（用户真的会需要这个功能吗？技术可行性如何？）
- risks：列出 2-4 个潜在风险（市场竞争、用户留存、技术难度等）
- reasoning：用中文写一段话，说明你对用户想法的理解和分析
- 输出必须是可以被 JSON.parse 解析的纯 JSON，不要包含任何额外文字或 markdown 标记`;

interface NodeConfig {
  configurable?: {
    llm?: LLMProvider;
    [key: string]: unknown;
  };
}

export async function plannerNode(
  state: WorkflowStateAnnotationType,
  config: NodeConfig,
): Promise<Partial<WorkflowStateAnnotationType>> {
  const llm = config?.configurable?.llm;
  if (!llm) throw new Error('PlannerNode: LLM provider not found in config');

  const promptContent = PLANNER_PROMPT.replace('{idea}', state.idea);

  const response = await llm.generate({
    messages: [{ role: 'user', content: promptContent }],
    temperature: 0.3,
  });

  const raw = extractJson(response.content);
  let output: unknown;
  try {
    output = JSON.parse(raw);
  } catch {
    throw new Error(`Planner output is not valid JSON: ${raw.slice(0, 200)}`);
  }

  return {
    currentNode: 'planner',
    results: { ...state.results, planner: output },
  };
}

function extractJson(text: string): string {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/);
  return match ? match[1].trim() : text.trim();
}
