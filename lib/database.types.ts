export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          at: string
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      cast_members: {
        Row: {
          acting_category: Database["public"]["Enums"]["acting_category"] | null
          film_id: string
          id: string
          is_evaluated: boolean
          role_name: string | null
          sort_order: number
          student_name: string
        }
        Insert: {
          acting_category?:
            | Database["public"]["Enums"]["acting_category"]
            | null
          film_id: string
          id?: string
          is_evaluated?: boolean
          role_name?: string | null
          sort_order?: number
          student_name: string
        }
        Update: {
          acting_category?:
            | Database["public"]["Enums"]["acting_category"]
            | null
          film_id?: string
          id?: string
          is_evaluated?: boolean
          role_name?: string | null
          sort_order?: number
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cast_members_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          acting_category: Database["public"]["Enums"]["acting_category"] | null
          award_order: number
          code: string
          edition_id: string
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          name_en: string
          name_pt: string
        }
        Insert: {
          acting_category?:
            | Database["public"]["Enums"]["acting_category"]
            | null
          award_order: number
          code: string
          edition_id: string
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          name_en: string
          name_pt: string
        }
        Update: {
          acting_category?:
            | Database["public"]["Enums"]["acting_category"]
            | null
          award_order?: number
          code?: string
          edition_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name_en?: string
          name_pt?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      ceremonies: {
        Row: {
          audience: string | null
          code_prefix: string
          edition_id: string
          ends_at: string | null
          id: string
          name: string
          short_name: string
          sort_order: number
          starts_at: string | null
          voting_closed_at: string | null
          voting_opened_at: string | null
          voting_status: Database["public"]["Enums"]["voting_status"]
        }
        Insert: {
          audience?: string | null
          code_prefix: string
          edition_id: string
          ends_at?: string | null
          id?: string
          name: string
          short_name: string
          sort_order?: number
          starts_at?: string | null
          voting_closed_at?: string | null
          voting_opened_at?: string | null
          voting_status?: Database["public"]["Enums"]["voting_status"]
        }
        Update: {
          audience?: string | null
          code_prefix?: string
          edition_id?: string
          ends_at?: string | null
          id?: string
          name?: string
          short_name?: string
          sort_order?: number
          starts_at?: string | null
          voting_closed_at?: string | null
          voting_opened_at?: string | null
          voting_status?: Database["public"]["Enums"]["voting_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ceremonies_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          ceremony_id: string | null
          created_at: string
          failed_attempts: number
          id: string
          label: string
          last_seen_at: string | null
          locked_until: string | null
          pairing_code_hash: string | null
          pairing_expires_at: string | null
          revoked_at: string | null
          token_hash: string | null
        }
        Insert: {
          ceremony_id?: string | null
          created_at?: string
          failed_attempts?: number
          id?: string
          label: string
          last_seen_at?: string | null
          locked_until?: string | null
          pairing_code_hash?: string | null
          pairing_expires_at?: string | null
          revoked_at?: string | null
          token_hash?: string | null
        }
        Update: {
          ceremony_id?: string | null
          created_at?: string
          failed_attempts?: number
          id?: string
          label?: string
          last_seen_at?: string | null
          locked_until?: string | null
          pairing_code_hash?: string | null
          pairing_expires_at?: string | null
          revoked_at?: string | null
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremonies"
            referencedColumns: ["id"]
          },
        ]
      }
      editions: {
        Row: {
          created_at: string
          event_date: string | null
          gallery_enabled: boolean
          id: string
          is_active: boolean
          juror_email_domain: string
          jury_status: Database["public"]["Enums"]["jury_status"]
          name: string
          venue: string | null
          year: number
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          gallery_enabled?: boolean
          id?: string
          is_active?: boolean
          juror_email_domain?: string
          jury_status?: Database["public"]["Enums"]["jury_status"]
          name: string
          venue?: string | null
          year: number
        }
        Update: {
          created_at?: string
          event_date?: string | null
          gallery_enabled?: boolean
          id?: string
          is_active?: boolean
          juror_email_domain?: string
          jury_status?: Database["public"]["Enums"]["jury_status"]
          name?: string
          venue?: string | null
          year?: number
        }
        Relationships: []
      }
      films: {
        Row: {
          ceremony_id: string
          class_name: string | null
          created_at: string
          drive_file_id: string | null
          duration_ms: number | null
          id: string
          is_public: boolean
          md5: string | null
          poster_path: string | null
          screening_order: number
          size_bytes: number | null
          synopsis: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ceremony_id: string
          class_name?: string | null
          created_at?: string
          drive_file_id?: string | null
          duration_ms?: number | null
          id?: string
          is_public?: boolean
          md5?: string | null
          poster_path?: string | null
          screening_order?: number
          size_bytes?: number | null
          synopsis?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ceremony_id?: string
          class_name?: string | null
          created_at?: string
          drive_file_id?: string | null
          duration_ms?: number | null
          id?: string
          is_public?: boolean
          md5?: string | null
          poster_path?: string | null
          screening_order?: number
          size_bytes?: number | null
          synopsis?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "films_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremonies"
            referencedColumns: ["id"]
          },
        ]
      }
      jurors: {
        Row: {
          created_at: string
          edition_id: string
          email: string
          id: string
          name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          edition_id: string
          email: string
          id?: string
          name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          edition_id?: string
          email?: string
          id?: string
          name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jurors_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          cast_member_id: string | null
          category_id: string
          film_id: string
          id: string
          juror_id: string
          updated_at: string
          value: number
        }
        Insert: {
          cast_member_id?: string | null
          category_id: string
          film_id: string
          id?: string
          juror_id: string
          updated_at?: string
          value: number
        }
        Update: {
          cast_member_id?: string | null
          category_id?: string
          film_id?: string
          id?: string
          juror_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "scores_cast_member_id_fkey"
            columns: ["cast_member_id"]
            isOneToOne: false
            referencedRelation: "cast_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_juror_id_fkey"
            columns: ["juror_id"]
            isOneToOne: false
            referencedRelation: "jurors"
            referencedColumns: ["id"]
          },
        ]
      }
      soundtrack_tracks: {
        Row: {
          ceremony_id: string | null
          created_at: string
          cue: Database["public"]["Enums"]["soundtrack_cue"]
          edition_id: string
          file_name: string | null
          id: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          ceremony_id?: string | null
          created_at?: string
          cue: Database["public"]["Enums"]["soundtrack_cue"]
          edition_id: string
          file_name?: string | null
          id?: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          ceremony_id?: string | null
          created_at?: string
          cue?: Database["public"]["Enums"]["soundtrack_cue"]
          edition_id?: string
          file_name?: string | null
          id?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "soundtrack_tracks_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremonies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soundtrack_tracks_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          email: string
          id: string
          name: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string | null
        }
        Insert: {
          email: string
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string | null
        }
        Update: {
          email?: string
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string | null
        }
        Relationships: []
      }
      tiebreak_votes: {
        Row: {
          choice_ref: string
          created_at: string
          juror_id: string
          tiebreak_id: string
        }
        Insert: {
          choice_ref: string
          created_at?: string
          juror_id: string
          tiebreak_id: string
        }
        Update: {
          choice_ref?: string
          created_at?: string
          juror_id?: string
          tiebreak_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiebreak_votes_juror_id_fkey"
            columns: ["juror_id"]
            isOneToOne: false
            referencedRelation: "jurors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiebreak_votes_tiebreak_id_fkey"
            columns: ["tiebreak_id"]
            isOneToOne: false
            referencedRelation: "tiebreaks"
            referencedColumns: ["id"]
          },
        ]
      }
      tiebreaks: {
        Row: {
          category_id: string
          ceremony_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          method: Database["public"]["Enums"]["tiebreak_method"] | null
          status: Database["public"]["Enums"]["tiebreak_status"]
          tied_refs: Json
          winner_ref: string | null
        }
        Insert: {
          category_id: string
          ceremony_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["tiebreak_method"] | null
          status?: Database["public"]["Enums"]["tiebreak_status"]
          tied_refs: Json
          winner_ref?: string | null
        }
        Update: {
          category_id?: string
          ceremony_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["tiebreak_method"] | null
          status?: Database["public"]["Enums"]["tiebreak_status"]
          tied_refs?: Json
          winner_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiebreaks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiebreaks_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremonies"
            referencedColumns: ["id"]
          },
        ]
      }
      vote_codes: {
        Row: {
          batch: Database["public"]["Enums"]["vote_batch"]
          ceremony_id: string
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          used_device_id: string | null
        }
        Insert: {
          batch: Database["public"]["Enums"]["vote_batch"]
          ceremony_id: string
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_device_id?: string | null
        }
        Update: {
          batch?: Database["public"]["Enums"]["vote_batch"]
          ceremony_id?: string
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_device_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vote_codes_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremonies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vote_codes_used_device_id_fkey"
            columns: ["used_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          ceremony_id: string
          created_at: string
          device_id: string | null
          film_id: string
          id: string
        }
        Insert: {
          ceremony_id: string
          created_at?: string
          device_id?: string | null
          film_id: string
          id?: string
        }
        Update: {
          ceremony_id?: string
          created_at?: string
          device_id?: string | null
          film_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_ceremony_id_fkey"
            columns: ["ceremony_id"]
            isOneToOne: false
            referencedRelation: "ceremonies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_edition_id: { Args: never; Returns: string }
      cast_vote: {
        Args: { p_code_hash: string; p_film: string; p_token_hash: string }
        Returns: string
      }
      check_code: {
        Args: { p_code_hash: string; p_token_hash: string }
        Returns: string
      }
      current_app_role: { Args: never; Returns: string }
      current_juror_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      link_current_user: { Args: never; Returns: string }
      log_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity: string
          p_entity_id: string
        }
        Returns: undefined
      }
      urna_register_failure: { Args: { p_device: string }; Returns: undefined }
    }
    Enums: {
      acting_category: "actress" | "actor"
      category_kind: "film" | "acting" | "public"
      jury_status: "open" | "closed"
      soundtrack_cue:
        | "abertura"
        | "bastidores"
        | "ambiente"
        | "suspense"
        | "fanfarra"
        | "fanfarra_pc"
        | "encerramento"
      staff_role: "admin"
      tiebreak_method: "majority" | "casting_vote"
      tiebreak_status: "open" | "decided"
      vote_batch: "A" | "B" | "C" | "D"
      voting_status: "not_started" | "open" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acting_category: ["actress", "actor"],
      category_kind: ["film", "acting", "public"],
      jury_status: ["open", "closed"],
      soundtrack_cue: [
        "abertura",
        "bastidores",
        "ambiente",
        "suspense",
        "fanfarra",
        "fanfarra_pc",
        "encerramento",
      ],
      staff_role: ["admin"],
      tiebreak_method: ["majority", "casting_vote"],
      tiebreak_status: ["open", "decided"],
      vote_batch: ["A", "B", "C", "D"],
      voting_status: ["not_started", "open", "closed"],
    },
  },
} as const
