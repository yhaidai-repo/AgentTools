// An engine SearXNG asked that gave nothing back, with why: a timeout, a CAPTCHA, "Suspended: …".
export interface UnresponsiveEngine {
  engine: string;
  reason: string;
}
