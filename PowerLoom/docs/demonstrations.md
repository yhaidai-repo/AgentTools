# Demonstration agent

Demonstration turns a feature task into a reader-facing guide and a portable Confluence publication package. It uses the generic executor and a dedicated RunWriter; Autotest keeps its own tasks and reporting.

## Start a task
1. Deploy the database migration, PowerLoom runner/web, and updated DevHub host/scripts together.
2. In Agents → Demonstration, review model, budget, grants and environment rules. The shipped agent is disabled, with no schedule; model/limits/budgets begin with the shipped Autotest defaults.
3. Create a Demonstration task. Supply feature/PBI or repositories, description, done-when, audience, owner, approved data/actions, and runtime inputs.
4. Existing URL mode uses the DevHub-hosted browser without starting a local stack. Include application and sign-in origins. Local mode requires branch, services and entry URL.
5. Add a Confluence create destination (site/space/title/parent) or update destination (site/space/title/page/base version/owned sections), or decide later.
6. Enable the agent when ready and use Run now for the task. Agent-scoped research/refinement handoffs need a PBI; a no-PBI task may hand missing inputs to a person.
7. On the result page, inspect guide and screenshots, download the ZIP, and give the included publication task/archive to an authorized Confluence agent or chat.

The agent and task id is `demonstration`, the same as its displayed name, **Demonstration**. Chats/API tasks use the same description envelope: a fenced demonstration JSON block matching packages/core/src/demonstrations/request.ts. The task form writes it; callers should not invent values.

## Output
- guide.md, sanitized images/, manifest.json, verification.md and publish-task.md.
- Guide status: partial, blocked, ready. Publication begins awaiting-details or pending.
- Publication is tracked outside PowerLoom in v1: pending means the handoff is ready; nothing records the published page or a failure.
- The authoring agent has Confluence read access only. It does not upload attachments or publish pages.
- Pending means an external publisher still owns the write. A closed handoff never automatically declares the page published.
- Package download returns X-Archive-SHA256. The manifest states the content checksum, its algorithm (ordinal path order) and its exact file scope.
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
- Capture boundary (`GuideCapture`): every browser_take_screenshot is masked solid (password inputs plus the task's mask selectors, located with browser_evaluate) before the agent sees it; if the masks cannot be located the screenshot is refused. Raw captures stay in the DevHub case folder under recording retention. Element screenshots are refused; crop afterwards.
- add_guide_image re-reads the capture (refused if its bytes changed), re-applies the masks, then the agent's regions (solid = removal, blur = coarse mosaic, not removal) and crop, and stores a flattened PNG without metadata. With regions or crop the derivative needs approve_guide_image after viewing it; new bytes need a new approval and make a ready guide partial.
- GIFs: start_guide_gif / stop_guide_gif / add_guide_gif. A masked frame is captured before each recorded action (at most 12) and at the end; frames get per-frame regions, scaling, a drawn pointer (interpolated between targets, marked in the timeline), click rings and pauses, then are encoded as full frames (no disposal leftovers). Secret typing is recorded as a hidden step. Nothing is replayed.
- Media: PNG up to 4 MB, GIF up to 8 MB, 20 files and 32 MB per package. A ready guide needs at least one static screenshot and every referenced item approved.
- Limits: masks cover the top document only (not iframes); the accessibility snapshot text is not masked; frames show states, not in-between animation.
- Markdown image destinations, including reference images, must resolve to the package allowlist. Preview/download access is scoped to the selected vault and task.
- Guide assets stay in PostgreSQL history independently of DevHub's recording cleanup, with no automatic expiry. Task deletion is soft; explicit history disposal must account for preserved packages.

## Instruction ownership
PowerLoom maintainers own packages/agents/prompts/demonstration.md and skills/powerloom-demonstration/. The agent explicitly loads the skill; guideline.md and page-template.md are the canonical authoring resources. Edit these repository sources, then deploy. UI edits run until deployment ships a changed prompt or skill, which replaces the edit and keeps it in history. Existing packages keep their content. Vault AGENTS/POWERLOOM instruction templates are unaffected.

## Upgrading an existing installation
- Runner/MCP startup moves the previous agent identity, task/result kinds, grants, schedules, tool offers and reporting labels in one PostgreSQL transaction under an advisory lock, before filling defaults. User settings travel with the agent.
- Task and schedule input fences follow the rename. Matching saved checkpoints keep their media/report; changed inputs still invalidate them. Run-event payloads and free-text history keep their original words.
- Conflicting agent ids, tool-offer keys or integration values stop the rename and roll it back; resolve the conflicting configuration before restarting. No agent definition is discarded.
- API startup installs the replacement shipped skill before removing the previous own folder. Edited text and existing skill revisions remain in the replacement skill's history. Without a shipped replacement, the previous skill stays.
- Both startup paths are idempotent. No table, column or constraint is renamed.

## Verification
Focused tests cover runtime inputs, host/path boundaries, Markdown image references, source provenance, stale screenshots, build identity, ZIP paths/checksums and publication handoffs.
writer.integration.test.ts exercises real PostgreSQL persistence when GUIDE_TEST_DATABASE_URL points at an explicitly disposable migrated database. It is skipped otherwise.
Host image tests and database migration/custom-routing tests use the .NET test suite's disposable PostgreSQL fixture.
The startup rename tests cover settings, collision handling, schedules, checkpoint fingerprints, history and a second unchanged pass. DEMONSTRATION_RENAME_TEST_DATABASE_URL enables the PostgreSQL test against an empty disposable database; its fixture and all changes roll back.
