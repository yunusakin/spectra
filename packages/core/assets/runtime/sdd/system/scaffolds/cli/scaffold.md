# CLI Scaffold

## Target Structure

Create this tree under `app/`:

```
app/
├── src/
│   ├── commands/        # One file per command/subcommand
│   ├── utils/           # Shared utilities, formatters
│   ├── config/          # Config loading (dotfiles, env)
│   └── main.*           # Entry point, arg parsing
├── tests/
│   └── unit/
├── .gitignore
├── README.md
└── package.json / go.mod / pyproject.toml / etc.
```

## Step-by-Step

1. Read intake answers from `sdd/memory-bank/tech/stack.md`.
2. Create the directory tree under `app/`.
3. Generate the entry point with a `--help` flag and one example command.
4. Generate `README.md` with installation and usage instructions.
5. Generate the dependency manifest with the CLI framework (if any).
6. Confirm the CLI runs and `--help` prints usage.

## Customization Notes

- **Node.js**: Use `commander` or `yargs`.
- **Python**: Use `click` or `argparse`.
- **Go**: Use `cobra` or `urfave/cli`.
