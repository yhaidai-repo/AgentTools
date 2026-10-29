# Support guide agent

Support guide turns a feature task into a reader-facing guide and a portable Confluence publication package. It uses the generic executor and a dedicated RunWriter; Autotest keeps its own tasks and reporting.

## Start a task
1. Deploy the database migration, PowerLoom runner/web, and updated DevHub host/scripts together.
2. In Agents → Support guide, review model, budget, grants and environment rules. The shipped agent is disabled, with no schedule; model/limits/budgets begin with the shipped Autotest defaults.
3. Create a support-guide task. Supply feature/PBI or repositories, description, done-when, audience, owner, approved data/actions, and runtime inputs.
4. Existing URL mode uses the DevHub-hosted browser without starting a local stack. Include application and sign-in origins. Local mode requires branch, services and entry URL.
5. Add a Confluence create destination (site/space/title/parent) or update destination (site/space/title/page/base version/owned sections), or decide later.
6. Enable the agent when ready and use Run now for the task. Agent-scoped research/refinement handoffs need a PBI; a no-PBI task may hand missing inputs to a person.
7. On the result page, inspect guide and screenshots, download the ZIP, and give the included publication task/archive to an authorized Confluence agent or chat.

Chats/API tasks use the same description envelope: a fenced support-guide JSON block matching packages/core/src/supportGuides/request.ts. The task form writes it; callers should not invent values.

## Output
- guide.md, sanitized images/, manifest.json, verification.md and publish-task.md.
- Guide status: partial, blocked, ready. Publication begins awaiting-details or pending.
- The authoring agent has Confluence read access only. It does not upload attachments or publish pages.
- Pending means an external publisher still owns the write. A closed handoff never automatically declares the page published.
- Package download returns X-Archive-SHA256. The manifest defines the deterministic content checksum and its exact file scope.
- Update handoffs include the expected base version; publishers reconcile concurrent page changes and reuse page/attachment identity on retries.
- The package is portable: download and attach it to the publishing chat. Relative app links alone are not a cross-machine transfer mechanism.

## Evidence and screenshots
- Runtime evidence retains tool identity and output separately from the model's input; restored sources are not fresh observations.
- Strict identity checks apply to guide runs; existing stack callers retain their branch fallback and startup behavior.
- Local mode requires the requested branch in every selected repository; it refuses the legacy fallback to a different checkout. Only selected repositories are fingerprinted.
- Local identity is captured from actual stack roots before build, with resolved commits and source-change fingerprints; cache commits are separate evidence.
- A local SkipBuild run has no verified build fingerprint and cannot produce a ready guide.
- Unknown remote deployment identity stays explicit; it cannot justify a release-specific claim.
- A new image import invalidates a previously ready report; final commit rechecks its evidence/image consistency.
- Checkpoint text and approved image bytes survive timeout/restart. V1 deliberately reobserves workflows and recaptures screenshots in a new run before ready.
- Images are PNG, at most 2 MB each / 20 files / 16 MB per checkpoint. Only inspected clean demonstration screenshots are imported.
- Solid redaction/arrow editing is not implemented in v1. Recapture a clean screen or keep affected instructions blocked.
- Markdown image destinations, including reference images, must resolve to the package allowlist. Preview/download access is scoped to the selected vault and task.
- Guide assets stay in PostgreSQL history independently of DevHub's recording cleanup, with no automatic expiry. Task deletion is soft; explicit history disposal must account for preserved packages.

## Instruction ownership
PowerLoom maintainers own packages/agents/prompts/support-guide.md and skills/powerloom-support-guide/. The agent explicitly loads the skill; guideline.md and page-template.md are the canonical authoring resources. Edit these repository sources, then deploy. Settings prompt overrides are preserved until reset; deployment does not rewrite existing packages. Vault AGENTS/POWERLOOM instruction templates are unaffected.

## Verification
Focused tests cover runtime inputs, host/path boundaries, Markdown image references, source provenance, stale screenshots, build identity, ZIP paths/checksums and publication handoffs.
writer.integration.test.ts exercises real PostgreSQL persistence when GUIDE_TEST_DATABASE_URL points at an explicitly disposable migrated database. It is skipped otherwise.
Host image tests and database migration/custom-routing tests use the .NET test suite's disposable PostgreSQL fixture.
