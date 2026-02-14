import { Platform } from "react-native";

import type {
  CreateOrderPayload,
  CreateOrderResponse,
  GuestAuthResponse,
  HomeResponse,
  OrderDetails,
  StoreDetails,
  TrackingResponse,
} from "./types";

const fallbackBaseUrl =
  Platform.OS === "android" ? "http://10.0.2.2:3333" : "http://localhost:3333";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? fallbackBaseUrl;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
  createOrder: (payload: CreateOrderPayload) =>
    request<CreateOrderResponse>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
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
