import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { posix } from "node:path";
import { writeFile } from "node:fs/promises";
import type { Card, Field, Profile } from "../src/core/model";
const paths = process.argv.slice(2).filter((path) => !path.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
if (!paths.length) throw new Error("Pass one or more Notion export ZIP paths");
const stableId = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 32);
const pages = new Map<
  string,
  { path: string; content: string; id: string }[]
>();
const assets = new Map<string, Buffer>();
let rows: Record<string, string>[] = [];
for (const path of paths) {
  const zip = new AdmZip(path);
  for (const entry of zip.getEntries()) {
    if (entry.entryName.endsWith("_all.csv")) {
      const data = parse(entry.getData().toString("utf8"), {
        columns: true,
        bom: true,
        skip_empty_lines: true,
      }) as Record<string, string>[];
      if (!rows.length) rows = data;
      else if (JSON.stringify(rows) !== JSON.stringify(data))
        throw new Error("Full CSV exports differ; reconcile before importing");
    } else if (entry.entryName.endsWith(".md")) {
      const content = entry.getData().toString("utf8");
      const title = content.split("\n")[0]!.replace(/^# /, "").trim();
      const id =
        entry.entryName.match(/([a-f0-9]{32})\.md$/)?.[1] ??
        stableId(entry.entryName);
      const existing = pages.get(title) ?? [];
      if (!existing.some((page) => page.id === id))
        existing.push({ path: entry.entryName, content, id });
      pages.set(title, existing);
    } else if (/\.(png|jpe?g|webp|gif)$/i.test(entry.entryName))
      assets.set(entry.entryName, entry.getData());
  }
}
if (!rows.length) throw new Error("No complete CSV found");
const excludedNames = new Set(["Eduardo Esquivel"]);
const userNames = new Set<string>();
for (const row of rows)
  for (const field of ["Encargado(s)", "Creado por", "Responsable", "reviewer"])
    for (const name of (row[field] ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean))
      if (!excludedNames.has(name)) userNames.add(name);
const profiles: Profile[] = [...userNames].map((name) => ({
  id: `notion-person-${stableId(name)}`,
  name,
  role: "member",
  authUserId: null,
  ownerId: null,
  kind: "person",
}));
const profileIds = new Map(
  profiles.map((profile) => [profile.name, profile.id]),
);
const fieldDefinitions: { source: string; field: Field }[] = [
  {
    source: "Estado",
    field: { id: "status", name: "Estado", type: "select", options: [] },
  },
  {
    source: "Prioridad",
    field: { id: "priority", name: "Prioridad", type: "select", options: [] },
  },
  ...["Categoría", "Tag-filtro"].map((source) => ({
    source,
    field: {
      id: stableId(source),
      name: source,
      type: "multiSelect" as const,
      options: [],
    },
  })),
  ...["Encargado(s)", "Responsable", "reviewer", "Creado por"].map(
    (source) => ({
      source,
      field: {
        id: source === "Encargado(s)" ? "assignees" : stableId(source),
        name: source,
        type: "people" as const,
        options: [],
      },
    }),
  ),
  ...[
    "Bitácora Kiwi",
    "Subject correo",
    "Fecha de creación",
    "Última edición",
    "Fecha Entrega",
  ].map((source) => ({
    source,
    field: {
      id: stableId(source),
      name: source,
      type: "text" as const,
      options: [],
    },
  })),
];
for (const definition of fieldDefinitions)
  if (["select", "multiSelect"].includes(definition.field.type)) {
    const labels = new Set<string>();
    for (const row of rows)
      for (const label of (row[definition.source] ?? "")
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean))
        labels.add(label);
    definition.field.options = [...labels].map((label) => ({
      id: label,
      label,
    }));
  }
const url = process.env.SLOPTION_URL ?? "http://localhost:5173";
async function invoke(name: string, input: unknown) {
  const response = await fetch(`${url}/api/actions/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.SLOPTION_API_KEY
        ? { Authorization: `Bearer ${process.env.SLOPTION_API_KEY}` }
        : {}),
      ...(process.env.SLOPTION_COOKIE
        ? { Cookie: process.env.SLOPTION_COOKIE }
        : {}),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`${name}: ${await response.text()}`);
  return response.json() as Promise<Record<string, unknown>>;
}
const uploaded = new Map<string, string>();
const warnings: string[] = [];
let matched = 0;
const titles = new Map<string, number>();
for (const row of rows)
  titles.set(row.Actividad!, (titles.get(row.Actividad!) ?? 0) + 1);
const cards: Card[] = [];
for (const [index, row] of rows.entries()) {
  const title = row.Actividad || "Sin título";
  const candidates = pages.get(title) ?? [];
  const page =
    candidates.length === 1 && titles.get(title) === 1
      ? candidates[0]
      : undefined;
  if (candidates.length > 1 || (candidates.length && titles.get(title)! > 1))
    warnings.push(`Ambiguous title, body not assigned: ${title}`);
  let markdown = "";
  if (page) {
    matched++;
    const lines = page.content.split("\n");
    let start = 2;
    while (start < lines.length && lines[start]!.trim() !== "") start++;
    markdown = lines.slice(start + 1).join("\n");
    const matches = [...markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
    for (const match of matches) {
      let target: string;
      try {
        target = posix.normalize(
          posix.join(posix.dirname(page.path), decodeURIComponent(match[2]!)),
        );
      } catch {
        continue;
      }
      const binary = assets.get(target);
      if (!binary) {
        if (!/^https?:/.test(match[2]!))
          warnings.push(`Missing image: ${target}`);
        continue;
      }
      if (!dryRun && !uploaded.has(target)) {
        const extension = target.split(".").at(-1)!.toLowerCase();
        const response = await invoke("asset.create", {
          name: posix.basename(target),
          mime:
            extension === "jpg" || extension === "jpeg"
              ? "image/jpeg"
              : `image/${extension}`,
          content: binary.toString("base64"),
        });
        uploaded.set(target, String(response.url));
      }
      if (!dryRun)
        markdown = markdown.replace(
          match[0],
          `![${match[1]}](${uploaded.get(target)})`,
        );
    }
  }
  const values: Card["values"] = {};
  for (const { source, field } of fieldDefinitions) {
    const text = row[source] ?? "";
    values[field.id] = !text
      ? null
      : field.type === "people"
        ? text
            .split(",")
            .map((name) => profileIds.get(name.trim()))
            .filter((id): id is string => !!id)
        : field.type === "multiSelect"
          ? text.split(",").map((label) => label.trim())
          : text;
  }
  cards.push({
    id: `notion-${page?.id ?? stableId(`${index}:${title}`)}`,
    title,
    markdown,
    document: null,
    values,
    weekly: row.Weekly === "esta semana",
    archived: false,
    rank: (index + 1) * 1024,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceId: page?.id ?? null,
    bodyMissing: !page,
  });
}
const report = {
  total: cards.length,
  matchedBodies: matched,
  missingBodies: cards.length - matched,
  profiles: profiles.map((profile) => profile.name),
  assets: assets.size,
  uploaded: uploaded.size,
  warnings,
};
console.log(JSON.stringify(report, null, 2));
if (!dryRun)
  console.log(
    JSON.stringify(
      await invoke("import.apply", {
        cards,
        profiles,
        fields: fieldDefinitions.map((definition) => definition.field),
      }),
      null,
      2,
    ),
  );
