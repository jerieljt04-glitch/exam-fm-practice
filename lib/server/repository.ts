/**
 * Server data access, split by concern:
 *   sessions.ts   configuration, creation, in-progress view, autosave, submission
 *   history.ts    attempt history, remediation items, export, reset
 *   dashboard.ts  dashboard summary and session reports
 * This module re-exports them so existing imports keep working.
 */
import { REASONING_SKILLS, type ReasoningSkill } from "../engine/skills";

export * from "./sessions";
export * from "./history";
export * from "./dashboard";

export const ALL_SKILLS: readonly ReasoningSkill[] = REASONING_SKILLS;
