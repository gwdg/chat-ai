// The pi tools get their file access through `operations` (see src/tools.ts).
// These stubs only satisfy module-level imports of the default local-filesystem paths.
const enoent = (p?: unknown) => Object.assign(new Error(`ENOENT: no such file or directory, '${p}'`), { code: "ENOENT" });
const fail = (p?: unknown): never => {
	throw enoent(p);
};
const failAsync = async (p?: unknown): Promise<never> => fail(p);

export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 };
export const accessSync = fail;
export const existsSync = () => false;
export const readFileSync = fail;
export const writeFileSync = fail;
export const statSync = fail;
export const lstatSync = fail;
export const readdirSync = fail;
export const mkdirSync = fail;
export const realpathSync = (p: string) => p;
export const unlinkSync = fail;
export const rmSync = fail;
export const renameSync = fail;
export const chmodSync = fail;
export const openSync = fail;
export const closeSync = () => {};
export const appendFileSync = fail;
export const copyFileSync = fail;
export const createWriteStream = fail;
export const createReadStream = fail;
export const mkdtempSync = fail;
export const watch = fail;

export const access = failAsync;
export const readFile = failAsync;
export const writeFile = failAsync;
export const stat = failAsync;
export const lstat = failAsync;
export const readdir = failAsync;
export const mkdir = failAsync;
export const realpath = async (p: string) => p;
export const unlink = failAsync;
export const rm = failAsync;
export const rename = failAsync;
export const chmod = failAsync;
export const open = failAsync;
export const appendFile = failAsync;
export const copyFile = failAsync;
export const mkdtemp = failAsync;

export const promises = { access, readFile, writeFile, stat, lstat, readdir, mkdir, realpath, unlink, rm, rename, chmod, open, appendFile, copyFile, mkdtemp };
export default { constants, accessSync, existsSync, readFileSync, writeFileSync, statSync, lstatSync, readdirSync, mkdirSync, realpathSync, unlinkSync, rmSync, renameSync, promises };
