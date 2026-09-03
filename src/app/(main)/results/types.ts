import type { EventCategory, EventRow, ScoreRow } from "@/lib/database.types";

export interface ClassStanding {
  total: number;
  byCategory: Record<EventCategory, number>;
  details: { event: EventRow; score: ScoreRow }[];
}

export type ClassComputed = Map<string, ClassStanding>;
