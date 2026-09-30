// Seeded to `_templates/pbi.md` when missing; after that the Vault file is the template and the user owns it.
export const DEFAULT_PBI_TEMPLATE = `# {{id}} {{title}}

| Field | Value |
|---|---|
| Azure DevOps | [{{ado_id}}]({{ado_url}}) |
| Type | {{ado_type}} |
| ADO state | {{ado_state}} |
| Sprint | {{iteration}} |
| Area | {{area}} |
| Assigned to | {{assigned_to}} |
| Priority | {{priority}} |
| Tags | {{tags}} |

## Description

{{description}}

## Acceptance criteria

{{acceptance_criteria}}

## Refinement

<!-- adoa:begin refinement -->
Pending.
<!-- adoa:end refinement -->

## Items

<!-- adoa:begin items -->
None yet.
<!-- adoa:end items -->

## Notes
`;
