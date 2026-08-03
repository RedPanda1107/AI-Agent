import type { LLMProvider } from '../../llm/llm.provider';
import type { WorkflowStateAnnotationType } from '../annotation';

export const PRD_PROMPT = `# PRD Agent

你是一名专业的产品需求文档撰写者，能够将产品方案转化为结构完整、可执行的 PRD。

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

Product Agent 的产品方案：
\`\`\`json
{productResult}
\`\`\`

## 输出

请以 JSON 格式输出，包含以下字段：

\`\`\`json
{
  "title": "PRD 标题",
  "background": "项目背景",
  "userProfiles": "用户画像",
  "functionalRequirements": "功能需求描述",
  "pageDesign": "页面设计描述",
  "acceptanceCriteria": ["验收标准1", "验收标准2", "验收标准3"],
  "reasoning": "你的思考过程"
}
\`\`\`

## 要求

- title：产品需求文档标题
- background：清晰说明做这个产品的原因、目标和预期价值
- userProfiles：详细描述目标用户群体
- functionalRequirements：详细列出核心功能需求
- pageDesign：描述主要页面结构和交互设计
- acceptanceCriteria：列出 3-6 条可验证的验收标准，每条标准可测试
- reasoning：用中文写一段话，说明 PRD 的撰写逻辑
- 输出必须是可以被 JSON.parse 解析的纯 JSON，不要包含任何额外文字或 markdown 标记`;

interface NodeConfig {
  configurable?: {
    llm?: LLMProvider;
    [key: string]: unknown;
  };
}

export async function prdNode(
  state: WorkflowStateAnnotationType,
  config: NodeConfig,
): Promise<Partial<WorkflowStateAnnotationType>> {
  const llm = config?.configurable?.llm;
  if (!llm) throw new Error('PrdNode: LLM provider not found in config');

  const plannerResult = state.results['planner']
    ? JSON.stringify(state.results['planner'], null, 2)
    : '（Planner 结果不可用）';
  const researchResult = state.results['research']
    ? JSON.stringify(state.results['research'], null, 2)
    : '（Research 结果不可用）';
  const productResult = state.results['product']
    ? JSON.stringify(state.results['product'], null, 2)
    : '（Product 结果不可用）';

  const promptContent = PRD_PROMPT
    .replace('{idea}', state.idea)
    .replace('{plannerResult}', plannerResult)
    .replace('{researchResult}', researchResult)
    .replace('{productResult}', productResult);

  const response = await llm.generate({
    messages: [{ role: 'user', content: promptContent }],
    temperature: 0.3,
  });

  const raw = extractJson(response.content);
  let output: unknown;
  try {
    output = JSON.parse(raw);
  } catch {
    throw new Error(`PRD output is not valid JSON: ${raw.slice(0, 200)}`);
  }

  return {
    currentNode: 'prd',
    results: { ...state.results, prd: output },
  };
}

function extractJson(text: string): string {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/);
  return match ? match[1].trim() : text.trim();
}
