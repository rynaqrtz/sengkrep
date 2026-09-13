# Contributing

## Setup

```bash
git clone https://github.com/rynaqrtz/sengkrep.git
cd sengkrep
npm install
```

Node 22.5 or newer is required (that is the package's own floor now). CI runs the suite on Node 22 and 24.

## Checks before a pull request

```bash
npm test          # fixture test suite
npm run typecheck # tsc --noEmit, includes test/types/usage.ts
```

Both must pass. Coverage and benchmarks are optional but useful when a change touches the request path.

```bash
npm run coverage
npm run bench
```

## Style

- CommonJS, two space indentation, single quotes.
- No comments in `src/`. Code should read on its own. If a line needs an explanation, prefer a clearer name or a smaller function.
- Keep the dependency list at one package unless there is a strong reason. New runtime dependencies need a note in the pull request explaining why the code cannot do it itself.
- Types live in `index.d.ts`. If you add a public export, add its type and a line in `test/types/usage.ts`.
- Errors are classes with a stable `code` string. Do not throw bare strings.

## Tests

- Add a test file when the area is new. Otherwise extend the closest `test/NN-*.js`.
- Register new files in `test/run-all.js`.
- Tests must run offline. Fixtures belong in `test/server.js`.
- Security fixes need a test that fails before the fix.

## Pull requests

- One topic per pull request.
- Describe the problem, the fix and how you verified it.
- Include the exact commands you ran and their result.
- Update `README.md` when the public API changes, and `CHANGELOG.md` with a line under the next version.

## License

By contributing you agree that your work is released under the MIT license in [LICENSE](./LICENSE).
