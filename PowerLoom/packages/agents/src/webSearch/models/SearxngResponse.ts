// The part of SearXNG's `format=json` answer PowerLoom reads (searx/webutils.py get_json_response): main results, and
// each engine that gave nothing back as an [engine, translated error] pair.
export interface SearxngResponse {
  results?: { title?: string; url?: string; content?: string }[];
  unresponsive_engines?: [string, string][];
}
