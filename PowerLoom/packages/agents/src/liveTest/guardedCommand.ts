import type { Command, CommandContext, Outcome } from "@powerloom/core";
import type { LiveTestScope } from "./LiveTestScope";
import type { LiveTestRule } from "./models/LiveTestRule";

// The owner's rule for changing tools (2026-10-24): the description says what the call needs; here, that it works only
// on the run's own data. There is no user in a live test, so the descriptions' "ask the user" sentences don't apply.
const OWN_DATA_ONLY = "In this live test it works only on data this test run created, and everything the run created is removed when it ends.";

/** The command with the live-test guard: same name, input and effect; it refuses a target the run didn't create or a
 *  call its rule refuses, and keeps the scope up to date with what a successful call created or removed. */
export function guardedCommand<I, O>(command: Command<I, O>, rule: LiveTestRule, scope: LiveTestScope): Command<I, O> {
  return {
    ...command,
    description: [command.description, OWN_DATA_ONLY, rule.note].filter(Boolean).join(" "),
    run: (context, input) => runGuarded(command, rule, scope, context, input),
  };
}

async function runGuarded<I, O>(command: Command<I, O>, rule: LiveTestRule, scope: LiveTestScope, context: CommandContext, input: I): Promise<Outcome<O>> {
  const problem = rule.refusal?.(input) ?? (await scope.notOwnedProblem(rule.targets(input)));

  if (problem) {
    return { ok: false, error: `${command.name} refused: ${problem}` };
  }

  const outcome = await command.run(context, input);

  if (!outcome.ok) {
    return outcome;
  }

  scope.record(rule.created?.(outcome.value, input) ?? []);
  scope.forget(rule.removed?.(input) ?? []);

  const unsettled = (await rule.settle?.(context, input, outcome.value)) ?? null;

  return unsettled ? { ok: false, error: `${command.name} ran, but ${unsettled}` } : outcome;
}
