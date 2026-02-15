export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isPopular?: boolean;
};

export type UserRole = "CUSTOMER" | "COURIER" | "ADMIN";

export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type StoreSummary = {
  id: string;
  name: string;
  category: string;
  description: string;
  rating: number;
  etaMinutes: number;
  deliveryFee: number;
  imageUrl: string;
  highlightProducts?: Array<{
    id: string;
    name: string;
    price: number;
    imageUrl: string;
  }>;
  productsPreview?: Array<{
    id: string;
    name: string;
    price: number;
    imageUrl: string;
  }>;
};

export type HomeResponse = {
  hero: {
    title: string;
    subtitle: string;
  };
  categories: string[];
  stores: StoreSummary[];
};

export type StoreDetails = {
  id: string;
  name: string;
  category: string;
  description: string;
  rating: number;
  etaMinutes: number;
  deliveryFee: number;
  imageUrl: string;
  products: Product[];
};

export type GuestAuthResponse = AuthResponse;

export type CreateOrderPayload = {
  userId?: string;
  customerName?: string;
  customerPhone?: string;
  storeId: string;
  addressText: string;
  addressLat: number;
  addressLng: number;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

export type CreateOrderResponse = {
  id: string;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  paymentRequired: boolean;
  etaMinutes: number;
  store: {
    id: string;
    name: string;
  };
  courier: {
    id: string;
    name: string;
    vehicle: string;
    rating: number;
  } | null;
  totals: {
    subtotal: number;
    deliveryFee: number;
    total: number;
  };
};

export type PaymentResponse = {
  orderId: string;
  paymentStatus: string;
  paymentIntentId: string | null;
  provider: "CARD" | "APPLE_PAY" | "GOOGLE_PAY";
  cardLast4: string | null;
  status: string;
};

export type OrderDetails = {
  id: string;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  paymentIntentId: string | null;
  paidAt: string | null;
  createdAt: string;
  etaMinutes: number;
  store: {
    id: string;
    name: string;
    imageUrl: string;
  };
  courier: {
    id: string;
    name: string;
    vehicle: string;
    rating: number;
  } | null;
  address: {
    text: string;
    lat: number;
    lng: number;
  };
  items: Array<{
    id: string;
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    imageUrl: string;
  }>;
  totals: {
    subtotal: number;
    deliveryFee: number;
    total: number;
  };
  timeline: Array<{
    id: string;
    status: string;
    label: string;
    timestamp: string;
  }>;
};

export type TrackingResponse = {
  orderId: string;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  etaMinutes: number;
  courier: {
    id: string;
    name: string;
    vehicle: string;
    rating: number;
  } | null;
  pickup: {
    lat: number;
    lng: number;
    name: string;
  };
  destination: {
    lat: number;
    lng: number;
    text: string;
  };
  position: {
    lat: number;
    lng: number;
  };
};
