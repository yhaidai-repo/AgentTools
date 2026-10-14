import { z } from "zod";

// write_refinement's estimate, the same for Refinement and Better Refinement.
export const estimateInput = z.object({
  hours: z.number().positive().describe("Approximate hours for one developer to finish the PBI: code, tests, review fixes"),
  basis: z.string().min(1).describe("What drives the number: the areas that change, the unknowns, comparable work"),
}).describe("A rough estimate for planning; design estimates its plan later");
