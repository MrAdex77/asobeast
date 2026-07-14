export interface SpiderSuggestion {
  text: string;
  priority: number | null;
  probes: number;
}

export interface SpiderStatus {
  term: string;
  probesDone: number;
  probesTotal: number;
  complete: boolean;
  suggestions: SpiderSuggestion[];
}
