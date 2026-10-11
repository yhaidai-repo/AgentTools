// Another solution the design agent weighed (user decision 2026-10-02: propose alternatives when relevant).
export interface DesignAlternative {
  option: string;
  pros: string[];
  cons: string[];
  whyNot: string;
}
