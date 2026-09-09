// Minimal dependency-free XML parser covering the subset needed to read
// pom.xml / *.csproj / *.sln.props style manifests: elements, attributes,
// text content and CDATA. No DTD, namespace, or processing-instruction support.

function stripComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, "");
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseAttributes(attrString) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*'([^']*)'/g;
  let match = re.exec(attrString);
  while (match) {
    const key = match[1] ?? match[3];
    const value = match[2] ?? match[4];
    attrs[key] = decodeEntities(value);
    match = re.exec(attrString);
  }
  return attrs;
}

function parseXml(source) {
  const clean = stripComments(source).replace(/<\?[\s\S]*?\?>/g, "");
  const root = { name: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  let i = 0;
  const len = clean.length;

  while (i < len) {
    const ltIndex = clean.indexOf("<", i);
    if (ltIndex === -1) {
      break;
    }
    if (ltIndex > i) {
      const text = decodeEntities(clean.slice(i, ltIndex)).trim();
      if (text) {
        const parent = stack[stack.length - 1];
        parent.text += (parent.text ? " " : "") + text;
      }
    }

    if (clean.startsWith("<![CDATA[", ltIndex)) {
      const end = clean.indexOf("]]>", ltIndex);
      const cdataEnd = end === -1 ? len : end;
      const text = clean.slice(ltIndex + 9, cdataEnd);
      const parent = stack[stack.length - 1];
      parent.text += text;
      i = cdataEnd + 3;
      continue;
    }

    const gtIndex = clean.indexOf(">", ltIndex);
    if (gtIndex === -1) {
      break;
    }
    const tagContent = clean.slice(ltIndex + 1, gtIndex);
    i = gtIndex + 1;

    if (tagContent.startsWith("/")) {
      const closingName = tagContent.slice(1).trim();
      for (let s = stack.length - 1; s > 0; s -= 1) {
        if (stack[s].name === closingName) {
          stack.length = s;
          break;
        }
      }
      continue;
    }

    const selfClosing = tagContent.endsWith("/");
    const body = selfClosing ? tagContent.slice(0, -1) : tagContent;
    const nameMatch = /^([a-zA-Z_:][-a-zA-Z0-9_:.]*)/.exec(body.trim());
    if (!nameMatch) {
      continue;
    }
    const name = nameMatch[1];
    const attrString = body.trim().slice(name.length);
    const node = { name, attrs: parseAttributes(attrString), children: [], text: "" };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) {
      stack.push(node);
    }
  }

  return root.children[0] ?? root;
}

function findChild(node, name) {
  if (!node) return undefined;
  return node.children.find((child) => child.name === name);
}

function findChildren(node, name) {
  if (!node) return [];
  return node.children.filter((child) => child.name === name);
}

function childText(node, name) {
  const child = findChild(node, name);
  return child ? child.text.trim() : undefined;
}

export { parseXml, findChild, findChildren, childText };
