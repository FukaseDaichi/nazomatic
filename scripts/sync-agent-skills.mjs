import { spawnSync } from "node:child_process";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
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
const stubRoot = path.join(repositoryRoot, ".claude", "skills");

if (
  path.dirname(stubRoot) !== path.join(repositoryRoot, ".claude") ||
  path.basename(stubRoot) !== "skills"
) {
  throw new Error(`Refusing to use unexpected stub path: ${stubRoot}`);
}

/**
 * Extracts a top-level frontmatter entry verbatim, including any indented
 * continuation lines, so quoting and multi-line scalars survive round-trips.
 */
function extractFrontmatterEntry(frontmatterLines, key) {
  const startIndex = frontmatterLines.findIndex((line) =>
    new RegExp(`^${key}:(\\s|$)`).test(line),
  );

  if (startIndex === -1) {
    return null;
  }

  const entryLines = [frontmatterLines[startIndex]];

  for (let index = startIndex + 1; index < frontmatterLines.length; index += 1) {
    const line = frontmatterLines[index];
    if (line.trim() !== "" && !/^\s/.test(line)) {
      break;
    }
    entryLines.push(line);
  }

  while (entryLines.length > 1 && entryLines.at(-1).trim() === "") {
    entryLines.pop();
  }

  return entryLines.join("\n");
}

/**
 * This repository runs with core.autocrlf=true and no .gitattributes, so a
 * fresh clone checks the stubs out as CRLF while this script writes LF.
 * Every stub comparison therefore normalizes line endings first.
 */
function normalizeLineEndings(contents) {
  return contents.replaceAll("\r\n", "\n");
}

function buildStub(skillName, nameEntry, descriptionEntry) {
  return [
    "---",
    nameEntry,
    descriptionEntry,
    "---",
    "",
    `このファイルは Claude Code 用の参照スタブです（\`npm run skills:sync\` が生成）。スキルの実体は \`.agents/skills/${skillName}/SKILL.md\` です。`,
    "実体を読み、その手順に従って実行してください。編集は実体側だけに行い、このファイルは直接編集しないでください。",
    "",
  ].join("\n");
}

async function readCanonicalSkills() {
  let entries;

  try {
    entries = await readdir(sourceRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Canonical skill directory is missing: .agents/skills`);
    }
    throw error;
  }

  const skills = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === ".gitkeep") {
      continue;
    }

    if (!entry.isDirectory()) {
      throw new Error(
        `Canonical skill entries must be real directories: ${path.join(sourceRoot, entry.name)}`,
      );
    }

    const skillDirectory = path.join(sourceRoot, entry.name);
    const skillFile = path.join(skillDirectory, "SKILL.md");
    let contents;

    try {
      contents = await readFile(skillFile, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Canonical skill is missing SKILL.md: ${skillFile}`);
      }
      throw error;
    }

    const frontmatterMatch = contents.match(
      /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
    );

    if (!frontmatterMatch) {
      throw new Error(`Missing frontmatter in ${skillFile}`);
    }

    const frontmatterLines = frontmatterMatch[1].split(/\r?\n/);
    const nameEntry = extractFrontmatterEntry(frontmatterLines, "name");
    const descriptionEntry = extractFrontmatterEntry(
      frontmatterLines,
      "description",
    );

    if (!nameEntry) {
      throw new Error(`Missing frontmatter name in ${skillFile}`);
    }

    if (!descriptionEntry) {
      throw new Error(`Missing frontmatter description in ${skillFile}`);
    }

    const declaredName = nameEntry
      .slice("name:".length)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (declaredName !== entry.name) {
      throw new Error(
        `Skill directory and frontmatter name must match: ${entry.name} != ${declaredName}`,
      );
    }

    const supportingFiles = await collectSupportingFiles(skillDirectory);
    assertSupportingPathsAreRepositoryRelative(
      entry.name,
      contents,
      supportingFiles,
    );

    skills.push({
      name: entry.name,
      stub: buildStub(entry.name, nameEntry, descriptionEntry),
    });
  }

  return skills;
}

async function collectSupportingFiles(root, relativePath = "") {
  const entries = await readdir(path.join(root, relativePath), {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const childRelativePath = path.join(relativePath, entry.name);
    const childPath = path.join(root, childRelativePath);
    const stats = await lstat(childPath);

    if (stats.isSymbolicLink()) {
      throw new Error(
        `Symbolic links are not portable skill contents: ${childPath}`,
      );
    }

    if (stats.isDirectory()) {
      files.push(...(await collectSupportingFiles(root, childRelativePath)));
      continue;
    }

    if (!stats.isFile()) {
      throw new Error(`Unsupported skill entry: ${childPath}`);
    }

    const posixPath = childRelativePath.replaceAll(path.sep, "/");
    if (posixPath !== "SKILL.md") {
      files.push(posixPath);
    }
  }

  return files;
}

/**
 * Claude Code resolves a skill's base directory to `.claude/skills/<name>`, so a
 * stub-invoked skill cannot resolve skill-directory-relative paths. Every
 * reference to a supporting file must therefore be repository-root relative.
 */
function assertSupportingPathsAreRepositoryRelative(
  skillName,
  skillContents,
  supportingFiles,
) {
  const expectedPrefix = `.agents/skills/${skillName}/`;

  for (const supportingFile of supportingFiles) {
    let searchIndex = skillContents.indexOf(supportingFile);

    while (searchIndex !== -1) {
      const prefixStart = searchIndex - expectedPrefix.length;
      const isRepositoryRelative =
        prefixStart >= 0 &&
        skillContents.slice(prefixStart, searchIndex) === expectedPrefix;

      if (!isRepositoryRelative) {
        throw new Error(
          `${skillName}: reference to "${supportingFile}" must be written as "${expectedPrefix}${supportingFile}" because Claude Code resolves the skill base directory to .claude/skills/${skillName}`,
        );
      }

      searchIndex = skillContents.indexOf(supportingFile, searchIndex + 1);
    }
  }
}

async function checkStubs(skills) {
  const differences = [];
  let stubEntries = [];

  try {
    stubEntries = await readdir(stubRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return ["stub directory is missing: .claude/skills"];
    }
    throw error;
  }

  const expectedSkills = new Set(skills.map((skill) => skill.name));

  for (const { name, stub } of skills) {
    const stubEntry = stubEntries.find((entry) => entry.name === name);

    if (!stubEntry) {
      differences.push(`missing stub skill: ${name}`);
      continue;
    }

    const stubDirectory = path.join(stubRoot, name);
    const directoryStats = await lstat(stubDirectory);

    if (directoryStats.isSymbolicLink()) {
      differences.push(
        `${name}: stub entry is a symbolic link or junction; replace it with a real directory`,
      );
      continue;
    }

    if (!directoryStats.isDirectory()) {
      differences.push(`${name}: stub entry is not a real directory`);
      continue;
    }

    const stubFile = path.join(stubDirectory, "SKILL.md");
    let stubStats;

    try {
      stubStats = await lstat(stubFile);
    } catch (error) {
      if (error.code === "ENOENT") {
        differences.push(`${name}: stub SKILL.md is missing`);
        continue;
      }
      throw error;
    }

    if (stubStats.isSymbolicLink()) {
      differences.push(`${name}: stub SKILL.md is a symbolic link`);
      continue;
    }

    if (!stubStats.isFile()) {
      differences.push(`${name}: stub SKILL.md is not a regular file`);
      continue;
    }

    const actual = await readFile(stubFile, "utf8");

    if (!actual.startsWith("---")) {
      differences.push(
        `${name}: stub SKILL.md has no frontmatter; it may be a path-only file left behind by a symbolic link`,
      );
      continue;
    }

    if (normalizeLineEndings(actual) !== stub) {
      differences.push(
        `${name}: stub SKILL.md does not match the canonical frontmatter`,
      );
    }

    const extraEntries = (
      await readdir(stubDirectory, { withFileTypes: true })
    ).filter((entry) => entry.name !== "SKILL.md");

    for (const extraEntry of extraEntries) {
      differences.push(
        `${name}: unexpected stub entry: ${extraEntry.name}; supporting files belong to .agents/skills/${name}/ only`,
      );
    }
  }

  for (const entry of stubEntries) {
    if (entry.name === ".gitkeep") {
      continue;
    }
    if (!expectedSkills.has(entry.name)) {
      differences.push(`unexpected stub skill: ${entry.name}`);
    }
  }

  return differences;
}

/**
 * A stub written over a former symbolic link keeps Git mode 120000, which stays
 * invisible while core.symlinks=false but breaks on any checkout that restores
 * symbolic links.
 */
function checkGitModes() {
  const result = spawnSync(
    "git",
    ["ls-files", "-s", "--", ".claude/skills/", ".claude/commands/"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  if (result.error || result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("120000 "))
    .map(
      (line) =>
        `Git index still records a symbolic link (mode 120000): ${line.split("\t").at(-1)}; re-add it with \`git rm --cached <path>\` then \`git add <path>\``,
    );
}

async function syncStubs(skills) {
  await mkdir(stubRoot, { recursive: true });
  const expectedSkills = new Set(skills.map((skill) => skill.name));
  const existingEntries = await readdir(stubRoot, { withFileTypes: true });

  for (const entry of existingEntries) {
    if (entry.name === ".gitkeep" || expectedSkills.has(entry.name)) {
      continue;
    }
    await rm(path.join(stubRoot, entry.name), { recursive: true, force: true });
  }

  for (const { name, stub } of skills) {
    const stubDirectory = path.join(stubRoot, name);
    const stubFile = path.join(stubDirectory, "SKILL.md");

    const directoryStats = await lstat(stubDirectory).catch(() => null);
    if (directoryStats && !directoryStats.isDirectory()) {
      await rm(stubDirectory, { recursive: true, force: true });
    }

    await mkdir(stubDirectory, { recursive: true });

    // Supporting files live in the canonical skill only; drop mirror leftovers.
    for (const entry of await readdir(stubDirectory, { withFileTypes: true })) {
      if (entry.name !== "SKILL.md") {
        await rm(path.join(stubDirectory, entry.name), {
          recursive: true,
          force: true,
        });
      }
    }

    // Leave a matching stub untouched so a CRLF checkout stays byte-stable.
    const current = await readFile(stubFile, "utf8").catch(() => null);
    if (current !== null && normalizeLineEndings(current) === stub) {
      continue;
    }

    await writeFile(stubFile, stub, "utf8");
  }
}

const skills = await readCanonicalSkills();

if (!checkOnly) {
  await syncStubs(skills);
}

const differences = [...(await checkStubs(skills)), ...checkGitModes()];

if (differences.length > 0) {
  console.error("Claude Code Agent Skill stubs are out of sync:");
  for (const difference of differences) {
    console.error(`- ${difference}`);
  }
  console.error("Run `npm run skills:sync` to regenerate .claude/skills.");
  process.exitCode = 1;
} else {
  console.log(
    `${checkOnly ? "Verified" : "Synchronized"} ${skills.length} Agent Skill stub(s): ${skills.map((skill) => skill.name).join(", ")}`,
  );
}
