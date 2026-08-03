import type { LLMProvider } from '../../llm/llm.provider';
import type { WorkflowStateAnnotationType } from '../annotation';

export const PRODUCT_PROMPT = `# Product Agent

你是一名资深产品设计师，能够将用户研究和市场分析转化为清晰的产品方案。

## 输入

用户的产品创意：{idea}

Planner Agent 的分析结果：
\`\`\`json
{plannerResult}
\`\`\`

Research Agent 的市场研究结果：
\`\`\`json
{researchResult}
\`\`\`

## 输出

请以 JSON 格式输出，包含以下字段：

\`\`\`json
{
  "userPersona": "目标用户画像描述",
  "painPoints": ["痛点1", "痛点2"],
  "positioning": "产品定位描述",
  "features": [
    { "name": "功能名称", "description": "功能描述", "priority": "HIGH|MEDIUM|LOW" }
  ],
  "userFlows": ["流程1", "流程2"],
  "reasoning": "你的思考过程"
}
\`\`\`

## 要求

- userPersona：描述核心用户群体的人口统计特征、使用场景和核心诉求
- painPoints：列出 3-5 个用户痛点，与竞品分析形成差异化
- positioning：用一句话描述产品在市场中的独特定位
- features：列出 3-6 个核心功能，每个包含名称、描述和优先级
- userFlows：描述 2-3 个关键用户使用流程
- reasoning：用中文写一段话，说明产品设计的逻辑
- 输出必须是可以被 JSON.parse 解析的纯 JSON，不要包含任何额外文字或 markdown 标记`;

interface NodeConfig {
  configurable?: {
    llm?: LLMProvider;
    [key: string]: unknown;
  };
}

export async function productNode(
  state: WorkflowStateAnnotationType,
  config: NodeConfig,
): Promise<Partial<WorkflowStateAnnotationType>> {
  const llm = config?.configurable?.llm;
  if (!llm) throw new Error('ProductNode: LLM provider not found in config');

  const plannerResult = state.results['planner']
    ? JSON.stringify(state.results['planner'], null, 2)
    : '（Planner 结果不可用）';
  const researchResult = state.results['research']
    ? JSON.stringify(state.results['research'], null, 2)
    : '（Research 结果不可用）';

  const promptContent = PRODUCT_PROMPT
    .replace('{idea}', state.idea)
    .replace('{plannerResult}', plannerResult)
    .replace('{researchResult}', researchResult);

  const response = await llm.generate({
    messages: [{ role: 'user', content: promptContent }],
    temperature: 0.3,
  });

  const raw = extractJson(response.content);
  let output: unknown;
  try {
    output = JSON.parse(raw);
  } catch {
    throw new Error(`Product output is not valid JSON: ${raw.slice(0, 200)}`);
  }

  return {
    currentNode: 'product',
    results: { ...state.results, product: output },
  };
}

function extractJson(text: string): string {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/);
  return match ? match[1].trim() : text.trim();
}
