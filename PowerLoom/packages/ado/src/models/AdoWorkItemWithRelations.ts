import type { AdoRelation } from "./AdoRelation";
import type { AdoWorkItem } from "./AdoWorkItem";

export interface AdoWorkItemWithRelations extends AdoWorkItem {
  relations: AdoRelation[];
}
