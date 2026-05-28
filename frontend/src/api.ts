import { Platform } from "react-native";

import type {
  AdminDashboardResponse,
  AdminOrder,
  AuthResponse,
  Courier,
  CreateOrderPayload,
  CreateOrderResponse,
  GuestAuthResponse,
  HomeResponse,
  LivreurOrdersResponse,
  MeResponse,
  NotificationsResponse,
  OrderDetails,
  PaymentMethodType,
  PaymentTransaction,
  PaymentResponse,
  Product,
  Ride,
  RideHomeResponse,
  RideOptionsResponse,
  RideSearchResponse,
  RideTrackingResponse,
  StoreDetails,
  SupportTicket,
  SuperAdminDashboard,
  TrackingResponse,
  UserPaymentMethod,
} from "./types";

const fallbackBaseUrl =
  Platform.OS === "android" ? "http://10.0.2.2:3333" : "http://localhost:3333";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? fallbackBaseUrl;
export const WS_BASE_URL = API_BASE_URL.replace(/^http/i, (protocol: string) =>
  protocol.toLowerCase() === "https" ? "wss" : "ws",
);

let authToken: string | null = null;
let refreshToken: string | null = null;

export const setAuthToken = (token: string | null): void => {
  authToken = token;
};

export const setRefreshToken = (token: string | null): void => {
  refreshToken = token;
};

export const getRideWsUrl = (rideId: string, token: string): string =>
  `${WS_BASE_URL}/ws/rides/${rideId}?token=${encodeURIComponent(token)}`;

export const getOrderWsUrl = (orderId: string, token: string): string =>
  `${WS_BASE_URL}/ws/orders/${orderId}?token=${encodeURIComponent(token)}`;

export const getAdminDashboardWsUrl = (token: string): string =>
  `${WS_BASE_URL}/ws/admin/dashboard?token=${encodeURIComponent(token)}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const rawBody = await response.text();
  const data = rawBody ? (JSON.parse(rawBody) as unknown) : null;

  if (!response.ok) {
    const errorMessage =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : "Erreur API";
    throw new Error(errorMessage);
  }

  return data as T;
}

export const api = {
  getHome: () => request<HomeResponse>("/home"),
  getStore: (storeId: string) => request<StoreDetails>(`/stores/${storeId}`),
  authGuest: (payload?: { name?: string; phone?: string }) =>
    request<GuestAuthResponse>("/auth/guest", {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }),
  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: "CLIENT" | "ADMIN" | "LIVREUR";
    requestedStoreName?: string;
    requestedVehicle?: string;
  }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => request<MeResponse>("/auth/me"),
  refresh: () =>
    request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
  logout: () =>
    request<{ success: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
  oauthGoogle: (payload: { providerToken: string; email: string; name: string }) =>
    request<AuthResponse>("/auth/oauth/google", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  oauthApple: (payload: { providerToken: string; email: string; name: string }) =>
    request<AuthResponse>("/auth/oauth/apple", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createOrder: (payload: CreateOrderPayload) =>
    request<CreateOrderResponse>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  payOrder: (
    orderId: string,
    payload?: {
      provider?: "CARD" | "APPLE_PAY" | "GOOGLE_PAY";
      cardLast4?: string;
    },
  ) =>
    request<PaymentResponse>(`/orders/${orderId}/pay`, {
      method: "POST",
      body: JSON.stringify(payload ?? { provider: "CARD", cardLast4: "4242" }),
    }),
  getOrder: (orderId: string) => request<OrderDetails>(`/orders/${orderId}`),
  getTracking: (orderId: string) =>
    request<TrackingResponse>(`/orders/${orderId}/tracking`),
  cancelOrder: (orderId: string) =>
    request<{ id: string; status: string; statusLabel: string }>(
      `/orders/${orderId}/cancel`,
      { method: "POST" },
    ),

  getAdminDashboard: () => request<AdminDashboardResponse>("/admin/dashboard"),
  getAdminStore: () =>
    request<{
      id: string;
      name: string;
      category: string;
      description: string;
      products: Product[];
      couriers: Courier[];
    }>("/admin/store"),
  getAdminOrders: () => request<AdminOrder[]>("/admin/orders"),
  adminDecideOrder: (
    orderId: string,
    payload: { decision: "accept" | "refuse"; courierId?: string; note?: string },
  ) =>
    request<{
      id: string;
      status: string;
      statusLabel: string;
      courierId?: string | null;
    }>(`/admin/orders/${orderId}/decision`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getAdminProducts: () => request<Product[]>("/admin/products"),
  createAdminProduct: (payload: {
    name: string;
    description: string;
    category: string;
    price: number;
    stock: number;
    isAvailable?: boolean;
    imageUrl: string;
    isPopular?: boolean;
  }) =>
    request<Product>("/admin/products", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAdminProduct: (
    productId: string,
    payload: Partial<{
      name: string;
      description: string;
      category: string;
      price: number;
      stock: number;
      isAvailable: boolean;
      imageUrl: string;
      isPopular: boolean;
    }>,
  ) =>
    request<Product>(`/admin/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteAdminProduct: (productId: string) =>
    request<void>(`/admin/products/${productId}`, {
      method: "DELETE",
    }),
  getAdminCouriers: () => request<Courier[]>("/admin/couriers"),
  associateAdminCourier: (payload: { livreurUserId: string; vehicle?: string }) =>
    request<Courier>("/admin/couriers/associate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  setCourierAvailability: (courierId: string, isAvailable: boolean) =>
    request<Courier>(`/admin/couriers/${courierId}/availability`, {
      method: "PATCH",
      body: JSON.stringify({ isAvailable }),
    }),

  getSuperAdminDashboard: () =>
    request<SuperAdminDashboard>("/super-admin/dashboard"),
  getSuperAdminPendingUsers: () =>
    request<
      Array<{
        id: string;
        name: string;
        email: string | null;
        role: "ADMIN" | "LIVREUR";
        accessStatus: "PENDING_APPROVAL";
        requestedStoreName: string | null;
        requestedVehicle: string | null;
      }>
    >("/super-admin/pending-users"),
  reviewPendingUser: (
    userId: string,
    payload: {
      action: "approve" | "reject";
      storeId?: string;
      storeName?: string;
      vehicle?: string;
    },
  ) =>
    request(`/super-admin/users/${userId}/approval`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getSuperAdminStores: () =>
    request<
      Array<{
        id: string;
        name: string;
        category: string;
        adminUser: { id: string; name: string; email: string | null } | null;
        _count: { products: number; orders: number; couriers: number };
      }>
    >("/super-admin/stores"),

  getLivreurOrders: () => request<LivreurOrdersResponse>("/livreur/orders/me"),
  updateLivreurOrderStatus: (
    orderId: string,
    status: "PICKED_UP" | "ON_THE_WAY" | "DELIVERED",
  ) =>
    request<{ id: string; status: string; statusLabel: string }>(
      `/livreur/orders/${orderId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    ),

  getRideHome: () => request<RideHomeResponse>("/rides/home"),
  searchRideDestination: (query: string) =>
    request<RideSearchResponse>(`/rides/search?query=${encodeURIComponent(query)}`),
  getRideOptions: (payload: {
    pickupLat: number;
    pickupLng: number;
    destinationLat: number;
    destinationLng: number;
  }) =>
    request<RideOptionsResponse>(
      `/rides/options?pickupLat=${payload.pickupLat}&pickupLng=${payload.pickupLng}&destinationLat=${payload.destinationLat}&destinationLng=${payload.destinationLng}`,
    ),
  addSavedPlace: (payload: {
    label: string;
    kind: "HOME" | "WORK" | "SAVED";
    address: string;
    lat: number;
    lng: number;
  }) =>
    request("/rides/saved-places", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createRide: (payload: {
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    destinationAddress: string;
    destinationLat: number;
    destinationLng: number;
    serviceType: "UBER_X" | "COMFORT" | "BLACK" | "XL";
    paymentMethodType: "CARD" | "APPLE_PAY" | "GOOGLE_PAY" | "CASH";
    seats?: number;
    promoCode?: string;
  }) =>
    request<Ride>("/rides", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getRide: (rideId: string) => request<Ride>(`/rides/${rideId}`),
  getRideTracking: (rideId: string) =>
    request<RideTrackingResponse>(`/rides/${rideId}/tracking`),
  getRideHistory: () => request<Ride[]>("/rides/history"),
  cancelRide: (rideId: string, reason?: string) =>
    request<{ id: string; status: string }>(`/rides/${rideId}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  updateDriverRideStatus: (
    rideId: string,
    status: "ACCEPTED" | "ONGOING" | "COMPLETED",
  ) =>
    request<{ id: string; status: string }>(`/rides/${rideId}/driver/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getPaymentMethods: () => request<UserPaymentMethod[]>("/payments/methods"),
  addPaymentMethod: (payload: {
    type: PaymentMethodType;
    label: string;
    last4?: string;
    isDefault?: boolean;
  }) =>
    request<UserPaymentMethod>("/payments/methods", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  payRide: (
    rideId: string,
    payload: {
      methodType: PaymentMethodType;
      couponCode?: string;
    },
  ) =>
    request<{
      paymentId: string;
      rideId: string;
      amount: number;
      status: string;
      invoiceUrl: string | null;
    }>(`/rides/${rideId}/pay`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getRideInvoice: (rideId: string) =>
    request<{
      rideId: string;
      paymentId: string;
      amount: number;
      currency: string;
      invoiceUrl: string | null;
      paidAt: string | null;
    }>(`/rides/${rideId}/invoice`),
  getPaymentsHistory: () => request<PaymentTransaction[]>("/payments/history"),
  getNotifications: () => request<NotificationsResponse>("/notifications"),
  markNotificationRead: (notificationId: string) =>
    request<{ success: boolean }>(`/notifications/${notificationId}/read`, {
      method: "PATCH",
    }),
  getSupportFaqs: () =>
    request<Array<{ question: string; answer: string }>>("/support/faqs"),
  createSupportTicket: (payload: { subject: string; message: string }) =>
    request<SupportTicket>("/support/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSupportTickets: () => request<SupportTicket[]>("/support/tickets/me"),
  sendSupportMessage: (ticketId: string, message: string) =>
    request(`/support/tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  getSuperAdminUsers: () => request<Array<AuthResponse["user"]>>("/super-admin/users"),
  updateSuperAdminUserAccessStatus: (
    userId: string,
    accessStatus: "ACTIVE" | "PENDING_APPROVAL" | "REJECTED" | "SUSPENDED",
  ) =>
    request(`/super-admin/users/${userId}/access-status`, {
      method: "PATCH",
      body: JSON.stringify({ accessStatus }),
    }),
  getSuperAdminAnalytics: () =>
    request<{
      ridesToday: number;
      ridesCompleted: number;
      ridesCancelled: number;
      usersActive: number;
      paymentsToday: number;
    }>("/super-admin/analytics"),
  getSuperAdminLogs: () =>
    request<{
      latestRideEvents: unknown[];
      latestOrderEvents: unknown[];
    }>("/super-admin/logs"),
};
