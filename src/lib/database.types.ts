export type Role = "teacher" | "admin";
export type EventCategory = "relay" | "minigame" | "cheer";
export type ScoringType = "rank" | "pass_fail" | "direct";
export type ScoreStatus = "draft" | "final";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  must_change_password: boolean;
  created_at: string;
}

export interface ClassRow {
  id: string;
  grade: 1 | 2 | 3;
  class_no: number;
  created_at: string;
}

export interface EventRow {
  id: string;
  name: string;
  category: EventCategory;
  scoring_type: ScoringType;
  point_table: Record<string, number>;
  pass_points: number;
  max_points: number;
  order_index: number;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
}

export interface EventAssignment {
  id: string;
  event_id: string;
  teacher_id: string;
  created_at: string;
}

export interface ScoreRow {
  id: string;
  event_id: string;
  class_id: string;
  rank_value: number | null;
  pass_value: boolean | null;
  direct_value: number | null;
  computed_points: number;
  status: ScoreStatus;
  submitted_by: string | null;
  updated_by: string | null;
  final_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface ScoreAuditLog {
  id: string;
  score_id: string;
  event_id: string;
  class_id: string;
  action: "create" | "update" | "final_submit" | "unlock" | "admin_edit";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; email: string; name: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      classes: {
        Row: ClassRow;
        Insert: Partial<ClassRow> & { grade: 1 | 2 | 3; class_no: number };
        Update: Partial<ClassRow>;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: Partial<EventRow> & {
          name: string;
          category: EventCategory;
          scoring_type: ScoringType;
        };
        Update: Partial<EventRow>;
        Relationships: [];
      };
      event_assignments: {
        Row: EventAssignment;
        Insert: Partial<EventAssignment> & { event_id: string; teacher_id: string };
        Update: Partial<EventAssignment>;
        Relationships: [
          {
            foreignKeyName: "event_assignments_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      scores: {
        Row: ScoreRow;
        Insert: Partial<ScoreRow> & { event_id: string; class_id: string };
        Update: Partial<ScoreRow>;
        Relationships: [];
      };
      score_audit_log: {
        Row: ScoreAuditLog;
        Insert: Partial<ScoreAuditLog>;
        Update: Partial<ScoreAuditLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
