// Shared option parser. Invalid CLI input fails clearly and early:
// unknown flags are rejected instead of silently becoming positionals,
// string flags must receive a value (inline or a following non-flag
// token), and boolean flags only accept true/false inline values.
function parseOptions(argv, config = {}) {
  const booleanFlags = new Set(config.booleanFlags ?? []);
  const stringFlags = new Set(config.stringFlags ?? []);
  const options = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const separator = token.indexOf("=");
    const flagName = separator === -1 ? token : token.slice(0, separator);
    const inlineValue = separator === -1 ? undefined : token.slice(separator + 1);

    if (booleanFlags.has(flagName)) {
      if (inlineValue === undefined || inlineValue === "true") {
        options[flagName] = true;
        continue;
      }
      if (inlineValue === "false") {
        options[flagName] = false;
        continue;
      }
      throw new Error(`Invalid value for ${flagName}: ${inlineValue} (accepted: true, false)`);
    }

    if (stringFlags.has(flagName)) {
      if (inlineValue !== undefined) {
        if (inlineValue === "") {
          throw new Error(`Option ${flagName} requires a value`);
        }
        options[flagName] = inlineValue;
        continue;
      }

      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Option ${flagName} requires a value`);
      }
      options[flagName] = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${flagName}`);
  }

  return { options, positional };
}

export { parseOptions };
