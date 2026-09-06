/**
 * Resolution of step-by-step solution videos.
 *
 * Walkthrough videos are hosted outside this repository. Set
 * `NEXT_PUBLIC_SOLUTION_VIDEO_BASE_URL` to the embed base (for example a
 * Mux/Vimeo/YouTube embed prefix) and each template resolves to
 * `<base>/<template-slug>`. When the variable is unset, templates resolve to an
 * empty URL and the review player renders an explicit "not yet recorded" state
 * instead of a broken embed — the written KaTeX derivation is always present.
 */

const RAW_BASE = process.env.NEXT_PUBLIC_SOLUTION_VIDEO_BASE_URL ?? "";
const VIDEO_BASE = RAW_BASE.trim().replace(/\/+$/, "");

/** `LOAN_OUTSTANDING_BALANCE` -> `loan-outstanding-balance`. */
export function templateSlug(templateId: string): string {
  return templateId.toLowerCase().replace(/_/g, "-");
}

export function solutionVideoUrl(templateId: string): string {
  if (!VIDEO_BASE) return "";
  return `${VIDEO_BASE}/${templateSlug(templateId)}`;
}

export function hasVideoLibrary(): boolean {
  return VIDEO_BASE.length > 0;
}
