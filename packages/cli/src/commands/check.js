import { validateCommand } from "./validate.js";

function checkCommand(argv) {
  return validateCommand(argv);
}

export { checkCommand };
