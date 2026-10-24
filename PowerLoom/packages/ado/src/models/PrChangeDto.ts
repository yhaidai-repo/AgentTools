export interface PrChangeDto {
  changeType?: string;
  originalPath?: string;
  item?: { path?: string; isFolder?: boolean };
}
