import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VALID_OPTIONS = new Set(["--check"]);
const options = process.argv.slice(2);
const unknownOptions = options.filter((option) => !VALID_OPTIONS.has(option));

if (unknownOptions.length > 0) {
  throw new Error(`Unknown option(s): ${unknownOptions.join(", ")}`);
}

const checkOnly = options.includes("--check");
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(repositoryRoot, ".agents", "skills");
const mirrorRoot = path.join(repositoryRoot, ".claude", "skills");

if (
  path.dirname(mirrorRoot) !== path.join(repositoryRoot, ".claude") ||
  path.basename(mirrorRoot) !== "skills"
) {
  throw new Error(`Refusing to use unexpected mirror path: ${mirrorRoot}`);
}

async function readCanonicalSkills() {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const skills = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) {
      throw new Error(
        `Canonical skill entries must be real directories: ${path.join(sourceRoot, entry.name)}`,
      );
    }

    const skillFile = path.join(sourceRoot, entry.name, "SKILL.md");
    const contents = await readFile(skillFile, "utf8");
    const frontmatterMatch = contents.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const nameMatch = frontmatterMatch?.[1].match(
      /^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m,
    );

    if (!nameMatch) {
      throw new Error(`Missing frontmatter name in ${skillFile}`);
    }

    if (nameMatch[1] !== entry.name) {
      throw new Error(
        `Skill directory and frontmatter name must match: ${entry.name} != ${nameMatch[1]}`,
      );
    }

    skills.push(entry.name);
  }

  return skills;
}

async function collectFiles(root, relativePath = "") {
  const currentPath = path.join(root, relativePath);
  const entries = await readdir(currentPath, { withFileTypes: true });
  const files = new Map();

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const childRelativePath = path.join(relativePath, entry.name);
    const childPath = path.join(root, childRelativePath);
    const stats = await lstat(childPath);

    if (stats.isSymbolicLink()) {
      throw new Error(`Symbolic links are not portable skill contents: ${childPath}`);
    }

    if (stats.isDirectory()) {
      const childFiles = await collectFiles(root, childRelativePath);
      for (const [filePath, hash] of childFiles) {
        files.set(filePath, hash);
      }
      continue;
    }

    if (!stats.isFile()) {
      throw new Error(`Unsupported skill entry: ${childPath}`);
    }

    const contents = await readFile(childPath);
    files.set(
      childRelativePath.replaceAll(path.sep, "/"),
      createHash("sha256").update(contents).digest("hex"),
    );
  }

  return files;
}

function compareFileMaps(sourceFiles, mirrorFiles) {
  const differences = [];

  for (const [filePath, hash] of sourceFiles) {
    if (!mirrorFiles.has(filePath)) {
      differences.push(`missing mirror file: ${filePath}`);
    } else if (mirrorFiles.get(filePath) !== hash) {
      differences.push(`content differs: ${filePath}`);
    }
  }

  for (const filePath of mirrorFiles.keys()) {
    if (!sourceFiles.has(filePath)) {
      differences.push(`unexpected mirror file: ${filePath}`);
    }
  }

  return differences;
}

async function checkMirror(skills) {
  const differences = [];
  let mirrorEntries = [];

  try {
    mirrorEntries = await readdir(mirrorRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return ["mirror directory is missing: .claude/skills"];
    }
    throw error;
  }

  const expectedSkills = new Set(skills);
  const actualSkills = new Set(mirrorEntries.map((entry) => entry.name));

  for (const skill of skills) {
    if (!actualSkills.has(skill)) {
      differences.push(`missing mirror skill: ${skill}`);
      continue;
    }

    const mirrorEntry = mirrorEntries.find((entry) => entry.name === skill);
    if (!mirrorEntry.isDirectory()) {
      differences.push(`mirror skill is not a real directory: ${skill}`);
      continue;
    }

    const sourceFiles = await collectFiles(path.join(sourceRoot, skill));
    const mirrorFiles = await collectFiles(path.join(mirrorRoot, skill));
    differences.push(
      ...compareFileMaps(sourceFiles, mirrorFiles).map(
        (difference) => `${skill}: ${difference}`,
      ),
    );
  }

  for (const entry of mirrorEntries) {
    if (!expectedSkills.has(entry.name)) {
      differences.push(`unexpected mirror skill: ${entry.name}`);
    }
  }

  return differences;
}

async function syncMirror(skills) {
  await mkdir(mirrorRoot, { recursive: true });
  const existingEntries = await readdir(mirrorRoot, { withFileTypes: true });

  for (const entry of existingEntries) {
    await rm(path.join(mirrorRoot, entry.name), {
      recursive: true,
      force: true,
    });
  }

  for (const skill of skills) {
    await cp(path.join(sourceRoot, skill), path.join(mirrorRoot, skill), {
      recursive: true,
      force: true,
    });
  }
}

const skills = await readCanonicalSkills();

if (!checkOnly) {
  await syncMirror(skills);
}

const differences = await checkMirror(skills);

if (differences.length > 0) {
  console.error("Agent Skill mirror is out of sync:");
  for (const difference of differences) {
    console.error(`- ${difference}`);
  }
  console.error("Run `npm run skills:sync` to regenerate .claude/skills.");
  process.exitCode = 1;
} else {
  console.log(
    `${checkOnly ? "Verified" : "Synchronized"} ${skills.length} Agent Skill(s): ${skills.join(", ")}`,
  );
}
