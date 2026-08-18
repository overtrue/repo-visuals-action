export const SCHEMA_VERSION = 1;

export type HistoryPoint = [day: string, count: number];

export interface StarHistory {
  schema: number;
  repository: string;
  points: HistoryPoint[];
}

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateRepository(repository: string): string {
  if (!REPOSITORY_PATTERN.test(repository)) {
    throw new Error("repository must use the owner/name format");
  }
  return repository;
}

export function dayNumber(day: string): number {
  if (!DAY_PATTERN.test(day)) {
    throw new Error(`invalid date in star history: ${JSON.stringify(day)}`);
  }
  const value = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== day) {
    throw new Error(`invalid date in star history: ${JSON.stringify(day)}`);
  }
  return Math.floor(value / 86_400_000);
}

export function dayFromNumber(value: number): string {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

export function readRepository(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const repository = (value as Record<string, unknown>).repository;
  return typeof repository === "string" ? repository : null;
}

export function validateHistory(value: unknown, repository: string): StarHistory {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid star history document");
  }

  const history = value as Record<string, unknown>;
  if (history.schema !== SCHEMA_VERSION) {
    throw new Error("unsupported star history schema");
  }
  if (history.repository !== repository) {
    throw new Error(`star history belongs to ${String(history.repository)}, not ${repository}`);
  }
  if (!Array.isArray(history.points) || history.points.length === 0) {
    throw new Error("star history must contain at least one point");
  }

  let previousDay: number | undefined;
  const points: HistoryPoint[] = history.points.map((point) => {
    if (!Array.isArray(point) || point.length !== 2) {
      throw new Error("invalid star history point");
    }
    const [day, count] = point;
    if (typeof day !== "string") {
      throw new Error("invalid date in star history");
    }
    const currentDay = dayNumber(day);
    if (previousDay !== undefined && currentDay <= previousDay) {
      throw new Error("star history dates must be strictly increasing");
    }
    if (!Number.isSafeInteger(count) || (count as number) < 0) {
      throw new Error("star counts must be non-negative safe integers");
    }
    previousDay = currentDay;
    return [day, count as number];
  });

  return { schema: SCHEMA_VERSION, repository, points };
}

export function aggregateStargazers(timestamps: string[]): HistoryPoint[] {
  const daily = new Map<string, number>();
  for (const timestamp of timestamps) {
    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed)) {
      throw new Error(`invalid starred_at timestamp: ${JSON.stringify(timestamp)}`);
    }
    const day = new Date(parsed).toISOString().slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + 1);
  }

  let total = 0;
  return [...daily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, count]) => {
      total += count;
      return [day, total];
    });
}

export function mergeSnapshot(history: StarHistory, day: string, count: number): StarHistory {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("star count must be a non-negative safe integer");
  }
  const snapshotDay = dayNumber(day);
  const lastPoint = history.points.at(-1);
  if (!lastPoint) {
    return { ...history, points: [[day, count]] };
  }

  const lastDay = dayNumber(lastPoint[0]);
  if (snapshotDay < lastDay) {
    throw new Error("snapshot date is older than the stored history");
  }

  const points = history.points.map((point) => [...point] as HistoryPoint);
  if (snapshotDay === lastDay) {
    points[points.length - 1] = [day, count];
  } else {
    points.push([day, count]);
  }
  return { ...history, points };
}
