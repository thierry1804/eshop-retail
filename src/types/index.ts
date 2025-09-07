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

export interface Article {
  id: string;
  code: string;
  name: string;
  unit_price: number;
  created_at: string;
  created_by: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  article_id?: string;
  code: string;
  name: string;
  unit_price: number;
  quantity: number;
  total_amount: number;
  created_at: string;
  article?: Article;
}

export interface Delivery {
  id: string;
  sale_id: string;
  delivery_address: string;
  is_province: boolean;
  delivery_type: 'pickup' | 'delivery';
  delivery_fees: number;
  delivery_date: string;
  delivery_time?: string;
  created_at: string;
  created_by: string;
}

export interface Sale {
  id: string;
  client_id: string;
  description?: string; // Temporaire, sera supprimé plus tard
  total_amount: number;
  deposit: number;
  remaining_balance: number;
  status: 'ongoing' | 'paid';
  created_at: string;
  created_by: string;
  client?: Client;
  sale_items?: SaleItem[];
  delivery?: Delivery;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: 'cash' | 'mobile_money' | 'bank_transfer' | 'other';
  mobile_operator?: 'orange_money' | 'airtel_money' | 'mvola';
  transaction_reference?: string;
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

// Types pour les formulaires
export interface SaleItemForm {
  id?: string;
  article_id?: string;
  code: string;
  name: string;
  unit_price: number;
  quantity: number;
  total_amount: number;
}

export interface DeliveryForm {
  delivery_address: string;
  is_province: boolean;
  delivery_type: 'pickup' | 'delivery';
  delivery_fees: number;
  delivery_date: string;
  delivery_time?: string;
}

export interface PaymentForm {
  amount: number;
  payment_method: 'cash' | 'mobile_money' | 'bank_transfer' | 'other';
  mobile_operator?: 'orange_money' | 'airtel_money' | 'mvola';
  transaction_reference?: string;
  notes: string;
}