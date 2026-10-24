// An Atlassian account's email and API token (id.atlassian.com → Security → API tokens): the client sees what the account sees.
export interface ConfluenceCredentials {
  email: string;
  apiToken: string;
}
