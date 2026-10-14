import fs from "node:fs";
import path from "node:path";

export class StoragePathError extends Error {
  constructor() {
    super("Invalid application media path");
    this.name = "StoragePathError";
  }
}

function contains(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!path.isAbsolute(relative) &&
    relative !== ".." && !relative.startsWith(".." + path.sep));
}

function checkSyntax(value: string) {
  if (typeof value !== "string" || !value || /[\x00-\x1f'\\]/.test(value) ||
      /%[0-9a-f]{2}/i.test(value) || value.split(/[\/\\]/).includes("..")) {
    throw new StoragePathError();
  }
}

function canonical(value: string): string {
  try {
    return fs.realpathSync(value);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new StoragePathError();
    try {
      if (fs.lstatSync(value).isSymbolicLink()) throw new StoragePathError();
    } catch (statError) {
      if (statError instanceof StoragePathError) throw statError;
      if ((statError as NodeJS.ErrnoException).code !== "ENOENT") throw new StoragePathError();
    }
    const parent = path.dirname(value);
    if (parent === value) throw new StoragePathError();
    return path.join(canonical(parent), path.basename(value));
  }
}

/** Only UPLOAD_DIR is media storage; database and configuration are not media. */
export function mediaPath(value: string, mode: "read" | "write" | "directory" = "read"): string {
  checkSyntax(value);
  const root = path.resolve(process.env.UPLOAD_DIR || "./uploads");
  const lexical = path.resolve(value);
  if (!contains(root, lexical)) throw new StoragePathError();
  const realRoot = canonical(root);
  const target = canonical(lexical);
  if (!contains(realRoot, target)) throw new StoragePathError();
  if (mode === "read") {
    try {
      if (!fs.statSync(target).isFile()) throw new StoragePathError();
    } catch {
      throw new StoragePathError();
    }
  }
  return target;
}

export function mediaSegment(value: string): string {
  checkSyntax(value);
  if (value === "." || value.includes("/") || path.isAbsolute(value)) throw new StoragePathError();
  return value;
}

export function storageErrorResponse(error: unknown): Response {
  if (error instanceof StoragePathError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json({ error: "Operation failed" }, { status: 500 });
}

/** Map rejected filesystem paths to a safe client error without disclosing paths. */
export function withStorageErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try { return await handler(...args); }
    catch (error) { return storageErrorResponse(error); }
  };
}
