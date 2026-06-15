// S6.2: Vereins-spezifische Begriffe sind pro Workspace konfigurierbar.
//
// Die neutralen Standardbegriffe (Teampunkte / Auszeichnungen / Vereinslinks)
// stehen in den i18n-Katalogen. Hat ein Workspace eigene Begriffe gesetzt,
// überlagern wir damit die betroffenen Katalog-Keys — so ziehen Navigation und
// Seitentitel automatisch nach, ohne dass Props durch die Komponenten gefädelt
// werden müssen. NULL = neutralen Default verwenden (neue Workspaces).

interface LabelWorkspace {
  pointsLabel?: string | null;
  awardsLabel?: string | null;
  linksLabel?: string | null;
}

export interface WorkspaceLabelOverrides {
  nav: Record<string, string>;
  pages: Record<string, string>;
}

/**
 * Baut das i18n-Overlay für die individuellen Begriffe eines Workspaces.
 * Gibt `null` zurück, wenn keine eigenen Begriffe gesetzt sind (dann gelten
 * die neutralen Katalog-Defaults).
 */
export function workspaceLabelOverrides(
  workspace: LabelWorkspace | null | undefined
): WorkspaceLabelOverrides | null {
  if (!workspace) return null;

  const nav: Record<string, string> = {};
  const pages: Record<string, string> = {};

  if (workspace.pointsLabel) {
    nav.winnerpoints = workspace.pointsLabel;
    pages.points_title = workspace.pointsLabel;
  }
  if (workspace.awardsLabel) {
    nav.awards = workspace.awardsLabel;
    pages.awards_title = workspace.awardsLabel;
  }
  if (workspace.linksLabel) {
    nav.clubcorner = workspace.linksLabel;
    pages.clubcorner_title = workspace.linksLabel;
  }

  if (Object.keys(nav).length === 0) return null;
  return { nav, pages };
}
