// An image a tool hands to the model beside its text (a screenshot): base64 bytes and their media type.
export interface ToolImage {
  data: string;
  mimeType: string;
}
