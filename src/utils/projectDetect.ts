import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ProjectInfo {
  type: string;
  name: string;
  framework?: string;
  language: string;
  packageManager?: string;
  testCommand?: string;
  buildCommand?: string;
  lintCommand?: string;
  devCommand?: string;
}

export function detectProject(cwd: string): ProjectInfo | null {
  if (existsSync(join(cwd, "package.json"))) {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      let framework: string | undefined;
      if (deps["next"]) framework = "Next.js";
      else if (deps["nuxt"]) framework = "Nuxt";
      else if (deps["svelte"] || deps["@sveltejs/kit"]) framework = "SvelteKit";
      else if (deps["react"]) framework = "React";
      else if (deps["vue"]) framework = "Vue";
      else if (deps["express"]) framework = "Express";
      else if (deps["fastify"]) framework = "Fastify";
      else if (deps["hono"]) framework = "Hono";

      const isTS = existsSync(join(cwd, "tsconfig.json"));

      let pm = "npm";
      if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) pm = "bun";
      else if (existsSync(join(cwd, "pnpm-lock.yaml"))) pm = "pnpm";
      else if (existsSync(join(cwd, "yarn.lock"))) pm = "yarn";

      return {
        type: "node",
        name: pkg.name || "unknown",
        framework,
        language: isTS ? "TypeScript" : "JavaScript",
        packageManager: pm,
        testCommand: pkg.scripts?.test ? `${pm} test` : undefined,
        buildCommand: pkg.scripts?.build ? `${pm} run build` : undefined,
        lintCommand: pkg.scripts?.lint ? `${pm} run lint` : undefined,
        devCommand: pkg.scripts?.dev ? `${pm} run dev` : pkg.scripts?.start ? `${pm} start` : undefined,
      };
    } catch {}
  }

  if (existsSync(join(cwd, "Cargo.toml"))) {
    try {
      const cargo = readFileSync(join(cwd, "Cargo.toml"), "utf-8");
      const nameMatch = cargo.match(/name\s*=\s*"([^"]+)"/);
      return {
        type: "rust",
        name: nameMatch?.[1] || "unknown",
        language: "Rust",
        testCommand: "cargo test",
        buildCommand: "cargo build",
        lintCommand: "cargo clippy",
      };
    } catch {}
  }

  if (existsSync(join(cwd, "go.mod"))) {
    try {
      const gomod = readFileSync(join(cwd, "go.mod"), "utf-8");
      const moduleMatch = gomod.match(/module\s+(\S+)/);
      return {
        type: "go",
        name: moduleMatch?.[1] || "unknown",
        language: "Go",
        testCommand: "go test ./...",
        buildCommand: "go build ./...",
        lintCommand: "golangci-lint run",
      };
    } catch {}
  }

  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "requirements.txt"))) {
    const hasPyproject = existsSync(join(cwd, "pyproject.toml"));
    let name = "unknown";
    if (hasPyproject) {
      try {
        const pyproj = readFileSync(join(cwd, "pyproject.toml"), "utf-8");
        const nameMatch = pyproj.match(/name\s*=\s*"([^"]+)"/);
        if (nameMatch) name = nameMatch[1];
      } catch {}
    }

    const hasPoetry = hasPyproject && existsSync(join(cwd, "poetry.lock"));
    const pm = hasPoetry ? "poetry" : existsSync(join(cwd, "Pipfile")) ? "pipenv" : "pip";

    return {
      type: "python",
      name,
      language: "Python",
      packageManager: pm,
      testCommand: "pytest",
      lintCommand: "ruff check .",
    };
  }

  if (existsSync(join(cwd, "Gemfile"))) {
    return {
      type: "ruby",
      name: "unknown",
      language: "Ruby",
      testCommand: "bundle exec rspec",
      lintCommand: "bundle exec rubocop",
    };
  }

  if (existsSync(join(cwd, "build.gradle")) || existsSync(join(cwd, "pom.xml"))) {
    const isGradle = existsSync(join(cwd, "build.gradle"));
    return {
      type: "java",
      name: "unknown",
      language: existsSync(join(cwd, "build.gradle.kts")) ? "Kotlin" : "Java",
      testCommand: isGradle ? "./gradlew test" : "mvn test",
      buildCommand: isGradle ? "./gradlew build" : "mvn package",
    };
  }

  return null;
}

export function formatProjectInfo(info: ProjectInfo): string {
  let output = `${info.name} — ${info.language}`;
  if (info.framework) output += ` (${info.framework})`;
  if (info.packageManager) output += ` • ${info.packageManager}`;
  return output;
}
