// Tiny, dependency-free XML reader for the Claude Docs "view" projection.
// Produces { tag, attrs, children: (node | string)[] } trees. Good enough for the doc's
// well-formed, attribute-only markup (no DTDs, no CDATA, no namespaces).

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e] ?? m;
  });

export function parseXml(src) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { pushText(src.slice(i)); break; }
    if (lt > i) pushText(src.slice(i, lt));
    if (src.startsWith("<?", lt)) { i = src.indexOf("?>", lt) + 2; continue; }
    if (src.startsWith("<!--", lt)) { i = src.indexOf("-->", lt) + 3; continue; }
    if (src.startsWith("<![CDATA[", lt)) {
      const end = src.indexOf("]]>", lt);
      const raw = src.slice(lt + 9, end);
      const kids = stack[stack.length - 1].children;
      if (typeof kids[kids.length - 1] === "string") kids[kids.length - 1] += raw; else kids.push(raw);
      i = end + 3; continue;
    }
    const gt = findTagEnd(src, lt);
    const raw = src.slice(lt + 1, gt);
    i = gt + 1;
    if (raw[0] === "/") {
      const tag = raw.slice(1).trim();
      const top = stack.pop();
      if (!top || top.tag !== tag) throw new Error(`XML: mismatched </${tag}> (open: ${top && top.tag})`);
      continue;
    }
    const selfClose = raw.endsWith("/");
    const body = selfClose ? raw.slice(0, -1) : raw;
    const m = body.match(/^([A-Za-z_][\w.-]*)/);
    if (!m) throw new Error("XML: bad tag " + raw.slice(0, 40));
    const attrs = {};
    const re = /([A-Za-z_][\w.:-]*)\s*=\s*('([^']*)'|"([^"]*)")/g;
    let a;
    while ((a = re.exec(body.slice(m[1].length)))) attrs[a[1]] = decode(a[3] ?? a[4] ?? "");
    const node = { tag: m[1], attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`XML: unclosed <${stack[stack.length - 1].tag}>`);
  return root.children.find((c) => typeof c !== "string");

  function pushText(t) {
    if (!t) return;
    const kids = stack[stack.length - 1].children;
    const s = decode(t);
    if (typeof kids[kids.length - 1] === "string") kids[kids.length - 1] += s;
    else kids.push(s);
  }
}

function findTagEnd(src, from) {
  let q = null;
  for (let j = from + 1; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === q) q = null; }
    else if (c === "'" || c === '"') q = c;
    else if (c === ">") return j;
  }
  throw new Error("XML: unterminated tag");
}

export const elements = (node) => node.children.filter((c) => typeof c !== "string");
export const itertext = (node) => (typeof node === "string" ? node : node.children.map(itertext).join(""));
export function* iter(node, tag) {
  if (typeof node === "string") return;
  if (node.tag === tag) yield node;
  for (const c of node.children) yield* iter(c, tag);
}
