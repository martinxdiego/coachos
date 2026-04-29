export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AttendanceStatus = "present" | "absent";

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          position: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          position?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          position?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      training_sessions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          focus: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          focus: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          focus?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          user_id: string;
          opponent: string;
          date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          opponent: string;
          date: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          opponent?: string;
          date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          user_id: string;
          training_id: string;
          player_id: string;
          status: AttendanceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          training_id: string;
          player_id: string;
          status: AttendanceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          training_id?: string;
          player_id?: string;
          status?: AttendanceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_feedback: {
        Row: {
          id: string;
          user_id: string;
          player_id: string;
          rating: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          player_id: string;
          rating: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          player_id?: string;
          rating?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Player = Database["public"]["Tables"]["players"]["Row"];
export type TrainingSession =
  Database["public"]["Tables"]["training_sessions"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
export type PlayerFeedback =
  Database["public"]["Tables"]["player_feedback"]["Row"];
