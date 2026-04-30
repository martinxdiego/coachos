export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AttendanceStatus = "present" | "absent";
export type TeamRole = "owner" | "head_coach" | "coach";
export type StrongFoot = "left" | "right" | "both";
export type PlayerStatus = "available" | "injured" | "limited" | "absent";
export type TrainingIntensity = "low" | "medium" | "high";
export type TrainingPhaseType =
  | "warmup"
  | "technique"
  | "tactics"
  | "game_form"
  | "finish"
  | "cooldown";
export type HomeAway = "home" | "away" | "neutral";
export type MaterialType =
  | "exercise_sheet"
  | "training_plan"
  | "match_plan"
  | "tactics_sheet"
  | "player_list"
  | "attendance_list"
  | "week_plan"
  | "month_plan";
export type TaskStatus = "open" | "done";

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          name: string;
          season: string | null;
          age_group: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          season?: string | null;
          age_group?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: TeamRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role: TeamRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_members"]["Insert"]>;
        Relationships: [];
      };
      team_invites: {
        Row: {
          id: string;
          team_id: string;
          code: string;
          role: Exclude<TeamRole, "owner">;
          created_by: string;
          used_by: string | null;
          used_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          code: string;
          role: Exclude<TeamRole, "owner">;
          created_by: string;
          used_by?: string | null;
          used_at?: string | null;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_invites"]["Insert"]>;
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          name: string;
          first_name: string | null;
          last_name: string | null;
          position: string | null;
          secondary_positions: string[] | null;
          birth_year: number | null;
          jersey_number: number | null;
          photo_url: string | null;
          strong_foot: StrongFoot | null;
          height_cm: number | null;
          weight_kg: number | null;
          contact: string | null;
          parent_contact: string | null;
          medical_notes: string | null;
          strengths: string | null;
          weaknesses: string | null;
          development_goals: string | null;
          training_notes: string | null;
          personal_notes: string | null;
          notes: string | null;
          status: PlayerStatus;
          rating: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          name: string;
          first_name?: string | null;
          last_name?: string | null;
          position?: string | null;
          secondary_positions?: string[] | null;
          birth_year?: number | null;
          jersey_number?: number | null;
          photo_url?: string | null;
          strong_foot?: StrongFoot | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          contact?: string | null;
          parent_contact?: string | null;
          medical_notes?: string | null;
          strengths?: string | null;
          weaknesses?: string | null;
          development_goals?: string | null;
          training_notes?: string | null;
          personal_notes?: string | null;
          notes?: string | null;
          status?: PlayerStatus;
          rating?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>;
        Relationships: [];
      };
      training_sessions: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          date: string;
          start_time: string | null;
          duration_minutes: number | null;
          location: string | null;
          focus: string;
          goal: string | null;
          age_group: string | null;
          intensity: TrainingIntensity | null;
          participants: string | null;
          notes: string | null;
          is_template: boolean;
          template_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          date: string;
          start_time?: string | null;
          duration_minutes?: number | null;
          location?: string | null;
          focus: string;
          goal?: string | null;
          age_group?: string | null;
          intensity?: TrainingIntensity | null;
          participants?: string | null;
          notes?: string | null;
          is_template?: boolean;
          template_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["training_sessions"]["Insert"]
        >;
        Relationships: [];
      };
      training_phases: {
        Row: {
          id: string;
          team_id: string;
          training_id: string;
          phase_type: TrainingPhaseType;
          title: string;
          duration_minutes: number | null;
          description: string | null;
          coaching_points: string | null;
          organization: string | null;
          material: string | null;
          player_count: string | null;
          field_size: string | null;
          variations: string | null;
          load_management: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          training_id: string;
          phase_type: TrainingPhaseType;
          title: string;
          duration_minutes?: number | null;
          description?: string | null;
          coaching_points?: string | null;
          organization?: string | null;
          material?: string | null;
          player_count?: string | null;
          field_size?: string | null;
          variations?: string | null;
          load_management?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["training_phases"]["Insert"]
        >;
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          opponent: string;
          date: string;
          kickoff_time: string | null;
          location: string | null;
          home_away: HomeAway | null;
          meeting_point: string | null;
          squad_notes: string | null;
          starting_lineup: string | null;
          substitutes: string | null;
          formation: string | null;
          tactical_instructions: string | null;
          match_goals: string | null;
          pre_match_notes: string | null;
          halftime_notes: string | null;
          post_match_notes: string | null;
          result: string | null;
          scorers: string | null;
          assists: string | null;
          cards: string | null;
          player_ratings: Json;
          conclusion: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          opponent: string;
          date: string;
          kickoff_time?: string | null;
          location?: string | null;
          home_away?: HomeAway | null;
          meeting_point?: string | null;
          squad_notes?: string | null;
          starting_lineup?: string | null;
          substitutes?: string | null;
          formation?: string | null;
          tactical_instructions?: string | null;
          match_goals?: string | null;
          pre_match_notes?: string | null;
          halftime_notes?: string | null;
          post_match_notes?: string | null;
          result?: string | null;
          scorers?: string | null;
          assists?: string | null;
          cards?: string | null;
          player_ratings?: Json;
          conclusion?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          training_id: string;
          player_id: string;
          status: AttendanceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          training_id: string;
          player_id: string;
          status: AttendanceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Insert"]>;
        Relationships: [];
      };
      player_feedback: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          player_id: string;
          rating: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          player_id: string;
          rating: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["player_feedback"]["Insert"]
        >;
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          type: MaterialType;
          title: string;
          description: string | null;
          content: string | null;
          print_settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          type: MaterialType;
          title: string;
          description?: string | null;
          content?: string | null;
          print_settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["materials"]["Insert"]>;
        Relationships: [];
      };
      tactic_boards: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          title: string;
          description: string | null;
          elements: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          title: string;
          description?: string | null;
          elements?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["tactic_boards"]["Insert"]
        >;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          title: string;
          status: TaskStatus;
          due_date: string | null;
          related_type: string | null;
          related_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          title: string;
          status?: TaskStatus;
          due_date?: string | null;
          related_type?: string | null;
          related_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          related_type: string | null;
          related_id: string | null;
          title: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          related_type?: string | null;
          related_id?: string | null;
          title?: string | null;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_team_role: {
        Args: {
          target_team_id: string;
          allowed_roles: string[];
        };
        Returns: boolean;
      };
      is_team_member: {
        Args: {
          target_team_id: string;
        };
        Returns: boolean;
      };
      join_team_with_invite: {
        Args: {
          invite_code: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type TeamMember =
  Database["public"]["Tables"]["team_members"]["Row"];
export type TeamInvite =
  Database["public"]["Tables"]["team_invites"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];
export type TrainingSession =
  Database["public"]["Tables"]["training_sessions"]["Row"];
export type TrainingPhase =
  Database["public"]["Tables"]["training_phases"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
export type PlayerFeedback =
  Database["public"]["Tables"]["player_feedback"]["Row"];
export type Material = Database["public"]["Tables"]["materials"]["Row"];
export type TacticBoard =
  Database["public"]["Tables"]["tactic_boards"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
