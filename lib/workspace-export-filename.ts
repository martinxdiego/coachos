export function workspaceExportFilename(
  workspaceName: string,
  generatedAt = new Date()
): string {
  const safeName =
    workspaceName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "workspace";
  const date = generatedAt.toISOString().slice(0, 10);
  return `coachos-${safeName}-${date}.json`;
}
