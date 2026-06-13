// Auto-generated type definitions mirroring supabase/schema.sql.
// Keep in sync if you alter the schema.

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          discord_user_id: string;
          discord_username: string;
          active: boolean;
          joined_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "joined_at"> & {
          id?: string;
          joined_at?: string;
        };
      };
      daily_checkins: {
        Row: {
          id: string;
          discord_user_id: string;
          date: string;
          mood: number;
          sleep_hours: number;
          energy: number;
          focus: number;
          trading_plan: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["daily_checkins"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
      };
      trades: {
        Row: {
          id: string;
          discord_user_id: string;
          date: string;
          pair: string;
          direction: string;
          entry: number;
          stop_loss: number;
          take_profit: number;
          risk_percent: number;
          result: string;
          screenshot_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["trades"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
      };
      goals: {
        Row: {
          id: string;
          goal_id: string;
          discord_user_id: string;
          goal_text: string;
          category: string;
          deadline: string;
          status: string;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["goals"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
      };
      discipline_logs: {
        Row: {
          id: string;
          discord_user_id: string;
          date: string;
          followed_plan: boolean;
          revenge_traded: boolean;
          overtraded: boolean;
          broke_risk_rules: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["discipline_logs"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          type: string;
          period_start: string;
          period_end: string;
          content: string;
          generated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reports"]["Row"], "id" | "generated_at"> & {
          id?: string;
          generated_at?: string;
        };
      };
      learning_sessions: {
        Row: {
          id: string;
          discord_user_id: string;
          topic: string | null;
          started_at: string;
          ended_at: string | null;
          duration_minutes: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["learning_sessions"]["Row"], "id" | "started_at" | "created_at"> & {
          id?: string;
          started_at?: string;
          created_at?: string;
        };
      };
    };
  };
}
