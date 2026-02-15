import { Platform } from "react-native";

import type {
  AuthResponse,
  CreateOrderPayload,
  CreateOrderResponse,
  GuestAuthResponse,
  HomeResponse,
  OrderDetails,
  PaymentResponse,
  StoreDetails,
  TrackingResponse,
} from "./types";

const fallbackBaseUrl =
  Platform.OS === "android" ? "http://10.0.2.2:3333" : "http://localhost:3333";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? fallbackBaseUrl;
export const WS_BASE_URL = API_BASE_URL.replace(/^http/i, (protocol) =>
  protocol.toLowerCase() === "https" ? "wss" : "ws",
);

let authToken: string | null = null;

export const setAuthToken = (token: string | null): void => {
  authToken = token;
};

export const getOrderWsUrl = (orderId: string, token: string): string =>
  `${WS_BASE_URL}/ws/orders/${orderId}?token=${encodeURIComponent(token)}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const withAuthHeader =
    authToken && !("Authorization" in (init?.headers ?? {}))
      ? { Authorization: `Bearer ${authToken}` }
      : {};

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...withAuthHeader,
      ...(init?.headers ?? {}),
    },
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
  me: () =>
    request<{
      user: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        role: "CUSTOMER" | "COURIER" | "ADMIN";
      };
      courierProfile?: {
        id: string;
        name: string;
        vehicle: string;
      } | null;
    }>("/auth/me"),
  createOrder: (payload: CreateOrderPayload) =>
    request<CreateOrderResponse>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  payOrder: (orderId: string, payload?: { provider?: "CARD"; cardLast4?: string }) =>
    request<PaymentResponse>(`/orders/${orderId}/pay`, {
      method: "POST",
      body: JSON.stringify(payload ?? { provider: "CARD" }),
    }),
  getOrder: (orderId: string) => request<OrderDetails>(`/orders/${orderId}`),
  getTracking: (orderId: string) =>
    request<TrackingResponse>(`/orders/${orderId}/tracking`),
  cancelOrder: (orderId: string) =>
    request<{ id: string; status: string; statusLabel: string }>(
      `/orders/${orderId}/cancel`,
      { method: "POST" },
    ),
};
