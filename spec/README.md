# Specs

Numbered specifications for the Temporal platform. Each spec captures the
requirements for a coherent slice of work as it is designed and implemented.

- Specs are numbered `spec-NN` in the order they are undertaken and are
  append-only: a shipped spec is not rewritten, later changes land as a new
  spec that supersedes or extends it.
- Each spec lives in `spec/spec-NN-<slug>/` with a `requirements.md`.
- Requirements are written as testable statements (`REQ-NN-x`) so they can be
  traced to code, tests, and CI.

| Spec                                                     | Title               | Status      |
| -------------------------------------------------------- | ------------------- | ----------- |
| [spec-00](./spec-00-platform-foundation/requirements.md) | Platform foundation | Implemented |
