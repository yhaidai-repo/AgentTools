// How a host asks for subscription usage.
export interface SubscriptionQuery {
  /**
   * The adapter may send one minimal paid request when it has no free way to read the numbers (it then uses a small
   * part of the subscription itself). Off by default; meant for a person's explicit refresh.
   */
  probe?: boolean;
}
