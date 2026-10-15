export type Role = "teacher" | "admin" | "super_admin";
export type ScoringType = "rank" | "pass_fail" | "direct" | "tier";

export interface TierOption {
  label: string;
  points: number;
}
export type ScoreStatus = "draft" | "final";

export interface School {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  school_id: string | null;
  must_change_password: boolean;
  created_at: string;
}

export interface ClassRow {
  id: string;
  school_id: string;
  grade: 1 | 2 | 3;
  class_no: number;
  created_at: string;
}

export interface EventRow {
  id: string;
  school_id: string;
  name: string;
  category: string;
  scoring_type: ScoringType;
  point_table: Record<string, number>;
  pass_points: number;
  max_points: number;
  order_index: number;
  is_active: boolean;
  is_locked: boolean;
  grades: number[];
  tier_options: TierOption[];
  created_at: string;
}

export interface ScoreRow {
  id: string;
  school_id: string;
  event_id: string;
  class_id: string;
  rank_value: number | null;
  pass_value: boolean | null;
  direct_value: number | null;
  tier_index: number | null;
  bonus_points: number;
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
  school_id: string;
  score_id: string;
  event_id: string;
  class_id: string;
  action: "create" | "update" | "final_submit" | "unlock" | "admin_edit" | "delete";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
}

export interface AppSettings {
  school_id: string;
  rankings_visible: boolean;
  cheer_results_visible: boolean;
  org_name: string;
  logo_url: string;
  timetable_url: string;
  weather_lat: number;
  weather_lon: number;
  weather_location_name: string;
  updated_at: string;
}

export interface CheerAward {
  id: string;
  school_id: string;
  class_id: string;
  points: number;
  awarded_by: string | null;
  awarded_at: string;
}

export interface EventLocation {
  id: string;
  school_id: string;
  name: string;
  emoji: string;
  order_index: number;
  created_at: string;
}

export interface AppSecrets {
  school_id: string;
  public_results_token: string;
}

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: School;
        Insert: Partial<School> & { slug: string; name: string };
        Update: Partial<School>;
        Relationships: [];
      };
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
          category: string;
          scoring_type: ScoringType;
        };
        Update: Partial<EventRow>;
        Relationships: [];
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
      app_settings: {
        Row: AppSettings;
        Insert: Partial<AppSettings> & { school_id: string };
        Update: Partial<AppSettings>;
        Relationships: [];
      };
      cheer_awards: {
        Row: CheerAward;
        Insert: Partial<CheerAward> & { class_id: string; points: number };
        Update: Partial<CheerAward>;
        Relationships: [];
      };
      event_locations: {
        Row: EventLocation;
        Insert: Partial<EventLocation> & { name: string };
        Update: Partial<EventLocation>;
        Relationships: [];
      };
      app_secrets: {
        Row: AppSecrets;
        Insert: Partial<AppSecrets> & { school_id: string };
        Update: Partial<AppSecrets>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
