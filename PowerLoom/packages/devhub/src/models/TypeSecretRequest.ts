// POST /browser/type-secret: DevHub types a dev-secrets value into the snapshot element `target` names.
export interface TypeSecretRequest {
  element: string;
  target: string;
  valueName: string;
  submit?: boolean;
}
