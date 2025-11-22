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
  modules: string[];
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_info?: string;
  modules: string[];
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

// Types pour le module de gestion des stocks
export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  category_id?: string;
  supplier_id?: string;
  unit: string;
  weight?: number;
  dimensions?: string;
  min_stock_level: number;
  max_stock_level?: number;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  status: 'active' | 'inactive' | 'discontinued';
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
  category?: Category;
  supplier?: Supplier;
  prices?: ProductPrice[];
  stock_movements?: StockMovement[];
}

export interface ProductPrice {
  id: string;
  product_id: string;
  price_type: 'retail' | 'wholesale' | 'distributor' | 'reseller';
  price: number;
  currency: string;
  valid_from: string;
  valid_to?: string;
  is_active: boolean;
  created_at: string;
  created_by: string;
  product?: Product;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  reference_type?: 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'return';
  reference_id?: string;
  reason?: string;
  notes?: string;
  created_at: string;
  created_by: string;
  product?: Product;
}

export interface StockAlert {
  id: string;
  product_id: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'overstock';
  threshold_value: number;
  current_value: number;
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  product?: Product;
}

// Types pour le module de gestion des livraisons
export interface Delivery {
  id: string;
  delivery_number: string;
  client_id: string;
  sale_id?: string;
  delivery_date: string;
  expected_delivery_date?: string;
  status: 'pending' | 'preparing' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  delivery_method: 'pickup' | 'home_delivery' | 'express' | 'standard';
  delivery_address: string;
  delivery_notes?: string;
  tracking_number?: string;
  delivery_cost: number;
  delivery_fee: number;
  total_weight?: number;
  total_volume?: number;
  driver_name?: string;
  driver_phone?: string;
  vehicle_info?: string;
  delivered_at?: string;
  created_at: string;
  created_by: string;
  updated_by?: string;
  updated_at?: string;
  clients?: Client;
  sales?: Sale;
  delivery_items?: DeliveryItem[];
  delivery_events?: DeliveryEvent[];
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  weight?: number;
  notes?: string;
  created_at: string;
  product?: Product;
}

export interface DeliveryEvent {
  id: string;
  delivery_id: string;
  event_type: 'created' | 'preparing' | 'dispatched' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  event_date: string;
  location?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  delivery?: Delivery;
}

export interface DeliveryZone {
  id: string;
  name: string;
  description?: string;
  delivery_fee: number;
  estimated_delivery_time: number; // en heures
  is_active: boolean;
  created_at: string;
  created_by: string;
}

// Types pour l'approvisionnement
export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_id?: string;
  supplier_name?: string;
  status: 'draft' | 'pending' | 'ordered' | 'partial' | 'received' | 'cancelled';
  order_date: string;
  expected_delivery_date?: string;
  total_amount: number;
  currency: string;
  tracking_number?: string;
  notes?: string;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  purchase_order_items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  purchase_order_id: string;
  supplier_id?: string;
  supplier_name?: string;
  receipt_date: string;
  status: 'draft' | 'partial' | 'complete';
  total_amount: number;
  currency: string;
  notes?: string;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  purchase_order_item_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  quantity_received: number;
  unit_price: number;
  total_price: number;
  batch_number?: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryStats {
  total_deliveries: number;
  pending_deliveries: number;
  in_transit_deliveries: number;
  delivered_today: number;
  failed_deliveries: number;
  total_delivery_cost: number;
  average_delivery_time: number;
}

// Types pour les messages TikTok Live
export interface TikTokMessage {
  type: 'chat' | 'stats' | 'streamEnd' | 'error';
  data?: {
    uniqueId?: string;
    nickname?: string;
    comment?: string;
    timestamp?: number;
    viewers?: number;
    likes?: number;
    avatarUrl?: string;
    profilePicture?: string;
    avatar?: string;
  };
}