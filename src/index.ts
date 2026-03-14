import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration, AstroIntegrationLogger } from "astro";

export interface MarkdownExportOptions {
  siteUrl?: string;
  additionalFrontmatter?: Record<string, unknown>;
  includeSourceUrls?: boolean;
  contentDir?: string;
  outputDir?: string;
  routePrefix?: string;
  concurrency?: number;
  failOnError?: boolean;
}

interface ProcessingContext {
  siteUrl: string;
  contentDir: string;
  outputDir: string;
  routePrefix: string;
  includeSourceUrls: boolean;
  additionalFrontmatter: Record<string, unknown>;
}

/**
 * Generates a URL-friendly slug from a markdown filename.
 * @param filename - The markdown filename (e.g., "my-post.md")
 * @returns A slugified version of the filename (e.g., "my-post")
 */
const generateSlug = (filename: string): string => {
  return path
    .basename(filename, ".md")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

/**
 * Formats source URL frontmatter entries for a markdown file as YAML.
 * @param siteUrl - The base site URL
 * @param routePrefix - The route prefix (e.g., "blog")
 * @param fileSlug - The slugified filename
 * @returns A YAML-formatted string with source URLs
 */
const formatSourceUrlsFrontmatter = (
  siteUrl: string,
  routePrefix: string,
  fileSlug: string,
): string => {
  return `\nsource_url:\n  html: ${siteUrl}/${routePrefix}/${fileSlug}\n  md: ${siteUrl}/${routePrefix}/${fileSlug}/index.md`;
};

/**
 * Escapes a YAML string value if it contains special characters.
 * Uses a fast-path regex test to avoid unnecessary escaping for most strings.
 * @param value - The string value to escape
 * @returns The escaped string, or original if no escaping needed
 */
const escapeYamlString = (value: string): string => {
  // Fast path: most strings don't need escaping
  if (!/[:#|&*!%@`"'[{]|^\s|\s$/.test(value)) {
    return value;
  }
  // Slow path: escape and quote
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
};

/**
 * Type representing valid YAML values that can be serialized.
 */
type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [key: string]: YamlValue };

/**
 * Formats a nested object into YAML format recursively.
 * @param obj - The object to format
 * @param indent - Current indentation level
 * @returns YAML-formatted string for the object
 */
const formatNestedObject = (
  obj: { [key: string]: YamlValue },
  indent = 0,
): string => {
  const indentStr = "  ".repeat(indent);
  const parts: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null) {
      parts.push(`${indentStr}${key}: null`);
    } else if (value === undefined) {
    } else if (typeof value === "boolean") {
      parts.push(`${indentStr}${key}: ${value}`);
    } else if (typeof value === "number") {
      parts.push(`${indentStr}${key}: ${value}`);
    } else if (typeof value === "string") {
      parts.push(`${indentStr}${key}: ${escapeYamlString(value)}`);
    } else if (Array.isArray(value)) {
      parts.push(`${indentStr}${key}:`);
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          parts.push(`${indentStr}  -`);
          parts.push(
            formatNestedObject(
              item as { [key: string]: YamlValue },
              indent + 2,
            ),
          );
        } else {
          const itemStr =
            typeof item === "string" ? escapeYamlString(item) : String(item);
          parts.push(`${indentStr}  - ${itemStr}`);
        }
      }
    } else if (typeof value === "object" && value !== null) {
      parts.push(`${indentStr}${key}:`);
      parts.push(
        formatNestedObject(value as { [key: string]: YamlValue }, indent + 1),
      );
    } else {
      parts.push(`${indentStr}${key}: ${String(value)}`);
    }
  }

  return parts.join("\n");
};

/**
 * Formats additional frontmatter data into YAML string format.
 * Handles strings, numbers, booleans, null, arrays, and nested objects.
 * @param additionalFrontmatter - Key-value pairs to add to frontmatter
 * @returns A YAML-formatted string, or empty string if no frontmatter provided
 */
const formatAdditionalFrontmatter = (
  additionalFrontmatter: Record<string, unknown>,
): string => {
  if (Object.keys(additionalFrontmatter).length === 0) {
    return "";
  }

  return `\n${formatNestedObject(additionalFrontmatter as { [key: string]: YamlValue })}`;
};

/**
 * Enhances existing frontmatter with source URLs and additional frontmatter.
 * @param frontmatter - The original frontmatter string
 * @param context - Processing context with configuration
 * @param fileSlug - The slugified filename
 * @returns Enhanced frontmatter string
 */
const enhanceFrontmatter = (
  frontmatter: string,
  context: ProcessingContext,
  fileSlug: string,
): string => {
  const parts = [frontmatter];

  if (context.includeSourceUrls) {
    parts.push(
      formatSourceUrlsFrontmatter(
        context.siteUrl,
        context.routePrefix,
        fileSlug,
      ),
    );
  }

  if (Object.keys(context.additionalFrontmatter).length > 0) {
    parts.push(formatAdditionalFrontmatter(context.additionalFrontmatter));
  }

  return parts.join("");
};

/**
 * Rebuilds markdown content with enhanced frontmatter.
 * @param rawContent - The original markdown content
 * @param enhancedFrontmatter - The enhanced frontmatter string
 * @param frontmatterMatch - Regex match result for the original frontmatter
 * @returns Complete markdown content with enhanced frontmatter
 */
const buildEnhancedMarkdown = (
  rawContent: string,
  enhancedFrontmatter: string,
  frontmatterMatch: RegExpMatchArray,
): string => {
  const frontmatterBlockLength = frontmatterMatch[0].length;
  const contentWithoutFrontmatter = rawContent.slice(frontmatterBlockLength);
  return `---\n${enhancedFrontmatter}\n---\n${contentWithoutFrontmatter}`;
};

/**
 * Writes markdown content to a file, creating directories as needed.
 * @param outputPath - The full path where the file should be written
 * @param content - The markdown content to write
 */
const writeMarkdownFile = async (
  outputPath: string,
  content: string,
): Promise<void> => {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, "utf-8");
};

/**
 * Processes a single markdown file: reads, enhances, and writes it.
 * @param contentFile - The markdown filename to process
 * @param context - Processing context with configuration
 * @param logger - The Astro integration logger
 * @returns True if processing was successful, false otherwise
 */
const processMarkdownFile = async (
  contentFile: string,
  context: ProcessingContext,
  logger: AstroIntegrationLogger,
): Promise<boolean> => {
  if (!contentFile.endsWith(".md")) {
    return false;
  }

  const fileSlug = generateSlug(contentFile);
  const filePath = path.join(context.contentDir, contentFile);
  const rawContent = await fs.readFile(filePath, "utf-8");

  const frontmatterMatch = rawContent.match(/^---\n(.*?)\n---\n/s);
  const frontmatter = frontmatterMatch?.[1];
  if (!frontmatterMatch || frontmatter === undefined) {
    // Skip files without frontmatter - this is expected for some markdown files
    logger.warn(`Could not extract frontmatter for ${fileSlug}, skipping`);
    return false;
  }

  const enhancedFrontmatter = enhanceFrontmatter(
    frontmatter,
    context,
    fileSlug,
  );
  const enhancedMarkdown = buildEnhancedMarkdown(
    rawContent,
    enhancedFrontmatter,
    frontmatterMatch,
  );

  const outputPath = path.join(
    context.outputDir,
    context.routePrefix,
    fileSlug,
    "index.md",
  );

  await writeMarkdownFile(outputPath, enhancedMarkdown);
  return true;
};

/**
 * Creates a processing context from options with defaults applied.
 * @param options - User-provided options
 * @param outputDir - The output directory for processed files
 * @param fallbackSiteUrl - Site URL from astro.config.site when options.siteUrl is not set
 * @returns A fully configured ProcessingContext
 */
const createProcessingContext = (
  options: MarkdownExportOptions,
  outputDir: string,
  fallbackSiteUrl: string,
): ProcessingContext => {
  const {
    contentDir: contentDirOption = "src/content/blog",
    siteUrl: siteUrlOption,
    includeSourceUrls = true,
    additionalFrontmatter = {},
    routePrefix = "blog",
  } = options;

  return {
    siteUrl: siteUrlOption || fallbackSiteUrl,
    contentDir: path.isAbsolute(contentDirOption)
      ? contentDirOption
      : path.join(process.cwd(), contentDirOption),
    outputDir,
    routePrefix,
    includeSourceUrls,
    additionalFrontmatter,
  };
};

/**
 * Processes items in batches to control concurrency.
 *
 * Benefits:
 * - Prevents memory exhaustion with large item sets
 * - Balances parallelism with I/O capacity
 * - Allows graceful degradation under resource constraints
 *
 * @param items - Array of items to process
 * @param batchSize - Number of items to process concurrently
 * @param processor - Async function to process each item
 * @template T - The type of items being processed
 */
const processInBatches = async <T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<unknown>,
): Promise<void> => {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
  }
};

const markdownExport = (
  options: MarkdownExportOptions = {},
): AstroIntegration => {
  let resolvedSiteUrl = "";

  return {
    name: "markdown-export",
    hooks: {
      "astro:config:done": ({ config }) => {
        resolvedSiteUrl = config.site?.toString() ?? "";
      },
      "astro:build:done": async ({ dir, logger }) => {
        const outputDir = fileURLToPath(dir);
        const context = createProcessingContext(
          options,
          outputDir,
          resolvedSiteUrl,
        );
        const concurrency = options.concurrency || 10;

        const dirEntries = await fs.readdir(context.contentDir, {
          withFileTypes: true,
        });
        const mdFiles = (dirEntries as Dirent[])
          .filter(
            (entry: Dirent) => entry.isFile() && entry.name.endsWith(".md"),
          )
          .map((entry: Dirent) => entry.name);

        const envDev = (import.meta as unknown as { env?: { DEV?: boolean } })
          .env?.DEV;
        const failOnError = options.failOnError ?? envDev;
        await processInBatches(mdFiles, concurrency, async (contentFile) => {
          try {
            await processMarkdownFile(contentFile, context, logger);
          } catch (error: unknown) {
            const errorMessage: string =
              error instanceof Error ? error.message : String(error);
            logger.error(`Error processing ${contentFile}: ${errorMessage}`);
            if (envDev && error instanceof Error && error.stack) {
              logger.error(error.stack);
            }
            if (failOnError) {
              throw error;
            }
          }
        });
      },
    },
  };
};

export default markdownExport;
