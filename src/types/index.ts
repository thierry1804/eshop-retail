export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'employee';
  created_at: string;
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  trust_rating: 'good' | 'average' | 'poor';
  notes: string;
  tiktok_id?: string;
  tiktok_nick_name?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Sale {
  id: string;
  client_id: string;
  description: string;
  total_amount: number;
  deposit: number;
  remaining_balance: number;
  status: 'ongoing' | 'paid';
  created_at: string;
  created_by: string;
  client?: Client;
  payments?: Payment[];
  total_payments?: number;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: 'cash' | 'mobile_money' | 'bank_transfer' | 'other';
  notes: string;
  created_at: string;
  created_by: string;
  sale?: Sale;
}

export interface DashboardStats {
  total_sales: number;
  cash_sales: number;
  credit_sales: number;
  total_payments: number;
  outstanding_debt: number;
  total_clients: number;
}

export interface ClientWithSales extends Client {
  sales?: Sale[];
  total_purchases: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_info?: string;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category_id?: string;
  supplier_id?: string;
  date: string;
  description?: string;
  locked: boolean;
  created_at: string;
  created_by?: string;
  updated_by?: string;
  updated_at?: string;
  deleted_by?: string;
  deleted_at?: string;
  category?: Category;
  supplier?: Supplier;
  created_by_user?: User;
  updated_by_user?: User;
  deleted_by_user?: User;
}