// One entry of the sandbox image catalog (sandbox-images.json): the name a vault picks, the Docker image it starts.
export interface SandboxImage {
  name: string;
  image: string;
  /** What the image holds, shown in Settings. */
  description: string;
}
