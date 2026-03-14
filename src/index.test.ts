import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import markdownExport from "./index.js";

type TestContext = {
  contentDir: string;
  outputDir: string;
  mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
};

function integrationApiTests(): void {
  it("has name 'markdown-export'", () => {
    const integration = markdownExport();
    expect(integration.name).toBe("markdown-export");
  });
}

function exportBehaviorTests(getContext: () => TestContext): void {
  it("exports markdown files with enhanced frontmatter to output dir", async () => {
    const { contentDir, outputDir, mockLogger } = getContext();
    const postMd = `---
title: Test Post
---

# Hello

Content here.
`;
    await fs.writeFile(path.join(contentDir, "test-post.md"), postMd, "utf-8");

    const integration = markdownExport({
      contentDir,
      siteUrl: "https://example.com",
      routePrefix: "blog",
      includeSourceUrls: true,
    });

    if (integration.hooks["astro:config:done"]) {
      integration.hooks["astro:config:done"]({
        config: { site: "https://example.com" },
      } as never);
    }

    if (integration.hooks["astro:build:done"]) {
      await integration.hooks["astro:build:done"]({
        dir: pathToFileURL(outputDir),
        logger: mockLogger as never,
      } as never);
    }

    const outputPath = path.join(outputDir, "blog", "test-post", "index.md");
    const content = await fs.readFile(outputPath, "utf-8");

    expect(content).toContain("title: Test Post");
    expect(content).toContain("source_url:");
    expect(content).toContain("html: https://example.com/blog/test-post");
    expect(content).toContain(
      "md: https://example.com/blog/test-post/index.md",
    );
    expect(content).toContain("# Hello");
    expect(content).toContain("Content here.");
  });

  it("slugifies filenames (lowercase, special chars to hyphen)", async () => {
    const { contentDir, outputDir, mockLogger } = getContext();
    const postMd = `---
title: My Post
---

Body.
`;
    await fs.writeFile(
      path.join(contentDir, "My-Cool_Post!.md"),
      postMd,
      "utf-8",
    );

    const integration = markdownExport({
      contentDir,
      siteUrl: "https://example.com",
      routePrefix: "blog",
    });

    if (integration.hooks["astro:config:done"]) {
      integration.hooks["astro:config:done"]({
        config: { site: "https://example.com" },
      } as never);
    }

    if (integration.hooks["astro:build:done"]) {
      await integration.hooks["astro:build:done"]({
        dir: pathToFileURL(outputDir),
        logger: mockLogger as never,
      } as never);
    }

    const slugDir = path.join(outputDir, "blog", "my-cool-post");
    const stat = await fs.stat(path.join(slugDir, "index.md"));
    expect(stat.isFile()).toBe(true);
  });
}

function frontmatterTests(getContext: () => TestContext): void {
  it("adds additionalFrontmatter to exported files", async () => {
    const { contentDir, outputDir, mockLogger } = getContext();
    const postMd = `---
title: With Extra
---

Body.
`;
    await fs.writeFile(path.join(contentDir, "extra.md"), postMd, "utf-8");

    const integration = markdownExport({
      contentDir,
      siteUrl: "https://example.com",
      routePrefix: "blog",
      additionalFrontmatter: {
        generator: "astro-markdown-export",
        version: 1,
      },
    });

    if (integration.hooks["astro:config:done"]) {
      integration.hooks["astro:config:done"]({
        config: { site: "https://example.com" },
      } as never);
    }

    if (integration.hooks["astro:build:done"]) {
      await integration.hooks["astro:build:done"]({
        dir: pathToFileURL(outputDir),
        logger: mockLogger as never,
      } as never);
    }

    const content = await fs.readFile(
      path.join(outputDir, "blog", "extra", "index.md"),
      "utf-8",
    );
    expect(content).toContain("generator: astro-markdown-export");
    expect(content).toContain("version: 1");
  });
}

function edgeCasesTests(getContext: () => TestContext): void {
  it("skips files without frontmatter and warns", async () => {
    const { contentDir, outputDir, mockLogger } = getContext();
    const noFrontmatter = `# No frontmatter

Just content.
`;
    await fs.writeFile(
      path.join(contentDir, "no-frontmatter.md"),
      noFrontmatter,
      "utf-8",
    );

    const integration = markdownExport({
      contentDir,
      siteUrl: "https://example.com",
      routePrefix: "blog",
    });

    if (integration.hooks["astro:config:done"]) {
      integration.hooks["astro:config:done"]({
        config: { site: "https://example.com" },
      } as never);
    }

    if (integration.hooks["astro:build:done"]) {
      await integration.hooks["astro:build:done"]({
        dir: pathToFileURL(outputDir),
        logger: mockLogger as never,
      } as never);
    }

    const blogDir = path.join(outputDir, "blog");
    const entries = await fs
      .readdir(blogDir, { withFileTypes: true })
      .catch(() => []);
    expect(entries.length).toBe(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Could not extract frontmatter"),
    );
  });

  it("uses config.site when siteUrl is not provided", async () => {
    const { contentDir, outputDir, mockLogger } = getContext();
    const postMd = `---
title: Site From Config
---

Body.
`;
    await fs.writeFile(
      path.join(contentDir, "from-config.md"),
      postMd,
      "utf-8",
    );

    const integration = markdownExport({
      contentDir,
      routePrefix: "blog",
      includeSourceUrls: true,
    });

    if (integration.hooks["astro:config:done"]) {
      integration.hooks["astro:config:done"]({
        config: { site: "https://my-site.com" },
      } as never);
    }

    if (integration.hooks["astro:build:done"]) {
      await integration.hooks["astro:build:done"]({
        dir: pathToFileURL(outputDir),
        logger: mockLogger as never,
      } as never);
    }

    const content = await fs.readFile(
      path.join(outputDir, "blog", "from-config", "index.md"),
      "utf-8",
    );
    expect(content).toContain("html: https://my-site.com/blog/from-config");
  });
}

describe("markdown-export integration", () => {
  let contentDir: string;
  let outputDir: string;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    contentDir = path.resolve(
      os.tmpdir(),
      `markdown-export-content-${Date.now()}`,
    );
    outputDir = path.resolve(
      os.tmpdir(),
      `markdown-export-output-${Date.now()}`,
    );
    await fs.mkdir(contentDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(async () => {
    await fs.rm(contentDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
  });

  describe("integration API", integrationApiTests);
  describe("export behavior", () =>
    exportBehaviorTests(() => ({ contentDir, outputDir, mockLogger })));
  describe("frontmatter", () =>
    frontmatterTests(() => ({ contentDir, outputDir, mockLogger })));
  describe("edge cases", () =>
    edgeCasesTests(() => ({ contentDir, outputDir, mockLogger })));
});
