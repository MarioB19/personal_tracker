import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
const force = process.argv.includes("--force");

let content = "";
try {
  content = await readFile(envPath, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

function upsert(source, key, value, replaceExisting = true) {
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));

  if (index === -1) {
    lines.push(`${key}=${value}`);
  } else if (replaceExisting) {
    lines[index] = `${key}=${value}`;
  }

  return lines.join("\n").replace(/^\n+/, "").replace(/\n*$/, "\n");
}

const existingToken = content
  .split(/\r?\n/)
  .find((line) => line.startsWith("TRACKER_LOCAL_API_TOKEN="))
  ?.slice("TRACKER_LOCAL_API_TOKEN=".length)
  .trim();

if (!existingToken || force) {
  content = upsert(
    content,
    "TRACKER_LOCAL_API_TOKEN",
    randomBytes(32).toString("hex"),
  );
}

content = upsert(content, "TRACKER_API_ALLOW_LOCAL_TOKEN", "true");
content = upsert(content, "TRACKER_USER_ID", "brandon", false);

await writeFile(envPath, content, { encoding: "utf8", mode: 0o600 });
await chmod(envPath, 0o600);

console.log(
  existingToken && !force
    ? "Local API token already configured; kept the existing value."
    : "Local API token configured without printing the secret.",
);
