export interface WorkflowState {
  projectId: string;
  runId: string;
  idea: string;
  currentNode: string;
  error: string | null;
  results: {
    planner?: PlannerOutput;
    research?: ResearchOutput;
    product?: ProductOutput;
    prd?: PrdOutput;
    task?: TaskOutput;
  };
}

export interface PlannerOutput {
  goals: string[];
  assumptions: string[];
  risks: string[];
  reasoning: string;
}

export interface ResearchOutput {
  marketOverview: string;
  competitors: Array<{ name: string; strengths: string; weaknesses: string }>;
  opportunities: string[];
  reasoning: string;
}

export interface ProductOutput {
  userPersona: string;
  painPoints: string[];
  positioning: string;
  features: Array<{ name: string; description: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }>;
  userFlows: string[];
  reasoning: string;
}

export interface PrdOutput {
  title: string;
  background: string;
  userProfiles: string;
  functionalRequirements: string;
  pageDesign: string;
  acceptanceCriteria: string[];
  reasoning: string;
}

export interface TaskOutput {
  tasks: Array<{
    title: string;
    description: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    estimateDays: number;
  }>;
  reasoning: string;
}
