// Normal report output goes to stdout; warnings and failures go to stderr
// so automation can separate results from diagnostics.
function line(prefix, message) {
  process.stdout.write(`${prefix} ${message}\n`);
}

function ok(message) {
  line("OK", message);
}

function warn(message) {
  process.stderr.write(`WARN ${message}\n`);
}

function fail(message) {
  process.stderr.write(`FAIL ${message}\n`);
}

function next(message) {
  line("NEXT", message);
}

function title(message) {
  process.stdout.write(`${message}\n`);
}

export { fail, next, ok, title, warn };
