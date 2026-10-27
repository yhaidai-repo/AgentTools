export class IncompleteAccountingError extends Error {
  constructor() {
    super("Usage accounting is incomplete for this budget period; spending cannot be verified.");
    this.name = "IncompleteAccountingError";
  }
}
