export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'admin' | 'employee';
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          role?: 'admin' | 'employee';
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: 'admin' | 'employee';
          created_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          phone: string;
          address: string;
          trust_rating: 'good' | 'average' | 'poor';
          notes: string;
          tiktok_id: string | null;
          tiktok_nick_name: string | null;
          created_at: string;
          updated_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          phone: string;
          address: string;
          trust_rating?: 'good' | 'average' | 'poor';
          notes?: string;
          tiktok_id?: string | null;
          tiktok_nick_name?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          phone?: string;
          address?: string;
          trust_rating?: 'good' | 'average' | 'poor';
          notes?: string;
          tiktok_id?: string | null;
          tiktok_nick_name?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          client_id: string;
          description: string;
          total_amount: number;
          deposit: number;
          remaining_balance: number;
          status: 'ongoing' | 'paid';
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          description: string;
          total_amount: number;
          deposit?: number;
          remaining_balance?: number;
          status?: 'ongoing' | 'paid';
          created_at?: string;
          created_by?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          description?: string;
          total_amount?: number;
          deposit?: number;
          remaining_balance?: number;
          status?: 'ongoing' | 'paid';
          created_at?: string;
          created_by?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          sale_id: string;
          amount: number;
          payment_method: 'cash' | 'mobile_money' | 'bank_transfer' | 'other';
          notes: string;
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          amount: number;
          payment_method: 'cash' | 'mobile_money' | 'bank_transfer' | 'other';
          notes?: string;
          created_at?: string;
          created_by?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          amount?: number;
          payment_method?: 'cash' | 'mobile_money' | 'bank_transfer' | 'other';
          notes?: string;
          created_at?: string;
          created_by?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          user_id: string | null;
          amount: number;
          category_id: string | null;
          supplier_id: string | null;
          date: string;
          description: string | null;
          locked: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          amount: number;
          category_id?: string | null;
          supplier_id?: string | null;
          date?: string;
          description?: string | null;
          locked?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          amount?: number;
          category_id?: string | null;
          supplier_id?: string | null;
          date?: string;
          description?: string | null;
          locked?: boolean | null;
          created_at?: string | null;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string | null;
        };
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_info: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          contact_info?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          contact_info?: string | null;
          created_at?: string | null;
        };
      };
    };
  };
};
