export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'consultant' | 'marketing' | 'tech';

export type JourneyState =
  | 'compra'
  | 'diagnostico_enviado'
  | 'acompanhamento'
  | 'consulta_marcada'
  | 'consulta_concluida'
  | 'cancelamento'
  | 'reembolso';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          role?: UserRole;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          name: string;
          email: string;
          source: string;
          phone: string | null;
          document: string | null;
          country: string | null;
          zip_code: string | null;
          city: string | null;
          state: string | null;
          address: string | null;
          district: string | null;
          number: string | null;
          complement: string | null;
          status_journey: JourneyState;
          is_overdue: boolean;
          assigned_consultant_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          source?: string;
          phone?: string | null;
          document?: string | null;
          country?: string | null;
          zip_code?: string | null;
          city?: string | null;
          state?: string | null;
          address?: string | null;
          district?: string | null;
          number?: string | null;
          complement?: string | null;
          status_journey?: JourneyState;
          is_overdue?: boolean;
          assigned_consultant_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          source?: string;
          phone?: string | null;
          document?: string | null;
          country?: string | null;
          zip_code?: string | null;
          city?: string | null;
          state?: string | null;
          address?: string | null;
          district?: string | null;
          number?: string | null;
          complement?: string | null;
          status_journey?: JourneyState;
          is_overdue?: boolean;
          assigned_consultant_id?: string | null;
          updated_at?: string;
        };
      };
      purchases: {
        Row: {
          id: string;
          client_id: string;
          transaction_code: string;
          product_name: string;
          price_gross: number;
          price_net: number;
          status_hotmart: string;
          purchase_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          transaction_code: string;
          product_name: string;
          price_gross: number;
          price_net: number;
          status_hotmart: string;
          purchase_date: string;
          created_at?: string;
        };
        Update: {
          status_hotmart?: string;
        };
      };
      interactions: {
        Row: {
          id: string;
          client_id: string;
          consultant_id: string;
          channel: 'whatsapp' | 'email' | 'call' | 'other';
          summary: string;
          next_action: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          consultant_id: string;
          channel: 'whatsapp' | 'email' | 'call' | 'other';
          summary: string;
          next_action?: string | null;
          created_at?: string;
        };
        Update: {
          summary?: string;
          next_action?: string | null;
        };
      };
      commissions_config: {
        Row: {
          id: string;
          product_name: string;
          commission_percentage: number;
          fixed_amount: number;
          updated_by: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_name: string;
          commission_percentage?: number;
          fixed_amount?: number;
          updated_by: string;
          updated_at?: string;
        };
        Update: {
          commission_percentage?: number;
          fixed_amount?: number;
          updated_by?: string;
          updated_at?: string;
        };
      };
      commissions_log: {
        Row: {
          id: string;
          purchase_id: string;
          consultant_id: string;
          commission_amount: number;
          status_payment: 'pending' | 'paid' | 'cancelled';
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          consultant_id: string;
          commission_amount: number;
          status_payment?: 'pending' | 'paid' | 'cancelled';
          created_at?: string;
        };
        Update: {
          status_payment?: 'pending' | 'paid' | 'cancelled';
        };
      };
      events_log: {
        Row: {
          id: string;
          event_type: string;
          transaction_code: string | null;
          payload: Json;
          status_processing: 'pending' | 'processed' | 'error' | 'ignored_duplicate';
          error_message: string | null;
          received_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          transaction_code?: string | null;
          payload: Json;
          status_processing?: 'pending' | 'processed' | 'error' | 'ignored_duplicate';
          error_message?: string | null;
          received_at?: string;
        };
        Update: {
          status_processing?: 'pending' | 'processed' | 'error' | 'ignored_duplicate';
          error_message?: string | null;
        };
      };
    };
  };
}
