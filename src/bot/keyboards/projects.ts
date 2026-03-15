import { InlineKeyboard } from "grammy";

const PROJECTS_PER_PAGE = 5;

export function projectsKeyboard(
  dirs: string[],
  activeDir: string | null,
  shortenDir: (dir: string) => string,
  page = 0,
): InlineKeyboard {
  const totalPages = Math.ceil(dirs.length / PROJECTS_PER_PAGE);
  const start = page * PROJECTS_PER_PAGE;
  const pageItems = dirs.slice(start, start + PROJECTS_PER_PAGE);

  const kb = new InlineKeyboard();

  for (const dir of pageItems) {
    const isCurrent = dir === activeDir;
    const prefix = isCurrent ? "\u2705 " : "";
    const shortDir = shortenDir(dir);
    kb.text(`${prefix}${shortDir}`, `project:select:${dir}`).row();
  }

  if (totalPages > 1) {
    if (page > 0) kb.text("\u25c0 Prev", `project:page:${page - 1}`);
    kb.text(`${page + 1}/${totalPages}`, "noop");
    if (page < totalPages - 1) kb.text("Next \u25b6", `project:page:${page + 1}`);
    kb.row();
  }

  return kb;
}
