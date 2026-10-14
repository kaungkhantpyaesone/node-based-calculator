# Project guidance

## Code style

- Write human-readable code with descriptive names, proper whitespace, and clear control flow. Follow the repository's TypeScript, ESLint, and Prettier conventions.
- Let the code explain itself. Add a short justification comment for unusual patterns or non-obvious decisions; avoid comments that merely repeat a statement.
- Break functions with multiple logical phases into sections separated by whitespace and a short comment describing each section. Keep trivial single-purpose functions free of unnecessary section comments.
- Keep things simple and follow YAGNI. Introduce abstractions when a concrete need warrants them, not for hypothetical future use. Use complexity when the problem requires it.
- Focus implementation on expected use cases and realistic failures. Ignore super niche edge cases unless the user explicitly requires them or they affect a core invariant.

## Commit messages

- Follow Conventional Commits and always include the feature name in parentheses after the type: `type(feature): description`, for example, `feat(jira): add issue creation` or `fix(jira): handle missing project keys`.
- Choose the type that describes the change, such as `feat`, `fix`, `docs`, `refactor`, `test`, or `chore`, and keep the description concise. For shared infrastructure or repository-wide changes, use the affected area as the scope.
- Mark breaking changes with `!` after the scope, such as `feat(jira)!: change issue configuration`, and describe the breaking change in a `BREAKING CHANGE:` footer.

## Worktrees

When the user requests a new worktree, create one and give it a new named branch, using the `codex/` prefix unless the user specifies otherwise. Do not leave it on a detached HEAD. Use the requested starting state when provided and make the branch easy to merge into the primary checkout. Verify the resulting worktree path and branch before editing files there.

## UI work

For renderer UI creation, updates, or reviews, read and follow [the project UI skill](.agents/skills/project-ui/SKILL.md) together with [the shadcn skill](.agents/skills/shadcn/SKILL.md). The project UI skill defines component reuse, the shared page layout, and page composition conventions.

Use the shared shadcn `ScrollArea` component for scrolling areas.

When planning a feature with unsaved edits, decide how they behave during navigation, tab moves, tab or window closure, and app restarts. Close prompts, autosave, and draft recovery are feature-specific decisions; add them only when that feature requires them.

## Verification

Run checks appropriate to the change: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` as needed. Format touched files with Prettier. Use meaningful tests for behavior changes; avoid tests that simply repeat implementation details. Test expected behavior and realistic failures, and skip super niche edge cases under the same criteria as implementation. Commit generated Drizzle migrations with schema changes.
