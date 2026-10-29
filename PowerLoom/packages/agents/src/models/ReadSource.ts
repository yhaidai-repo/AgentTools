// Something a run read: the first message or one successful reading-tool result, under the id the agent cites.
export interface ReadSource {
  id: string;
  text: string;
  tool?: string;
  resultText?: string;
  fresh?: boolean;
}
