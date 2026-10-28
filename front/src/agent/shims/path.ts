import path from "path-browserify";

export const { resolve, join, dirname, basename, extname, relative, normalize, isAbsolute, sep, delimiter, parse, format } = path;
export const posix = path;
export const win32 = path;
export const toNamespacedPath = (p: string) => p;
export default path;
