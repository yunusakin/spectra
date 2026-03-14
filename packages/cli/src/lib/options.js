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

    const [flagName, inlineValue] = token.split("=", 2);

    if (booleanFlags.has(flagName)) {
      options[flagName] = inlineValue === undefined ? true : inlineValue !== "false";
      continue;
    }

    if (stringFlags.has(flagName)) {
      if (inlineValue !== undefined) {
        options[flagName] = inlineValue;
        continue;
      }

      options[flagName] = argv[index + 1];
      index += 1;
      continue;
    }

    positional.push(token);
  }

  return { options, positional };
}

export { parseOptions };
