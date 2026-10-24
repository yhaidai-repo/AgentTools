// Every page with a grid re-renders from the server this often, so its rows follow the agents without a reload (user
// decision 2026-10-21: every grid, every 10 s).
export const GRID_REFRESH_MS = 10_000;
