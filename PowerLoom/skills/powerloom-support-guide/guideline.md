# Support guide authoring guideline

## Purpose and audience
Help a support specialist or administrator complete one real task and recognize its result. State who the guide is for. Split independent workflows into separate procedures or linked pages.

## Required page structure
| Section | Include |
|---|---|
| Title | A searchable task or feature name; use "Support Guide" where useful. |
| Overview | What the reader can accomplish, when to use it, the resulting change. |
| Before you begin | Role/permissions, enabled features, required records or files, starting state, external access. |
| Procedure | Numbered actions from a known entry point through the saved or completed result. |
| Rules and alternate outcomes | Required fields, formats, disabled controls, validation, warnings, conflicts, cancel behavior relevant to the task. |
| Confirm completion | The visible status or persisted record proving success; any next required action. |
| Troubleshooting | Symptom/message → meaning → corrective action or escalation. |
| Related guides | Existing setup or follow-up instructions; link, don't copy. |
| Maintenance | Responsible owner, applicable release/build, last UI verification date. |

Omit inapplicable optional detail; never fill gaps with invented behavior.

## Writing procedures
- Use direct verbs ("Select", "Enter", "Upload", "Save"). Bold exact visible UI labels.
- Name the starting page and menu path. For another application or browser tab, name the destination and the return point.
- One action, or one tightly connected group, per step. Split actions that lead to different screens or decisions.
- After an action that saves, validates, navigates, imports or changes state, state the expected visible result.
- Explain field purpose and accepted values where users choose them; use a small field table for a complex form. Mark required fields in text. Give safe example values with units; never assume a date range's meaning from its label.
- Put prerequisites and consequences before the action they affect. Describe cancel/discard behavior when changes are at risk.
- For each branch say what the user sees, whether work is blocked, and what to do next. Colour is supplementary to text.
- Describe errors exactly when verified, then give recovery. Never present a suspected cause as fact.
- Keep architecture, API property names, deployment details and developer evidence in linked technical material unless the reader needs them to act.
- Prefer durable wording over "new" or "now". Use consistent terminology and correct spelling in titles.

## Screenshot standard
- Capture the real local or remote UI for the documented build, role, language and workflow. Record an unavailable remote deployment identity explicitly; a URL alone does not prove release-specific verification. No generated or reconstructed screens.
- Capture the entry point, important forms/choices, material warnings and the successful final state; not every trivial click.
- Place each image directly after the step or rule it explains, with a descriptive caption and alt text.
- Use a consistent viewport/zoom; keep labels readable at normal page width. Crop a dialog when full-screen detail gets too small; avoid long full-page images for a small target. Keep enough context to identify the page, dialog and selected record.
- Add a rectangle, arrow or numbered callout only when it clarifies the target; match numbers to the text; never cover labels or warnings.
- Use synthetic or approved demonstration records. Remove credentials, OTPs, setup QR codes, patient data and private identifiers before an image enters the publishable package.
- Secret substitution in tool text does not protect an image: inspect the actual image. Mask with solid redaction, not blur.
- Originals stay restricted evidence; publish sanitized images only. Use stable descriptive names, e.g. `03-rule-form.png`.
- Store final images with the page package; never rely on expiring run links or host file paths. Package layout: [[powerloom-support-guide-agent-design]].

## Ready for publication
- A reader with the stated role can follow the steps without developer help.
- Every important user-visible behavior has evidence for the specified build; unsupported sections stay blocked in the authoring report.
- Navigation, labels, numbering, captions, image readability and all links are checked.
- Completion is demonstrated; relevant validation/error paths explain recovery.
- No unresolved placeholders, secrets, sensitive records, developer logs or unsupported promises remain in the reader-facing page.
- Page owner and release applicability are supplied. Existing guides are updated or linked to avoid duplication.
- The publisher receives page, images, target location and a precise create/update task; publication is tracked separately from guide readiness (`guideStatus` vs `publicationStatus` in the design note).
