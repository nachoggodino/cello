import advancedKpi from "../../../docs/examples/advanced_kpi.cel?raw";
import basic from "../../../docs/examples/basic.cel?raw";
import featureShowcase from "../../../docs/examples/feature_showcase.cel?raw";

export interface PlaygroundExample {
  id: string;
  name: string;
  fileName: string;
  description: string;
  source: string;
}

const teamScorecard = `
// A compact scorecard for small operating teams

@sheet Scorecard
@header | Signal | Owner | Current | Target | Delta |
@defaults | | | | | =Current-Target |
| Velocity | Nadia | 42 | 38 |
| Bugs | Mateo | 7 | 4 |
| Response time | Ines | 18 | 20 |
[bold] [bg:#fff1e8] | Health | | =SUM(Current) | =SUM(Target) | =SUM(Delta) |

@sheet Decisions
| ## Weekly decisions | < |
| Ship import polish | yes |
| Hold pricing work | no |
| Update BYLAWS examples | yes |
`.trim();

const regionalPlan = `
@sheet Regions
@header | Region | Lead | Revenue[€][0d] | Target[€][0d] | Attainment[%][1d] |
@defaults | | | | | =Revenue/Target |
| Madrid | Ana | 7200 | 6900 |
| Barcelona | Luis | 3900 | 4200 |
| Valencia | Pedro | 1800 | 1700 |

@sheet Summary
@header | Metric | Value |
| Total revenue | =SUM(Regions!Revenue) |
| Total target | =SUM(Regions!Target) |
| Attainment | =SUM(Regions!Revenue)/SUM(Regions!Target) |
`.trim();

export const examples: PlaygroundExample[] = [
  {
    id: "feature-showcase",
    name: "Feature Showcase",
    fileName: "feature_showcase.cel",
    description: "Merges, modifiers, imports, formulas, and summaries.",
    source: featureShowcase.trim()
  },
  {
    id: "advanced-kpi",
    name: "Advanced KPI",
    fileName: "advanced_kpi.cel",
    description: "A fuller revenue workbook with targets and leaderboards.",
    source: advancedKpi.trim()
  },
  {
    id: "team-scorecard",
    name: "Team Scorecard",
    fileName: "team_scorecard.cel",
    description: "A focused operating sheet with formulas and decisions.",
    source: teamScorecard
  },
  {
    id: "regional-plan",
    name: "Regional Plan",
    fileName: "regional_plan.cel",
    description: "A clean multi-sheet target plan.",
    source: regionalPlan
  },
  {
    id: "basic",
    name: "Basic",
    fileName: "basic.cel",
    description: "The smallest useful Cello workbook.",
    source: basic.trim()
  }
];

export const defaultExampleId = "feature-showcase";

export function getExample(id: string): PlaygroundExample {
  const example = examples.find((candidate) => candidate.id === id);
  if (example) {
    return example;
  }

  const fallback = examples[0];
  if (!fallback) {
    throw new Error("At least one playground example is required.");
  }
  return fallback;
}
