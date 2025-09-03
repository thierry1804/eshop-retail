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
    };
  };
};
