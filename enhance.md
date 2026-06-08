## Plan: Make the Discord Bot Easier and More User-Friendly

The current project already has a solid clean architecture: Discord commands in `src/discord`, business rules in `src/application` and `src/domain`, and Notion persistence in `src/infrastructure/notion`. The biggest opportunity is not a rewrite, but a UX redesign around Discord-native interactions so users type less, make fewer mistakes, and get more guidance at every step.

Recommended approach: keep Notion as the source of truth, keep the existing layered structure, and evolve the bot toward a guided Discord experience using autocomplete, buttons, modals, better confirmations, smarter reports, and lighter channel rules where safe.

**Steps**
1. Establish the UX target and command philosophy.
   - Keep the bot Discord-native instead of introducing a separate web app first.
   - Reduce the number of required typed fields by using autocomplete, defaults, and modals.
   - Prefer progressive disclosure: ask only for the minimum data needed, then let the bot guide the next step.
   - Keep write actions channel-safe, but make read-only actions easier to access.

2. Redesign the command surface around the most common workflows.
   - Consolidate or complement the current top-level commands into a simpler entry pattern, such as a small set of primary commands plus subcommands or a single menu-style command.
   - Make the most frequent actions faster: check-in, trade logging, goal creation, status updates, and stats viewing.
   - Add a `/help` or `/menu` entry point that explains what to do next and offers quick action buttons.
   - Allow read-only commands like stats and reports to work from more places if that does not create noise.

3. Replace long text entry with richer Discord interactions where it matters most.
   - Use modals for long-form inputs such as the trading plan, trade notes, and goal text.
   - Use autocomplete or selection lists for common values like goal category, pair, goal status, and potentially recent goal IDs.
   - Add buttons for common follow-up actions after a successful submission, such as “Update goal,” “Log another trade,” or “View my stats.”
   - Make confirmations more readable by returning short summaries instead of plain one-line acknowledgements.

4. Add validation and guardrails before writing to Notion.
   - Validate trade logic more strictly so invalid long/short setups are rejected early.
   - Keep the existing scale checks, but expand them to cover date formats, deadline sanity, and screenshot URL format where useful.
   - Turn the current opaque goal ID flow into a guided experience with active goal lookup or autocomplete.
   - Give users helpful error messages that explain how to fix the input, not just what failed.

5. Improve situational awareness and context during logging.
   - When a user logs a trade, show the current daily check-in context if one exists, so the trade is logged with the day’s plan in mind.
   - After a check-in, surface a short readiness summary instead of a flat success message.
   - Make discipline submissions explain the score breakdown so users understand what affected their rating.
   - Show recent activity and streak context in stats and leaderboard views to make progress feel concrete.

6. Add lightweight automation so the bot becomes proactive, not just reactive.
   - Add reminders when users miss a daily check-in or have not logged activity by a target time.
   - Add scheduled nudges or digest messages that summarize what still needs attention today.
   - Extend the scheduler carefully so only one bot instance sends reports and reminders.
   - Keep reminders respectful and configurable so they help rather than annoy.

7. Make reports more actionable and easier to scan.
   - Improve weekly and monthly summaries with clearer formatting, highlights, and deltas.
   - Add streaks, recent trends, and category breakdowns where the underlying data supports it.
   - Make leaderboard output easier to understand by showing the score formula or component breakdowns in a concise way.
   - Store richer report history in Notion so users can review past performance without leaving Discord.

8. Reduce friction in channel handling and onboarding.
   - Turn the current channel guard into a helpful guide that tells users where to go next instead of only blocking them.
   - Consider allowing some commands outside their strict channels if they are low-risk and do not create channel clutter.
   - Improve onboarding so the bot can explain required setup, missing configuration, and first-time usage more clearly.
   - Make startup/config errors concise and actionable for both local development and hosting.

9. Expand the data model only where it directly supports better UX.
   - Add any missing Notion properties only when they unlock a clear user-facing improvement, such as goal lookup, streaks, or reminder tracking.
   - Keep the current schema stable for the first round of UX improvements so the bot remains reliable.
   - If a future web dashboard becomes desirable, treat it as a separate phase after the Discord experience is polished.

10. Validate the improved flow end to end.
   - Test each revised command path from Discord interaction to Notion persistence and back to the confirmation message.
   - Verify that autocomplete, modals, buttons, and channel guidance behave correctly for both success and failure cases.
   - Confirm that scheduled jobs still run once and produce the expected daily, weekly, and monthly outputs.
   - Check that the bot remains easy to set up with the existing environment variables and bootstrap scripts.

**Relevant files**
- `src/discord/commandDefinitions.ts` — reshape commands, add autocomplete, and simplify the entry surface.
- `src/discord/interactionHandler.ts` — route new interaction patterns, add modals/buttons, and improve replies.
- `src/discord/channelGuard.ts` — make channel guidance more helpful and flexible.
- `src/application/accountabilityService.ts` — add validation and keep business rules near the use cases.
- `src/domain/metrics.ts` — add stronger trade validation and any new scoring or streak calculations.
- `src/domain/types.ts` — extend inputs and stats only when needed for new UX behavior.
- `src/infrastructure/notion/repositories.ts` — add lookup helpers for active goals, recent check-ins, streak inputs, or reminder tracking.
- `src/application/reportService.ts` — improve report formatting and make summaries more actionable.
- `src/jobs/scheduler.ts` — add reminders and keep report automation reliable.
- `src/discord/bot.ts` — support richer message delivery if confirmations or summaries need embeds or interactive replies.
- `src/config/env.ts` — add configuration only if new reminders or UX features need it.
- `docs/notion-schema.md` — document any schema changes needed to support the new interaction model.

**Verification**
1. Run the TypeScript build to catch interface and type changes early.
2. Re-register Discord commands after any command surface change and verify the command list in the guild.
3. Exercise the main user flows manually in Discord: check-in, trade logging, goal creation, goal status updates, discipline logging, stats, and leaderboard.
4. Confirm that error cases produce clear ephemeral guidance, especially wrong-channel usage and invalid trade inputs.
5. Verify scheduled reports still publish correctly and that no duplicate scheduler behavior appears when the bot restarts.

**Decisions**
- Keep Notion as the backend and Discord as the primary interface.
- Prefer additive UX improvements before schema or command breaking changes.
- Optimize for a small number of highly guided commands instead of many manual fields.
- Treat a separate web dashboard as a later option, not the first solution.
- Keep the current clean layering; the main changes should live in Discord interaction flow and application validation.

**Further Considerations**
1. If you want the fastest user experience improvement, prioritize autocomplete, modals, and better confirmations first.
2. If you want the easiest long-term workflow, consider consolidating commands into a smaller menu-driven command set after the guided flows are in place.
3. If you want the strongest retention and habit-building, add reminders, streaks, and short daily digest messages next.