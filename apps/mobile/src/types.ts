export type UserRole = "SUPER_ADMIN" | "ADMIN" | "CLIENT" | "LIVREUR";

export type UserAccessStatus =
  | "ACTIVE"
  | "PENDING_APPROVAL"
  | "REJECTED"
  | "SUSPENDED";

export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  accessStatus: UserAccessStatus;
  requestedStoreName: string | null;
  requestedVehicle: string | null;
};

export type AuthResponse = {
  token: string | null;
  requiresApproval: boolean;
  message: string;
  user: AuthUser;
};

export type Product = {
  id: string;
  storeId?: string;
  name: string;
  description: string;
  category?: string;
  price: number;
  stock?: number;
  isAvailable?: boolean;
  imageUrl: string;
  isPopular?: boolean;
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
  adminName?: string | null;
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
  acceptedAt: string | null;
  refusedAt: string | null;
  adminNote: string | null;
  createdAt: string;
  etaMinutes: number;
  user: {
    id: string;
    name: string;
    email: string | null;
  };
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

export type AdminDashboardResponse = {
  store: {
    id: string;
    name: string;
    category: string;
  };
  stats: {
    totalOrders: number;
    pendingOrders: number;
    acceptedOrders: number;
    preparingOrders: number;
    onWayOrders: number;
    deliveredToday: number;
    refusedToday: number;
    revenueToday: number;
    productsCount: number;
    availableCouriers: number;
    busyCouriers: number;
    chart: Array<{
      label: string;
      orders: number;
    }>;
  };
};

export type AdminOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
  };
  courier: {
    id: string;
    name: string;
    vehicle: string;
    isAvailable: boolean;
  } | null;
};

export type Courier = {
  id: string;
  userId?: string | null;
  storeId?: string | null;
  name: string;
  rating: number;
  vehicle: string;
  lat: number;
  lng: number;
  isAvailable: boolean;
};

export type SuperAdminDashboard = {
  usersCount: number;
  storesCount: number;
  pendingApprovals: number;
  ordersToday: number;
  deliveredToday: number;
  usersByRole: Array<{
    role: UserRole;
    count: number;
  }>;
};

export type MeResponse = {
  user: AuthUser;
  managedStore?: {
    id: string;
    name: string;
    category: string;
  } | null;
  courierProfile?: {
    id: string;
    name: string;
    vehicle: string;
    isAvailable?: boolean;
  } | null;
};

export type LivreurOrdersResponse = {
  courier: {
    id: string;
    name: string;
    vehicle: string;
    isAvailable: boolean;
    store: {
      id: string;
      name: string;
    } | null;
  };
  orders: Array<{
    id: string;
    status: string;
    paymentStatus: string;
    total: number;
    createdAt: string;
    updatedAt: string;
    addressText: string;
    store: {
      id: string;
      name: string;
    };
  }>;
};
