import { z } from "zod";

// The inputs the flow commands share (PowerLoom Flow phase 1).
export const flowIdInput = z.string().trim().min(1).describe("The flow's id, e.g. FL-001 (flow_list)");
export const flowExecutionIdInput = z.string().trim().min(1).describe("The execution's id, e.g. FX-001 (flow_executions)");
