import { person, type Person } from "./family";

/**
 * A top-down chart of family blocks, laid out the way a good house chart is
 * drawn by hand: every father owns a rectangle, his children sit in a row
 * beneath him, and sons who founded lines of their own get a rectangle of
 * their own under that. Nothing from one family ever slides under another —
 * a deliberately non-tidy tree, because a family that reads as a block is
 * worth more than a few hundred pixels of packing.
 *
 * Children with no issue are STACKED in one column ("a leaf stack") instead
 * of each taking a column, which is what keeps 291 people from becoming a
 * 35,000-pixel wall.
 */

export interface CardNode {
  kind: "card";
  id: string;
  person: Person;
  depth: number;
  /** centre x, top y */
  x: number;
  y: number;
  w: number;
  h: number;
  /** children are hidden (folded by the reader or beyond the depth limit) */
  folded: boolean;
  parentId: string | null;
}

export interface StackNode {
  kind: "stack";
  /** id of the father whose issue-less children these are */
  id: string;
  parentId: string;
  members: Person[];
  depth: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type HouseNode = CardNode | StackNode;

export interface FamilyBlock {
  /** the father */
  id: string;
  x0: number;
  y0: number;
  w: number;
  h: number;
}

export interface HouseLayout {
  nodes: HouseNode[];
  cards: Map<string, CardNode>;
  /** where each person sits, card or stack row — for lighting and scrolling */
  positions: Map<string, { x: number; y: number; node: HouseNode; row: number }>;
  blocks: FamilyBlock[];
  width: number;
  height: number;
  maxDepth: number;
}

export interface HouseOptions {
  rootId: string;
  /** fathers whose children are shown; everyone else with issue is folded */
  expanded: ReadonlySet<string>;
  cardW: number;
  cardH: number;
  /** gap between sibling columns */
  gapX: number;
  /** vertical pitch from one generation's card top to the next */
  pitchY: number;
  /** row height inside a leaf stack */
  stackRowH: number;
  /** stack padding top/bottom */
  stackPad: number;
  /** leaf siblings fewer than this stay as cards */
  stackFrom: number;
}

interface Built {
  node: HouseNode;
  children: Built[];
  /** total width of this subtree */
  width: number;
  /** total height of this subtree from its own top */
  height: number;
}

export function houseLayout(opts: HouseOptions): HouseLayout {
  const build = (p: Person, depth: number, parentId: string | null): Built => {
    const open = p.children.length > 0 && opts.expanded.has(p.id);
    const card: CardNode = {
      kind: "card",
      id: p.id,
      person: p,
      depth,
      x: 0,
      y: 0,
      w: opts.cardW,
      h: opts.cardH,
      folded: p.children.length > 0 && !open,
      parentId,
    };
    if (!open) return { node: card, children: [], width: opts.cardW, height: opts.cardH };

    const kids = p.children.map((c) => person(c));
    const leaves = kids.filter((k) => k.children.length === 0);
    const stackLeaves = leaves.length >= opts.stackFrom;
    const children: Built[] = [];
    for (const k of kids) {
      if (stackLeaves && k.children.length === 0) continue;
      children.push(build(k, depth + 1, p.id));
    }
    if (stackLeaves) {
      const h = opts.stackPad * 2 + leaves.length * opts.stackRowH;
      const stack: StackNode = {
        kind: "stack",
        id: `stack-${p.id}`,
        parentId: p.id,
        members: leaves,
        depth: depth + 1,
        x: 0,
        y: 0,
        w: opts.cardW,
        h,
      };
      children.push({ node: stack, children: [], width: opts.cardW, height: h });
    }
    const width = Math.max(opts.cardW, children.reduce((a, c) => a + c.width, 0) + opts.gapX * (children.length - 1));
    const height = opts.pitchY + Math.max(...children.map((c) => c.height));
    return { node: card, children, width, height };
  };

  const root = build(person(opts.rootId), 0, null);

  const nodes: HouseNode[] = [];
  const blocks: FamilyBlock[] = [];
  let maxDepth = 0;
  const place = (b: Built, x0: number, y: number) => {
    b.node.x = x0 + b.width / 2;
    b.node.y = y;
    if (b.node.depth > maxDepth) maxDepth = b.node.depth;
    nodes.push(b.node);
    if (b.children.length) {
      // centre the children row under the father
      const rowW = b.children.reduce((a, c) => a + c.width, 0) + opts.gapX * (b.children.length - 1);
      let cx = x0 + (b.width - rowW) / 2;
      let bottom = y;
      for (const c of b.children) {
        place(c, cx, y + opts.pitchY);
        bottom = Math.max(bottom, y + opts.pitchY + c.node.h);
        cx += c.width + opts.gapX;
      }
      blocks.push({ id: b.node.id, x0: x0 + (b.width - rowW) / 2 - opts.gapX / 2, y0: y, w: rowW + opts.gapX, h: bottom - y });
    }
  };
  place(root, 0, 0);

  const cards = new Map<string, CardNode>();
  const positions = new Map<string, { x: number; y: number; node: HouseNode; row: number }>();
  for (const n of nodes) {
    if (n.kind === "card") {
      cards.set(n.id, n);
      positions.set(n.id, { x: n.x, y: n.y, node: n, row: 0 });
    } else {
      n.members.forEach((m, i) => {
        positions.set(m.id, { x: n.x, y: n.y + opts.stackPad + i * opts.stackRowH, node: n, row: i });
      });
    }
  }
  return { nodes, cards, positions, blocks, width: root.width, height: root.height, maxDepth };
}
