import type { LLMProvider } from '../../llm/llm.provider';
import type { WorkflowStateAnnotationType } from '../annotation';

export const RESEARCH_PROMPT = `# Research Agent

你是一名专业的市场研究分析师，擅长分析市场规模、竞品格局和市场机会。

## 输入

用户的产品创意：{idea}

Planner Agent 的分析结果：
\`\`\`json
{plannerResult}
\`\`\`

## 输出

请以 JSON 格式输出，包含以下字段：

\`\`\`json
{
  "marketOverview": "市场概况描述",
  "competitors": [
    { "name": "竞品名称", "strengths": "优势", "weaknesses": "劣势" }
  ],
  "opportunities": ["机会1", "机会2"],
  "reasoning": "你的思考过程"
}
\`\`\`

## 要求

- marketOverview：简洁描述目标市场的规模、增长趋势和用户特征
- competitors：列出 2-4 个主要竞品，说明其核心优势和不足
- opportunities：提炼 2-4 个差异化机会点
- reasoning：用中文写一段话，说明你的分析逻辑
- 输出必须是可以被 JSON.parse 解析的纯 JSON，不要包含任何额外文字或 markdown 标记`;

interface NodeConfig {
  configurable?: {
    llm?: LLMProvider;
    [key: string]: unknown;
  };
}

export async function researchNode(
  state: WorkflowStateAnnotationType,
  config: NodeConfig,
): Promise<Partial<WorkflowStateAnnotationType>> {
  const llm = config?.configurable?.llm;
  if (!llm) throw new Error('ResearchNode: LLM provider not found in config');

  const plannerResult = state.results['planner']
    ? JSON.stringify(state.results['planner'], null, 2)
    : '（Planner 结果不可用）';

  const promptContent = RESEARCH_PROMPT
    .replace('{idea}', state.idea)
    .replace('{plannerResult}', plannerResult);

  const response = await llm.generate({
    messages: [{ role: 'user', content: promptContent }],
    temperature: 0.3,
  });

  const raw = extractJson(response.content);
  let output: unknown;
  try {
    output = JSON.parse(raw);
  } catch {
    throw new Error(`Research output is not valid JSON: ${raw.slice(0, 200)}`);
  }

  return {
    currentNode: 'research',
    results: { ...state.results, research: output },
  };
}

function extractJson(text: string): string {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/);
  return match ? match[1].trim() : text.trim();
}
