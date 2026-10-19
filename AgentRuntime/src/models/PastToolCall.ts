// A tool call of a kept conversation that got its result, in call order.
export interface PastToolCall {
  callId: string;
  name: string;
  input: unknown;
  isError: boolean;
  output: string;
}
