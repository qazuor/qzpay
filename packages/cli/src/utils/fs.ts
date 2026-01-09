/**
 * File System Utilities
 *
 * Helper functions for file system operations used during code generation.
 *
 * @packageDocumentation
 */
import { writeFile as fsWriteFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Ensure a directory exists, creating it recursively if necessary.
 *
 * @param dir - The directory path to ensure exists
 *
 * @example
 * ```typescript
 * await ensureDir('./billing/src/services');
 * // Creates ./billing/src/services if it doesn't exist
 * ```
 */
export async function ensureDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true });
}

/**
 * Write content to a file, creating parent directories if necessary.
 *
 * @param path - The file path to write to
 * @param content - The content to write
 *
 * @example
 * ```typescript
 * await writeFile('./billing/config.ts', 'export const config = {};');
 * // Creates ./billing/ directory if needed, then writes config.ts
 * ```
 */
export async function writeFile(path: string, content: string): Promise<void> {
    await ensureDir(dirname(path));
    await fsWriteFile(path, content, 'utf-8');
}
