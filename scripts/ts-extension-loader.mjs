import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code !== "ERR_MODULE_NOT_FOUND" ||
      !specifier.startsWith(".") ||
      /\.[a-z\d]+$/i.test(specifier)
    ) {
      throw error;
    }

    const parentPath = fileURLToPath(context.parentURL);
    for (const extension of [".ts", ".js", ".mjs"]) {
      const candidate = path.resolve(path.dirname(parentPath), `${specifier}${extension}`);
      try {
        return await nextResolve(pathToFileURL(candidate).href, context);
      } catch (candidateError) {
        if (candidateError?.code !== "ERR_MODULE_NOT_FOUND") throw candidateError;
      }
    }
    throw error;
  }
}
