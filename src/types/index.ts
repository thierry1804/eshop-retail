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