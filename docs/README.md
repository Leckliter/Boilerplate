# Developer docs

Start with [architecture.md](architecture.md), [actions.md](actions.md) and
[ai-workflow.md](ai-workflow.md). Read the doc for the area you're changing before you change it.

| Doc                                            | What's in it                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [BUILD_PLAN.md](BUILD_PLAN.md)                 | The contract the boilerplate was built to                                                   |
| [architecture.md](architecture.md)             | How the app, packages, database and modules fit together; auth; deletable modules           |
| [actions.md](actions.md)                       | The action system, `ActionForm` / `useAction`, rate limits, idempotency                     |
| [actions.generated.md](actions.generated.md)   | Every action, permission and input schema (generated)                                       |
| [ai-workflow.md](ai-workflow.md)               | How AI builds here: rule checks, hooks, skills, review                                      |
| [logging.md](logging.md)                       | The activity log and field-level change history                                             |
| [errors.md](errors.md)                         | Error references, diagnosis, fixing errors with an AI agent                                 |
| [choosing-a-backend.md](choosing-a-backend.md) | Neon vs Supabase: what differs, exact provider setup, how to remove one                     |
| [design-system.md](design-system.md)           | Tokens, brand-by-one-token, dark mode, the 13 UI rules, components                          |
| [testing.md](testing.md)                       | Real-Postgres tests, the "works + refused" rule, web unit tests, Playwright e2e             |
| [deploy.md](deploy.md)                         | Vercel, Docker, env vars, preview databases, migrations on deploy, cron, releases, rollback |
| [decisions.md](decisions.md)                   | Why things are the way they are                                                             |

The root files: [AGENTS.md](../AGENTS.md) (rules), [README.md](../README.md), [TODO.md](../TODO.md).
