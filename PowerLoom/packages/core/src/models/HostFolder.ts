// A folder of the user's PC as a container sees it: the PC path (`D:/Claude`) and where it is mounted (`/vaults`).
export interface HostFolder {
  hostRoot: string;
  mount: string;
}
