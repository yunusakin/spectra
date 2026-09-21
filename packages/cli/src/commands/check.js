import { validateCommand } from "./validate.js";

function checkCommand(argv) {
  return validateCommand(argv, { commandName: "check" });
}

export { checkCommand };
