import path from "node:path";

function getProjectLayout(projectRoot) {
  const root = path.join(path.resolve(projectRoot), "spectra");
  return {
    root,
    bin: path.join(root, "bin"),
    cli: path.join(root, "cli"),
    docs: path.join(root, "docs"),
    sdd: path.join(root, "sdd"),
    config: path.join(root, "config.yaml"),
    installMetadata: path.join(root, "install.json"),
    launcher: path.join(root, "bin", "spectra")
  };
}

export { getProjectLayout };
