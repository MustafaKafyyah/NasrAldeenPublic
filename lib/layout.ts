import { hierarchy, type HierarchyNode } from "d3-hierarchy";
import { family, person, type Person } from "./family";

export interface LaidOutNode {
  id: string;
  person: Person;
  /** distance from the reading edge, in columns (0 = the layout root) */
  depth: number;
  /** layout-space coordinates (px) BEFORE any RTL mirroring: x runs away from the reading edge */
  x: number;
  y: number;
  parentId: string | null;
  /** true when this node's children are folded away */
  collapsed: boolean;
  /** radial only */
  angle?: number;
  radius?: number;
  span?: number;
}

export interface LaidOutLink {
  id: string;
  source: LaidOutNode;
  target: LaidOutNode;
}

export interface Layout {
  nodes: LaidOutNode[];
  links: LaidOutLink[];
  byId: Map<string, LaidOutNode>;
  /** content extent of node centres */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** deepest column actually rendered */
  maxDepth: number;
}

function finish(nodes: LaidOutNode[], maxDepth: number): Layout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links: LaidOutLink[] = [];
  for (const n of nodes) {
    if (n.parentId) {
      const s = byId.get(n.parentId);
      if (s) links.push({ id: `${s.id}-${n.id}`, source: s, target: n });
    }
  }
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  return {
    nodes,
    links,
    byId,
    bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
    maxDepth,
  };
}

/* ------------------------------------------------------------------ */
/* التشجير — the scroll: generations are columns, the family runs down */
/* ------------------------------------------------------------------ */

export interface ScrollOptions {
  /** id of the person at the reading edge */
  rootId: string;
  /** ids whose children are folded away */
  collapsed?: ReadonlySet<string>;
  /** hide everything deeper than this many columns from the root (generation collapse) */
  depthLimit?: number;
  /** px between two generation columns */
  colPitch: number;
  /** px between two rows */
  rowPitch: number;
}

/**
 * Rows are assigned the way a copyist lays out a nasab chart: a father sits on
 * the row of his FIRST son, so the eldest line runs along the top of the sheet
 * and the ancestor is at the head of the scroll, not floating in its middle.
 * Every other child takes the next free row, and a sibling group of more than
 * one gets a half-row of air after it so cousin groups read apart.
 *
 * Only leaves consume rows, so the sheet is as short as the family allows.
 * Collapsed and depth-limited nodes are pruned first, so folding closes the
 * rows up rather than leaving a hole.
 */
export function scrollLayout(opts: ScrollOptions): Layout {
  const collapsed = opts.collapsed ?? new Set<string>();
  const limit = opts.depthLimit ?? Infinity;
  const GROUP_AIR = 0.4; // rows of air after a sibling group of 2+

  const root = hierarchy<Person>(person(opts.rootId), (p) =>
    collapsed.has(p.id) ? [] : p.children.map((c) => person(c)),
  );
  // depth pruning happens after building: the children accessor has no depth
  root.each((n) => {
    if (n.depth >= limit && n.children) n.children = undefined;
  });

  const row = new Map<HierarchyNode<Person>, number>();
  let cursor = 0;
  const place = (n: HierarchyNode<Person>) => {
    const kids = n.children ?? [];
    if (kids.length === 0) {
      row.set(n, cursor);
      cursor += 1;
      return;
    }
    kids.forEach(place);
    if (kids.length > 1) cursor += GROUP_AIR;
    row.set(n, row.get(kids[0])!);
  };
  place(root);

  let maxDepth = 0;
  const nodes: LaidOutNode[] = root.descendants().map((d) => {
    if (d.depth > maxDepth) maxDepth = d.depth;
    const hidden = d.data.children.length > 0 && !d.children;
    return {
      id: d.data.id,
      person: d.data,
      depth: d.depth,
      x: d.depth * opts.colPitch,
      y: row.get(d)! * opts.rowPitch,
      parentId: d.parent ? d.parent.data.id : null,
      collapsed: hidden,
    };
  });
  return finish(nodes, maxDepth);
}

/** Rows in the scroll, i.e. how tall it is in row units. */
export function scrollRows(layout: Layout, rowPitch: number): number {
  return Math.round((layout.bounds.maxY - layout.bounds.minY) / rowPitch) + 1;
}

/* ------------------------------------------------------------------ */
/* Radial fan — the whole family as one shape                          */
/* ------------------------------------------------------------------ */

export interface RadialOptions {
  rootId: string;
  /** radius of each generation ring, index 0 = the root (0). Scaled up if names do not fit. */
  ringRadii: number[];
  /** arc length (px) one node needs on its ring, by depth */
  arcFor: (depth: number) => number;
  /** angular gap (radians) left empty; 0 = full circle */
  gap?: number;
  /** rotate the layout (radians); 0 puts the first branch at 12 o'clock */
  rotate?: number;
  collapsed?: ReadonlySet<string>;
}

/**
 * Space-guaranteeing radial layout. Every node demands an arc on its ring; a
 * subtree demands the larger of its own arc and the sum of its children's.
 * Demands are computed bottom-up, angles handed out top-down in source order,
 * so sibling groups stay contiguous and no two names on a ring can overlap —
 * including a 2-person branch beside a 182-person one. If the family needs more
 * than the circle offers, every radius scales by the same factor so it fits.
 */
export function radialLayout(opts: RadialOptions): Layout {
  const collapsed = opts.collapsed ?? new Set<string>();
  const root = hierarchy<Person>(person(opts.rootId), (p) =>
    collapsed.has(p.id) ? [] : p.children.map((c) => person(c)),
  );
  const gap = opts.gap ?? 0;
  const available = Math.PI * 2 - gap;
  const radii = [...opts.ringRadii];

  const demand = new Map<HierarchyNode<Person>, number>();
  const computeDemand = (scale: number) => {
    demand.clear();
    root.eachAfter((n) => {
      const r = radii[Math.min(n.depth, radii.length - 1)] * scale;
      const own = n.depth === 0 ? 0 : opts.arcFor(n.depth) / r;
      const kids = (n.children ?? []).reduce((acc, c) => acc + (demand.get(c) ?? 0), 0);
      demand.set(n, Math.max(own, kids));
    });
    return demand.get(root) ?? 0;
  };

  let scale = 1;
  const need = computeDemand(1);
  if (need > available) {
    scale = need / available;
    computeDemand(scale);
  }
  const scaledRadii = radii.map((r) => r * scale);

  const rotate = (opts.rotate ?? 0) - Math.PI / 2 + gap / 2;
  const angle = new Map<HierarchyNode<Person>, { start: number; span: number }>();
  angle.set(root, { start: rotate, span: available });
  root.eachBefore((n) => {
    const slot = angle.get(n)!;
    const kids = n.children ?? [];
    if (!kids.length) return;
    const total = kids.reduce((acc, c) => acc + (demand.get(c) ?? 0), 0);
    const stretch = total > 0 ? slot.span / total : 0;
    let cursor = slot.start;
    for (const c of kids) {
      const s = (demand.get(c) ?? 0) * stretch;
      angle.set(c, { start: cursor, span: s });
      cursor += s;
    }
  });

  let maxDepth = 0;
  const nodes: LaidOutNode[] = root.descendants().map((d) => {
    if (d.depth > maxDepth) maxDepth = d.depth;
    const r = scaledRadii[Math.min(d.depth, scaledRadii.length - 1)];
    const slot = angle.get(d)!;
    const a = d.depth === 0 ? 0 : slot.start + slot.span / 2;
    return {
      id: d.data.id,
      person: d.data,
      depth: d.depth,
      x: d.depth === 0 ? 0 : Math.cos(a) * r,
      y: d.depth === 0 ? 0 : Math.sin(a) * r,
      angle: a,
      radius: r,
      span: slot.span,
      parentId: d.parent ? d.parent.data.id : null,
      collapsed: collapsed.has(d.data.id) && d.data.children.length > 0,
    };
  });
  return finish(nodes, maxDepth);
}

/** ids on the path from `id` up to `rootId` (inclusive of both), nearest first. */
export function pathToRoot(id: string, rootId: string): string[] {
  const out = [id];
  let cur = person(id);
  while (cur.fatherId && cur.id !== rootId) {
    out.push(cur.fatherId);
    cur = person(cur.fatherId);
  }
  return out;
}

export const FOUNDER_ID = family.root.id;
