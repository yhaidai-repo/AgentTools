// A package feed's sign-in for a restore, matched by URL: a feed whose URL starts with one of the prefixes gets it,
// any other feed gets nothing.
export interface FeedCredential {
  urlPrefixes: string[];
  username: string;
  password: string;
}
