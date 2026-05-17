import advancedKpi from "../../examples/advanced_kpi.cel?raw";
import basic from "../../examples/basic.cel?raw";
import featureShowcase from "../../examples/feature_showcase.cel?raw";

export interface PlaygroundExample {
  id: string;
  name: string;
  description: string;
  source: string;
}

export const examples: PlaygroundExample[] = [
  {
    id: "feature-showcase",
    name: "Feature Showcase",
    description: "Merges, modifiers, imports, formulas, and summaries.",
    source: featureShowcase.trim()
  },
  {
    id: "advanced-kpi",
    name: "Advanced KPI",
    description: "A fuller revenue workbook with targets and leaderboards.",
    source: advancedKpi.trim()
  },
  {
    id: "basic",
    name: "Basic",
    description: "The smallest useful Cello workbook.",
    source: basic.trim()
  }
];

export const defaultExampleId = "feature-showcase";

export function getExample(id: string): PlaygroundExample {
  return examples.find((example) => example.id === id) ?? examples[0]!;
}
