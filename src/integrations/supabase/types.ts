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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          detail: string | null
          id: string
          status: string
          target: string | null
          tenant_id: string | null
          tenant_name: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          status?: string
          target?: string | null
          tenant_id?: string | null
          tenant_name?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          status?: string
          target?: string | null
          tenant_id?: string | null
          tenant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_request_logs: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          duration_ms: number | null
          error_detail: string | null
          http_status: number | null
          id: string
          method: string
          ok: boolean
          provider: Database["public"]["Enums"]["integration_provider"]
          request_payload: Json | null
          response_body: string | null
          tenant_id: string
          url: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          duration_ms?: number | null
          error_detail?: string | null
          http_status?: number | null
          id?: string
          method?: string
          ok?: boolean
          provider: Database["public"]["Enums"]["integration_provider"]
          request_payload?: Json | null
          response_body?: string | null
          tenant_id: string
          url: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          duration_ms?: number | null
          error_detail?: string | null
          http_status?: number | null
          id?: string
          method?: string
          ok?: boolean
          provider?: Database["public"]["Enums"]["integration_provider"]
          request_payload?: Json | null
          response_body?: string | null
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_request_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          auth_token: string | null
          auth_token_expires_at: string | null
          auth_token_obtained_at: string | null
          created_at: string
          credentials: Json
          enabled: boolean
          id: string
          last_partner_call_at: string | null
          last_test_at: string | null
          last_test_message: string | null
          last_test_ok: boolean | null
          provider: Database["public"]["Enums"]["integration_provider"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auth_token?: string | null
          auth_token_expires_at?: string | null
          auth_token_obtained_at?: string | null
          created_at?: string
          credentials?: Json
          enabled?: boolean
          id?: string
          last_partner_call_at?: string | null
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          provider: Database["public"]["Enums"]["integration_provider"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auth_token?: string | null
          auth_token_expires_at?: string | null
          auth_token_obtained_at?: string | null
          created_at?: string
          credentials?: Json
          enabled?: boolean
          id?: string
          last_partner_call_at?: string | null
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_tenant_admin: boolean
          papel_id: string | null
          ativo: boolean
          convidado_em: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_tenant_admin?: boolean
          papel_id?: string | null
          ativo?: boolean
          convidado_em?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_tenant_admin?: boolean
          papel_id?: string | null
          ativo?: boolean
          convidado_em?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          gateway_tenant_id: string | null
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
          mfa_obrigatorio: boolean
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          gateway_tenant_id?: string | null
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
          mfa_obrigatorio?: boolean
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          gateway_tenant_id?: string | null
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
          mfa_obrigatorio?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      papeis: {
        Row: {
          id: string
          empresa_id: string | null
          codigo: string
          nome: string
          nivel: number
          sistema: boolean
          escopo_unidades: string
          papel_gateway: string
          created_at: string
        }
        Insert: {
          id?: string
          empresa_id?: string | null
          codigo: string
          nome: string
          nivel: number
          sistema?: boolean
          escopo_unidades?: string
          papel_gateway: string
          created_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string | null
          codigo?: string
          nome?: string
          nivel?: number
          sistema?: boolean
          escopo_unidades?: string
          papel_gateway?: string
          created_at?: string
        }
        Relationships: []
      }
      usuario_unidades: {
        Row: {
          id: string
          tenant_user_id: string
          unidade_codigo: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_user_id: string
          unidade_codigo: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_user_id?: string
          unidade_codigo?: string
          created_at?: string
        }
        Relationships: []
      }
      conta_seguranca: {
        Row: {
          user_id: string
          prazo_ate: string | null
          emergencia: boolean
          ultimo_login_auditado: string | null
          atualizado_em: string
          codigos_recuperacao: string[]
          step_up_ate: string | null
          mfa_bloqueado_ate: string | null
          mfa_falhas: number
          mfa_falha_em: string | null
          recuperacao_valida_ate: string | null
        }
        Insert: {
          user_id: string
          prazo_ate?: string | null
          emergencia?: boolean
          ultimo_login_auditado?: string | null
          atualizado_em?: string
          codigos_recuperacao?: string[]
          step_up_ate?: string | null
          mfa_bloqueado_ate?: string | null
          mfa_falhas?: number
          mfa_falha_em?: string | null
          recuperacao_valida_ate?: string | null
        }
        Update: {
          user_id?: string
          prazo_ate?: string | null
          emergencia?: boolean
          ultimo_login_auditado?: string | null
          atualizado_em?: string
          codigos_recuperacao?: string[]
          step_up_ate?: string | null
          mfa_bloqueado_ate?: string | null
          mfa_falhas?: number
          mfa_falha_em?: string | null
          recuperacao_valida_ate?: string | null
        }
        Relationships: []
      }
      config_plataforma: {
        Row: {
          id: number
          mfa_desativado: boolean
          atualizado_em: string
          atualizado_por: string | null
        }
        Insert: {
          id?: number
          mfa_desativado?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
        }
        Update: {
          id?: number
          mfa_desativado?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
        }
        Relationships: []
      }
      entrada_tentativas: {
        Row: {
          chave: string
          falhas: number
          falha_em: string | null
          bloqueado_ate: string | null
          atualizado_em: string
        }
        Insert: {
          chave: string
          falhas?: number
          falha_em?: string | null
          bloqueado_ate?: string | null
          atualizado_em?: string
        }
        Update: {
          chave?: string
          falhas?: number
          falha_em?: string | null
          bloqueado_ate?: string | null
          atualizado_em?: string
        }
        Relationships: []
      }
      redefinicoes_senha: {
        Row: {
          id: string
          user_id: string
          token_hash: string
          expira_em: string
          usado_em: string | null
          revogado_em: string | null
          criado_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token_hash: string
          expira_em: string
          usado_em?: string | null
          revogado_em?: string | null
          criado_por?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token_hash?: string
          expira_em?: string
          usado_em?: string | null
          revogado_em?: string | null
          criado_por?: string | null
          created_at?: string
        }
        Relationships: []
      }
      convites: {
        Row: {
          id: string
          tenant_user_id: string
          token_hash: string
          expira_em: string
          usado_em: string | null
          revogado_em: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_user_id: string
          token_hash: string
          expira_em: string
          usado_em?: string | null
          revogado_em?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_user_id?: string
          token_hash?: string
          expira_em?: string
          usado_em?: string | null
          revogado_em?: string | null
          created_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_time: string | null
          event_type: string | null
          id: string
          order_id: string | null
          payload_original: Json
          platform: string
          received_at: string
          shop_id: string | null
          status_original: string | null
          tenant_id: string | null
        }
        Insert: {
          event_time?: string | null
          event_type?: string | null
          id?: string
          order_id?: string | null
          payload_original: Json
          platform: string
          received_at?: string
          shop_id?: string | null
          status_original?: string | null
          tenant_id?: string | null
        }
        Update: {
          event_time?: string | null
          event_type?: string | null
          id?: string
          order_id?: string | null
          payload_original?: Json
          platform?: string
          received_at?: string
          shop_id?: string | null
          status_original?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      fatores_verificados: {
        Args: { uid: string }
        Returns: number
      }
      derrubar_sessoes: {
        Args: { uid: string }
        Returns: undefined
      }
      derrubar_outras_sessoes: {
        Args: { uid: string; manter: string }
        Returns: undefined
      }
      sessao_aal: {
        Args: { sid: string }
        Returns: string
      }
      usuario_id_por_email: {
        Args: { alvo: string }
        Returns: string
      }
      revogar_tokens_de_convite: {
        Args: { uid: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "tenant_admin" | "tenant_user"
      integration_provider: "ifood" | "food99" | "whatsapp_official" | "uazapi"
      tenant_status: "active" | "suspended"
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
      app_role: ["super_admin", "tenant_admin", "tenant_user"],
      integration_provider: ["ifood", "food99", "whatsapp_official", "uazapi"],
      tenant_status: ["active", "suspended"],
    },
  },
} as const
