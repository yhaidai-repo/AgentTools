// A row of a plan's STRIDE threat register (<threat_model>).
export interface PlanRisk {
  id: string;
  plan: string;
  category: string;
  component: string;
  severity: string;
  disposition: string;
  mitigation: string;
}
