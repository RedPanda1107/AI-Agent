import { z } from 'zod';

export const PlannerOutputSchema = z.object({
  goals: z.array(z.string()).describe('核心目标列表'),
  assumptions: z.array(z.string()).describe('关键假设'),
  risks: z.array(z.string()).describe('潜在风险'),
  reasoning: z.string().describe('思考过程'),
});

export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

export const ResearchOutputSchema = z.object({
  marketOverview: z.string().describe('市场概况'),
  competitors: z
    .array(
      z.object({
        name: z.string(),
        strengths: z.string(),
        weaknesses: z.string(),
      }),
    )
    .describe('竞品分析列表'),
  opportunities: z.array(z.string()).describe('市场机会'),
  reasoning: z.string().describe('思考过程'),
});

export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

export const ProductOutputSchema = z.object({
  userPersona: z.string().describe('目标用户画像'),
  painPoints: z.array(z.string()).describe('用户痛点'),
  positioning: z.string().describe('产品定位'),
  features: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      }),
    )
    .describe('功能列表'),
  userFlows: z.array(z.string()).describe('关键用户流程'),
  reasoning: z.string().describe('思考过程'),
});

export type ProductOutput = z.infer<typeof ProductOutputSchema>;

export const PrdOutputSchema = z.object({
  title: z.string().describe('PRD 标题'),
  background: z.string().describe('项目背景'),
  userProfiles: z.string().describe('用户画像'),
  functionalRequirements: z.string().describe('功能需求'),
  pageDesign: z.string().describe('页面设计'),
  acceptanceCriteria: z.array(z.string()).describe('验收标准'),
  reasoning: z.string().describe('思考过程'),
});

export type PrdOutput = z.infer<typeof PrdOutputSchema>;

export const TaskOutputSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
        estimateDays: z.number(),
      }),
    )
    .describe('研发任务列表'),
  reasoning: z.string().describe('思考过程'),
});

export type TaskOutput = z.infer<typeof TaskOutputSchema>;
