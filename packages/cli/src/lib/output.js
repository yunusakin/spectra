function line(prefix, message) {
  process.stdout.write(`${prefix} ${message}\n`);
}

function ok(message) {
  line("OK", message);
}

function warn(message) {
  line("WARN", message);
}

function fail(message) {
  line("FAIL", message);
}

function next(message) {
  line("NEXT", message);
}

function title(message) {
  process.stdout.write(`${message}\n`);
}

export { fail, next, ok, title, warn };
