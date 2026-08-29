import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const CACHE_DIR = path.join(process.cwd(), ".cache");

type Packed<T> = {
  fetchedAt: number;
  data: T;
};

const memory = new Map<string, Packed<unknown>>();

export async function loadDayCache<T>(
  filename: string,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const mem = memory.get(filename) as Packed<T> | undefined;
  if (mem && now - mem.fetchedAt < DAY_MS) return mem.data;

  const file = path.join(CACHE_DIR, filename);
  let disk: Packed<T> | null = null;
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Packed<T>;
    if (parsed?.data != null && now - parsed.fetchedAt < DAY_MS) {
      memory.set(filename, parsed);
      return parsed.data;
    }
    disk = parsed;
  } catch {
    disk = null;
  }

  try {
    const data = await loader();
    const packed: Packed<T> = { fetchedAt: now, data };
    memory.set(filename, packed);
    try {
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(file, JSON.stringify(packed));
    } catch {
      // cache write is best-effort
    }
    return data;
  } catch (error) {
    if (mem?.data != null) return mem.data;
    if (disk?.data != null) {
      memory.set(filename, disk);
      return disk.data;
    }
    throw error;
  }
}

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "sleeper-draft-assistant" },
  });
  if (!res.ok) {
    throw new Error(`Fetch ${url} failed (${res.status})`);
  }
  return res.text();
}
