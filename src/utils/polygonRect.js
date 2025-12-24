const EPS = 1e-9;

const nearlyEqual = (a, b) => Math.abs(a - b) <= EPS;

const pointInRect = (p, r) =>
  p.x >= r.x - EPS &&
  p.x <= r.x + r.width + EPS &&
  p.y >= r.y - EPS &&
  p.y <= r.y + r.height + EPS;

const cross = (a, b, c) => {
  // Cross product of AB x AC
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
};

const onSegment = (a, b, p) => {
  return (
    Math.min(a.x, b.x) - EPS <= p.x &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    Math.min(a.y, b.y) - EPS <= p.y &&
    p.y <= Math.max(a.y, b.y) + EPS &&
    nearlyEqual(cross(a, b, p), 0)
  );
};

const segmentsIntersect = (p1, p2, q1, q2) => {
  const d1 = cross(p1, p2, q1);
  const d2 = cross(p1, p2, q2);
  const d3 = cross(q1, q2, p1);
  const d4 = cross(q1, q2, p2);

  // Proper intersection
  if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
      ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) {
    return true;
  }

  // Collinear / touching cases
  if (Math.abs(d1) <= EPS && onSegment(p1, p2, q1)) return true;
  if (Math.abs(d2) <= EPS && onSegment(p1, p2, q2)) return true;
  if (Math.abs(d3) <= EPS && onSegment(q1, q2, p1)) return true;
  if (Math.abs(d4) <= EPS && onSegment(q1, q2, p2)) return true;

  return false;
};

const pointInPolygon = (point, polygon) => {
  // Ray casting (includes boundary as inside)
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];

    // Boundary check
    if (onSegment(a, b, point)) return true;

    const intersect =
      (a.y > point.y) !== (b.y > point.y) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + 0.0) + a.x;

    if (intersect) inside = !inside;
  }
  return inside;
};

export const polygonIntersectsRect = (polygon, rect) => {
  if (!polygon || polygon.length < 3) return false;

  const rectCorners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  // 1) Any polygon point inside rect => overlap
  for (const p of polygon) {
    if (pointInRect(p, rect)) return true;
  }

  // 2) Any rect corner inside polygon => overlap
  for (const c of rectCorners) {
    if (pointInPolygon(c, polygon)) return true;
  }

  // 3) Any edge intersection => overlap
  const rectEdges = [
    [rectCorners[0], rectCorners[1]],
    [rectCorners[1], rectCorners[2]],
    [rectCorners[2], rectCorners[3]],
    [rectCorners[3], rectCorners[0]],
  ];

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    for (const [r1, r2] of rectEdges) {
      if (segmentsIntersect(a, b, r1, r2)) return true;
    }
  }

  return false;
};
