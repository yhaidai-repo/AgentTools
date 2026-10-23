type ProblemDetails = { title?: string; detail?: string };

// An expected refusal comes back as ProblemDetails; its detail is the message, else the status.
export function problemDetail(error: unknown, response: Response): string {
  const problem = (error ?? {}) as ProblemDetails;

  return problem.detail ?? problem.title ?? `PowerLoom answered ${response.status}.`;
}

export function powerloomFailure(error: unknown, response: Response): { ok: false; error: string } {
  return { ok: false, error: problemDetail(error, response) };
}
