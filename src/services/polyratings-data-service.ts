import { courseTitle, normalizeCourseCode } from "../data/course-crosswalk";
import type { CourseOffering, Professor } from "../models/professor";
import {
  toProfessor,
  type PolyratingsReply,
  type PolyratingsRequest,
  type RawProfessor,
  type RawTruncatedProfessor,
} from "./polyratings-api";
import type { ProfessorDataService } from "./professor-data-service";

async function request<T>(message: PolyratingsRequest): Promise<T> {
  const reply = (await chrome.runtime.sendMessage(message)) as PolyratingsReply<T> | undefined;
  if (!reply) throw new Error("No reply from the PolyProf background worker");
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

/**
 * Derives course offerings from the professors who have taught each course,
 * since PolyRatings stores no term or section data. Codes are normalized and
 * titled from the catalog crosswalk where possible.
 */
function toCourseOfferings(professors: Professor[]): CourseOffering[] {
  const byCode = new Map<string, Set<string>>();
  for (const professor of professors) {
    for (const rawCode of professor.courses) {
      const code = normalizeCourseCode(rawCode);
      if (!code) continue;
      const existing = byCode.get(code);
      if (existing) existing.add(professor.id);
      else byCode.set(code, new Set([professor.id]));
    }
  }

  return [...byCode.entries()]
    .map(([code, professorIds]) => ({
      code,
      title: courseTitle(code) ?? code,
      department: code.split(" ")[0],
      term: "",
      professorIds: [...professorIds],
    }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

export const polyratingsDataService: ProfessorDataService = {
  async getProfessorResults(): Promise<Professor[]> {
    const index = await request<RawTruncatedProfessor[]>({ type: "professorIndex" });
    return index.map(toProfessor);
  },

  async getCourseOfferings(): Promise<CourseOffering[]> {
    return toCourseOfferings(await this.getProfessorResults());
  },

  async getProfessorDetail(id: string): Promise<Professor> {
    return toProfessor(await request<RawProfessor>({ type: "professorDetail", id }));
  },
};
