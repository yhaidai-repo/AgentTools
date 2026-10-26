import { GitHubApiError } from "./GitHubApiError";

const API = "https://api.github.com";
const PAGE = 30;

type Json = Record<string, any>;

// GitHub's REST API with the vault's token, for the agents' GitHub tools: pull requests, issues and CI checks to read,
// and a draft pull request to open (user decision 2026-10-25). The answers are GitHub's JSON; the tools pick the fields.
export class GitHubApi {
  constructor(private readonly token: string, private readonly fetchFn: typeof fetch = fetch) {}

  pullRequests(owner: string, repo: string, state: "open" | "closed" | "all"): Promise<Json[]> {
    return this.get(`${repoUrl(owner, repo)}/pulls?state=${state}&per_page=${PAGE}&sort=updated&direction=desc`);
  }

  async pullRequest(owner: string, repo: string, number: number): Promise<{ pull: Json; files: Json[]; reviews: Json[]; reviewComments: Json[]; comments: Json[] }> {
    const base = `${repoUrl(owner, repo)}`;
    const [pull, files, reviews, reviewComments, comments] = await Promise.all([
      this.get(`${base}/pulls/${number}`),
      this.get(`${base}/pulls/${number}/files?per_page=100`),
      this.get(`${base}/pulls/${number}/reviews?per_page=100`),
      this.get(`${base}/pulls/${number}/comments?per_page=100`),
      this.get(`${base}/issues/${number}/comments?per_page=100`),
    ]);

    return { pull, files, reviews, reviewComments, comments };
  }

  async issues(owner: string, repo: string, state: "open" | "closed" | "all", text: string | null): Promise<Json[]> {
    if (!text) {
      return (await this.get(`${repoUrl(owner, repo)}/issues?state=${state}&per_page=${PAGE}&sort=updated`)).filter((issue: Json) => !issue.pull_request);
    }

    const states = state === "all" ? "" : ` is:${state}`;
    const query = encodeURIComponent(`repo:${owner}/${repo} is:issue${states} ${text}`);

    return (await this.get(`${API}/search/issues?q=${query}&per_page=${PAGE}`)).items;
  }

  async issue(owner: string, repo: string, number: number): Promise<{ issue: Json; comments: Json[] }> {
    const [issue, comments] = await Promise.all([this.get(`${repoUrl(owner, repo)}/issues/${number}`), this.get(`${repoUrl(owner, repo)}/issues/${number}/comments?per_page=100`)]);

    return { issue, comments };
  }

  async checks(owner: string, repo: string, ref: string): Promise<{ runs: Json[]; status: Json }> {
    const encoded = encodeURIComponent(ref);
    const [runs, status] = await Promise.all([this.get(`${repoUrl(owner, repo)}/commits/${encoded}/check-runs?per_page=100`), this.get(`${repoUrl(owner, repo)}/commits/${encoded}/status`)]);

    return { runs: runs.check_runs ?? [], status };
  }

  createDraftPullRequest(owner: string, repo: string, pull: { title: string; body: string; head: string; base: string }): Promise<Json> {
    return this.send("POST", `${repoUrl(owner, repo)}/pulls`, { ...pull, draft: true });
  }

  private get(url: string): Promise<any> {
    return this.send("GET", url);
  }

  private async send(method: string, url: string, body?: Json): Promise<any> {
    const headers = { Authorization: `Bearer ${this.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "PowerLoom" };
    const response = await this.fetchFn(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });

    if (!response.ok) {
      const limited = response.headers.get("x-ratelimit-remaining") === "0";

      throw new GitHubApiError(response.status, `GitHub answered ${response.status} for ${method} ${new URL(url).pathname}: ${(await response.text()).slice(0, 300)}`, limited);
    }

    return response.json();
  }
}

function repoUrl(owner: string, repo: string): string {
  return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}
