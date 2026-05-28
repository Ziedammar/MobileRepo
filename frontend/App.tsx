import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  Appbar,
  BottomNavigation,
  MD3LightTheme,
  PaperProvider,
  Snackbar,
} from "react-native-paper";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  API_BASE_URL,
  api,
  getAdminDashboardWsUrl,
  getOrderWsUrl,
  getRideWsUrl,
  setAuthToken,
  setRefreshToken,
} from "./src/api";
import {
  gojekPalette,
  gojekPromoEvents,
  gojekQuickServices,
} from "./src/gojekTemplate";
import { ThemeHeaderCard, ThemeMetricCard } from "./src/themeTemplate";
import type {
  AdminDashboardResponse,
  AdminOrder,
  AuthResponse,
  AuthUser,
  Courier,
  HomeResponse,
  LivreurOrdersResponse,
  NotificationsResponse,
  OrderDetails,
  PaymentMethodType,
  PaymentTransaction,
  Product,
  Ride,
  RideHomeResponse,
  RideOption,
  RideOptionsResponse,
  RideSearchResponse,
  RideTrackingResponse,
  SupportTicket,
  StoreDetails,
  TrackingResponse,
  UserPaymentMethod,
  UserRole,
} from "./src/types";

type TabKey = "home" | "cart" | "tracking" | "profile";

type CartItem = {
  product: Product;
  quantity: number;
  storeId: string;
};

type AuthMode = "signin" | "signup";
type SignupRole = "CLIENT" | "ADMIN" | "LIVREUR";
type ClientServiceMode = "uber" | "glovo";

const signupRoles: Array<{
  role: SignupRole;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { role: "CLIENT", label: "Client", icon: "account-outline" },
  { role: "ADMIN", label: "Admin", icon: "storefront-outline" },
  { role: "LIVREUR", label: "Livreur", icon: "motorbike" },
];

const aberOnboardingSlides = [
  {
    title: "Setup GPS locations",
    subtitle: "Active ta localisation pour un pickup precis et ETA fiable.",
  },
  {
    title: "Choose drop-off",
    subtitle: "Selectionne ta destination et compare les options de course.",
  },
  {
    title: "Track, pay, rate",
    subtitle: "Suivi live, paiement instantane, note et pourboire en fin de trajet.",
  },
];

const clientTabs: Array<{
  key: TabKey;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: "home", label: "Ride", icon: "map-search-outline" },
  { key: "cart", label: "Historique", icon: "history" },
  { key: "tracking", label: "Course live", icon: "car-connected" },
  { key: "profile", label: "Profil", icon: "account-circle-outline" },
];

const adminTabs: typeof clientTabs = [
  { key: "home", label: "Dashboard", icon: "view-dashboard-outline" },
  { key: "cart", label: "Commandes", icon: "clipboard-list-outline" },
  { key: "tracking", label: "Produits", icon: "package-variant-closed" },
  { key: "profile", label: "Profil", icon: "account-circle-outline" },
];

const superAdminTabs: typeof clientTabs = [
  { key: "home", label: "Global", icon: "shield-crown-outline" },
  { key: "cart", label: "Validations", icon: "account-check-outline" },
  { key: "tracking", label: "Stores", icon: "storefront-outline" },
  { key: "profile", label: "Profil", icon: "account-circle-outline" },
];

const livreurTabs: typeof clientTabs = [
  { key: "home", label: "Courses", icon: "motorbike" },
  { key: "cart", label: "Statut", icon: "progress-clock" },
  { key: "tracking", label: "Suivi", icon: "map-marker-radius-outline" },
  { key: "profile", label: "Profil", icon: "account-circle-outline" },
];

const money = (value: number): string => `${value.toFixed(2)} DT`;
const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "Une erreur inattendue est survenue";

const templatePalette = {
  primary: "#F5C518",
  primaryDark: "#D89B00",
  ink: "#111827",
  muted: "#6B7280",
  background: "#F3F4F6",
  surface: "#FFFFFF",
  surfaceSoft: "#FFF7D6",
  border: "#E5E7EB",
};

const categoryIconMap: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  burgers: "hamburger",
  burger: "hamburger",
  sushi: "fish",
  pizza: "pizza",
  courses: "basket-outline",
  market: "basket-outline",
  boissons: "cup-outline",
  cafe: "coffee-outline",
  tacos: "food-outline",
  dessert: "cupcake",
  tous: "apps",
};

const categoryIconFor = (category: string): keyof typeof MaterialCommunityIcons.glyphMap => {
  const normalized = category.trim().toLowerCase();
  return categoryIconMap[normalized] ?? "silverware-fork-knife";
};

type MapModule = {
  MapView: React.ComponentType<any> | null;
  Marker: React.ComponentType<any> | null;
  Polyline: React.ComponentType<any> | null;
};

function getMapModule(): MapModule {
  try {
    const maps = require("react-native-maps");
    return {
      MapView: (maps.default ?? maps.MapView ?? null) as React.ComponentType<any> | null,
      Marker: (maps.Marker ?? null) as React.ComponentType<any> | null,
      Polyline: (maps.Polyline ?? null) as React.ComponentType<any> | null,
    };
  } catch {
    return {
      MapView: null,
      Marker: null,
      Polyline: null,
    };
  }
}

const mapModule = getMapModule();

const computeMapRegion = (
  points: Array<{ latitude: number; longitude: number }>,
): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} => {
  if (points.length === 0) {
    return {
      latitude: 36.8065,
      longitude: 10.1815,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }

  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.8),
  };
};

const internetPaperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: templatePalette.primary,
    secondary: templatePalette.primaryDark,
    background: templatePalette.background,
    surface: templatePalette.surface,
    surfaceVariant: templatePalette.surfaceSoft,
    outline: templatePalette.border,
    error: "#B91C1C",
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [loadingHome, setLoadingHome] = useState(true);
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreDetails | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [searchValue, setSearchValue] = useState("");
  const [clientMode, setClientMode] = useState<ClientServiceMode>("uber");
  const [glovoQuickFilter, setGlovoQuickFilter] = useState<
    "ALL" | "FAST" | "TOP" | "LOW_FEE"
  >("ALL");

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionRefreshToken, setSessionRefreshToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authRole, setAuthRole] = useState<Exclude<UserRole, "SUPER_ADMIN">>("CLIENT");
  const [authName, setAuthName] = useState("Client Mobile");
  const [authEmail, setAuthEmail] = useState("client@livraisonpro.app");
  const [authPassword, setAuthPassword] = useState("Client123!");
  const [authStoreName, setAuthStoreName] = useState("Mon Restaurant");
  const [authVehicle, setAuthVehicle] = useState("Scooter");
  const [authLoading, setAuthLoading] = useState(false);
  const [onboardingPage, setOnboardingPage] = useState(0);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [addressText, setAddressText] = useState("Les Berges du Lac, Tunis");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [rideHome, setRideHome] = useState<RideHomeResponse | null>(null);
  const [rideSearchQuery, setRideSearchQuery] = useState("");
  const [rideSearchResults, setRideSearchResults] = useState<RideSearchResponse | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<{
    title: string;
    address: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [rideOptions, setRideOptions] = useState<RideOption[]>([]);
  const [rideOptionsMeta, setRideOptionsMeta] = useState<RideOptionsResponse | null>(null);
  const [selectedRideOption, setSelectedRideOption] = useState<RideOption | null>(null);
  const [selectedDriverPreview, setSelectedDriverPreview] = useState<string | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [activeRideTracking, setActiveRideTracking] = useState<RideTrackingResponse | null>(
    null,
  );
  const [tripRating, setTripRating] = useState(5);
  const [tripTip, setTripTip] = useState(0);
  const [tripFeedbackSent, setTripFeedbackSent] = useState(false);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<UserPaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodType>("CARD");
  const [couponCode, setCouponCode] = useState("");
  const [paymentsHistory, setPaymentsHistory] = useState<PaymentTransaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);
  const [supportFaqs, setSupportFaqs] = useState<Array<{ question: string; answer: string }>>(
    [],
  );
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");

  const [adminDashboard, setAdminDashboard] =
    useState<AdminDashboardResponse | null>(null);
  const [adminStore, setAdminStore] = useState<{
    id: string;
    name: string;
    category: string;
    description: string;
    products: Product[];
    couriers: Courier[];
  } | null>(null);
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [adminCouriers, setAdminCouriers] = useState<Courier[]>([]);
  const [adminProductForm, setAdminProductForm] = useState({
    name: "",
    description: "",
    category: "Plat principal",
    price: "10",
    stock: "20",
    isAvailable: true,
    imageUrl:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  });
  const [associateLivreurId, setAssociateLivreurId] = useState("");

  const [superDashboard, setSuperDashboard] = useState<{
    usersCount: number;
    storesCount: number;
    pendingApprovals: number;
    ordersToday: number;
    deliveredToday: number;
    usersByRole: Array<{ role: UserRole; count: number }>;
  } | null>(null);
  const [pendingUsers, setPendingUsers] = useState<
    Array<{
      id: string;
      name: string;
      email: string | null;
      role: "ADMIN" | "LIVREUR";
      accessStatus: "PENDING_APPROVAL";
      requestedStoreName: string | null;
      requestedVehicle: string | null;
    }>
  >([]);
  const [superStores, setSuperStores] = useState<
    Array<{
      id: string;
      name: string;
      category: string;
      adminUser: { id: string; name: string; email: string | null } | null;
      _count: { products: number; orders: number; couriers: number };
    }>
  >([]);
  const [reviewStoreId, setReviewStoreId] = useState("");

  const [livreurData, setLivreurData] = useState<LivreurOrdersResponse | null>(
    null,
  );

  const [loadingRoleData, setLoadingRoleData] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const refreshHome = async (showLoader = false) => {
    if (showLoader) {
      setLoadingHome(true);
    }
    try {
      setHome(await api.getHome());
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      if (showLoader) {
        setLoadingHome(false);
      }
    }
  };

  useEffect(() => {
    void refreshHome(true);
  }, []);

  useEffect(() => {
    setAuthToken(sessionToken);
    setRefreshToken(sessionRefreshToken);
  }, [sessionToken, sessionRefreshToken]);

  const applyAuthResponse = (response: AuthResponse) => {
    if (response.token && response.user.accessStatus === "ACTIVE") {
      setSessionToken(response.token);
      setSessionRefreshToken(response.refreshToken ?? null);
      setCurrentUser(response.user);
      setInfoMessage(response.message);
      setErrorMessage(null);
      setActiveTab("home");
      return;
    }

    setSessionToken(null);
    setSessionRefreshToken(null);
    setCurrentUser(null);
    setInfoMessage(response.message);
    setErrorMessage(null);
  };

  const submitAuth = async () => {
    if (authMode === "signup") {
      if (!authName.trim()) {
        setErrorMessage("Nom complet obligatoire");
        return;
      }
      if (authRole === "ADMIN" && !authStoreName.trim()) {
        setErrorMessage("Nom du restaurant obligatoire pour un compte Admin");
        return;
      }
      if (authRole === "LIVREUR" && !authVehicle.trim()) {
        setErrorMessage("Vehicule obligatoire pour un compte Livreur");
        return;
      }
    }

    if (!authEmail.trim() || !authPassword.trim()) {
      setErrorMessage("Email et mot de passe obligatoires");
      return;
    }

    setAuthLoading(true);
    setInfoMessage(null);
    try {
      const response =
        authMode === "signin"
          ? await api.login({
              email: authEmail.trim().toLowerCase(),
              password: authPassword,
            })
          : await api.register({
              name: authName.trim(),
              email: authEmail.trim().toLowerCase(),
              password: authPassword,
              role: authRole,
              requestedStoreName:
                authRole === "ADMIN" ? authStoreName.trim() : undefined,
              requestedVehicle:
                authRole === "LIVREUR" ? authVehicle.trim() : undefined,
            });

      applyAuthResponse(response);
    } catch (error) {
      const message = errorText(error);
      if (message.toLowerCase().includes("en attente de validation")) {
        setInfoMessage(message);
        setErrorMessage(null);
      } else {
        setErrorMessage(message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const continueAsGuest = async () => {
    setAuthLoading(true);
    try {
      const response = await api.authGuest({ name: "Client Invite" });
      applyAuthResponse(response);
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (sessionRefreshToken) {
        await api.logout();
      }
    } catch {
      // ignore logout API error
    } finally {
      setSessionToken(null);
      setSessionRefreshToken(null);
      setCurrentUser(null);
      setAuthToken(null);
      setRefreshToken(null);
      setActiveTab("home");
      setOrderId(null);
      setOrderDetails(null);
      setTracking(null);
      setActiveRide(null);
      setActiveRideTracking(null);
      setRideHistory([]);
      setNotifications(null);
      setInfoMessage("Session deconnectee");
    }
  };

  const refreshOrder = async (targetOrderId: string) => {
    const [details, trackingData] = await Promise.all([
      api.getOrder(targetOrderId),
      api.getTracking(targetOrderId),
    ]);
    setOrderDetails(details);
    setTracking(trackingData);
  };

  const refreshRideContext = async () => {
    try {
      const [
        rideHomeData,
        history,
        methods,
        notificationsData,
        paymentHistoryData,
        faqs,
        tickets,
      ] = await Promise.all([
        api.getRideHome(),
        api.getRideHistory(),
        api.getPaymentMethods(),
        api.getNotifications(),
        api.getPaymentsHistory(),
        api.getSupportFaqs(),
        api.getSupportTickets(),
      ]);

      setRideHome(rideHomeData);
      setRideHistory(history);
      setPaymentMethods(methods);
      setNotifications(notificationsData);
      setPaymentsHistory(paymentHistoryData);
      setSupportFaqs(faqs);
      setSupportTickets(tickets);

      const firstMethod = methods.find((method) => method.isDefault) ?? methods[0];
      if (firstMethod) {
        setSelectedPaymentMethod(firstMethod.type);
      }

      const ongoingRide =
        history.find(
          (ride) =>
            ride.status === "PENDING" ||
            ride.status === "ACCEPTED" ||
            ride.status === "ONGOING",
        ) ?? null;
      if (ongoingRide) {
        setActiveRide(ongoingRide);
      }
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const searchRideDestinations = async (query: string) => {
    setRideSearchQuery(query);
    if (!query.trim()) {
      setRideSearchResults(null);
      return;
    }
    try {
      const result = await api.searchRideDestination(query.trim());
      setRideSearchResults(result);
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const loadRideOptions = async (destination: {
    title: string;
    address: string;
    lat: number;
    lng: number;
  }) => {
    if (!rideHome) {
      return;
    }
    try {
      setSelectedDestination(destination);
      const options = await api.getRideOptions({
        pickupLat: rideHome.userLocation.lat,
        pickupLng: rideHome.userLocation.lng,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
      });
      setRideOptions(options.options);
      setRideOptionsMeta(options);
      setSelectedRideOption(options.options[0] ?? null);
      setSelectedDriverPreview(null);
      setActiveTab("cart");
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const requestRide = async () => {
    if (!rideHome || !selectedDestination || !selectedRideOption) {
      setErrorMessage("Selectionne une destination et un type de trajet");
      return;
    }
    try {
      const createdRide = await api.createRide({
        pickupAddress: rideHome.userLocation.address,
        pickupLat: rideHome.userLocation.lat,
        pickupLng: rideHome.userLocation.lng,
        destinationAddress: selectedDestination.address,
        destinationLat: selectedDestination.lat,
        destinationLng: selectedDestination.lng,
        serviceType: selectedRideOption.serviceType,
        paymentMethodType: selectedPaymentMethod,
        promoCode: couponCode.trim() ? couponCode.trim() : undefined,
      });
      setActiveRide(createdRide);
      setTripFeedbackSent(false);
      setTripTip(0);
      setTripRating(5);
      setInfoMessage(
        selectedDriverPreview
          ? `Trajet cree avec succes · preference chauffeur: ${selectedDriverPreview}`
          : "Trajet cree avec succes",
      );
      setActiveTab("tracking");
      await refreshRideContext();
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const refreshActiveRide = async () => {
    if (!activeRide?.id) {
      return;
    }

    try {
      const [ride, trackingData] = await Promise.all([
        api.getRide(activeRide.id),
        api.getRideTracking(activeRide.id),
      ]);
      setActiveRide(ride);
      setActiveRideTracking(trackingData);
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const cancelRideRequest = async () => {
    if (!activeRide?.id) {
      return;
    }
    try {
      await api.cancelRide(activeRide.id, "Annule par le client");
      await refreshActiveRide();
      await refreshRideContext();
      setInfoMessage("Course annulee");
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const payForRide = async () => {
    if (!activeRide?.id) {
      return;
    }
    try {
      await api.payRide(activeRide.id, {
        methodType: selectedPaymentMethod,
        couponCode: couponCode.trim() ? couponCode.trim() : undefined,
      });
      await refreshRideContext();
      setInfoMessage("Paiement confirme et facture generee");
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const createSupportTicket = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) {
      setErrorMessage("Sujet et message support obligatoires");
      return;
    }
    try {
      await api.createSupportTicket({
        subject: supportSubject.trim(),
        message: supportMessage.trim(),
      });
      setSupportSubject("");
      setSupportMessage("");
      setInfoMessage("Ticket support cree");
      const tickets = await api.getSupportTickets();
      setSupportTickets(tickets);
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const submitTripFeedback = () => {
    if (!activeRide) {
      return;
    }
    setTripFeedbackSent(true);
    setInfoMessage(
      `Merci! Note ${tripRating}/5 enregistree${tripTip > 0 ? ` avec pourboire ${money(tripTip)}` : ""}.`,
    );
  };

  useEffect(() => {
    if (!sessionToken || !orderId || currentUser?.role !== "CLIENT") {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        await refreshOrder(orderId);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(errorText(error));
        }
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId, sessionToken, currentUser?.role]);

  useEffect(() => {
    if (!sessionToken || !orderId || currentUser?.role !== "CLIENT") {
      return;
    }

    const ws = new WebSocket(getOrderWsUrl(orderId, sessionToken));
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          orderId?: string;
        };
        if (payload.type === "order:refresh" && payload.orderId === orderId) {
          void refreshOrder(orderId);
        }
      } catch {
        // ignore ws parsing error
      }
    };

    return () => ws.close();
  }, [orderId, sessionToken, currentUser?.role]);

  const refreshAdminData = async () => {
    setLoadingRoleData(true);
    try {
      const [dashboard, store, orders, products, couriers] = await Promise.all([
        api.getAdminDashboard(),
        api.getAdminStore(),
        api.getAdminOrders(),
        api.getAdminProducts(),
        api.getAdminCouriers(),
      ]);
      setAdminDashboard(dashboard);
      setAdminStore(store);
      setAdminOrders(orders);
      setAdminProducts(products);
      setAdminCouriers(couriers);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setLoadingRoleData(false);
    }
  };

  const refreshSuperData = async () => {
    setLoadingRoleData(true);
    try {
      const [dashboard, pending, stores] = await Promise.all([
        api.getSuperAdminDashboard(),
        api.getSuperAdminPendingUsers(),
        api.getSuperAdminStores(),
      ]);
      setSuperDashboard(dashboard);
      setPendingUsers(pending);
      setSuperStores(stores);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setLoadingRoleData(false);
    }
  };

  const refreshLivreurData = async () => {
    setLoadingRoleData(true);
    try {
      setLivreurData(await api.getLivreurOrders());
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setLoadingRoleData(false);
    }
  };

  useEffect(() => {
    if (!sessionToken || !currentUser) {
      return;
    }

    if (currentUser.role === "ADMIN") {
      void refreshAdminData();
      const interval = setInterval(() => void refreshAdminData(), 12000);
      return () => clearInterval(interval);
    }

    if (currentUser.role === "SUPER_ADMIN") {
      void refreshSuperData();
      const interval = setInterval(() => void refreshSuperData(), 15000);
      return () => clearInterval(interval);
    }

    if (currentUser.role === "LIVREUR") {
      void refreshLivreurData();
      const interval = setInterval(() => void refreshLivreurData(), 12000);
      return () => clearInterval(interval);
    }

    return;
  }, [sessionToken, currentUser?.role]);

  useEffect(() => {
    if (currentUser?.role !== "CLIENT") {
      return;
    }

    void refreshHome();
    const interval = setInterval(() => void refreshHome(), 8000);
    return () => clearInterval(interval);
  }, [currentUser?.role]);

  useEffect(() => {
    if (!sessionToken || currentUser?.role !== "CLIENT") {
      return;
    }
    void refreshRideContext();
  }, [sessionToken, currentUser?.role]);

  useEffect(() => {
    if (!sessionToken || currentUser?.role !== "CLIENT" || !activeRide?.id) {
      return;
    }

    void refreshActiveRide();
    const interval = setInterval(() => void refreshActiveRide(), 7000);
    return () => clearInterval(interval);
  }, [sessionToken, currentUser?.role, activeRide?.id]);

  useEffect(() => {
    if (!sessionToken || currentUser?.role !== "CLIENT" || !activeRide?.id) {
      return;
    }

    const ws = new WebSocket(getRideWsUrl(activeRide.id, sessionToken));
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          rideId?: string;
        };
        if (payload.type === "ride:refresh" && payload.rideId === activeRide.id) {
          void refreshActiveRide();
          void refreshRideContext();
        }
      } catch {
        // ignore
      }
    };

    return () => ws.close();
  }, [sessionToken, currentUser?.role, activeRide?.id]);

  useEffect(() => {
    if (currentUser?.role !== "CLIENT" || !selectedStore?.id) {
      return;
    }

    const pollStore = async () => {
      try {
        const latest = await api.getStore(selectedStore.id);
        setSelectedStore(latest);
      } catch {
        // ignore temporary polling errors
      }
    };

    const interval = setInterval(() => void pollStore(), 8000);
    return () => clearInterval(interval);
  }, [currentUser?.role, selectedStore?.id]);

  useEffect(() => {
    if (!sessionToken || currentUser?.role !== "ADMIN") {
      return;
    }

    const ws = new WebSocket(getAdminDashboardWsUrl(sessionToken));
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string };
        if (
          payload.type === "dashboard:refresh" ||
          payload.type === "dashboard:snapshot"
        ) {
          void refreshAdminData();
        }
      } catch {
        // ignore ws parsing error
      }
    };

    return () => ws.close();
  }, [sessionToken, currentUser?.role]);

  const categories = useMemo(() => {
    if (!home) {
      return ["Tous"];
    }
    return ["Tous", ...home.categories];
  }, [home]);

  const filteredStores = useMemo(() => {
    if (!home) {
      return [];
    }

    const needle = searchValue.trim().toLowerCase();
    return home.stores.filter((store) => {
      const categoryMatch =
        selectedCategory === "Tous" || store.category === selectedCategory;
      const searchMatch =
        !needle ||
        store.name.toLowerCase().includes(needle) ||
        store.description.toLowerCase().includes(needle) ||
        store.category.toLowerCase().includes(needle);
      const quickFilterMatch =
        glovoQuickFilter === "ALL" ||
        (glovoQuickFilter === "FAST" && store.etaMinutes <= 25) ||
        (glovoQuickFilter === "TOP" && store.rating >= 4.6) ||
        (glovoQuickFilter === "LOW_FEE" && store.deliveryFee <= 3);
      return categoryMatch && searchMatch && quickFilterMatch;
    });
  }, [home, selectedCategory, searchValue, glovoQuickFilter]);

  const cartSubtotal = useMemo(
    () =>
      cartItems.reduce(
        (runningTotal, item) => runningTotal + item.product.price * item.quantity,
        0,
      ),
    [cartItems],
  );

  const cartStoreId = cartItems[0]?.storeId;
  const cartStore =
    home?.stores.find((store) => store.id === cartStoreId) ??
    (selectedStore && selectedStore.id === cartStoreId ? selectedStore : undefined);
  const cartDeliveryFee = cartStore?.deliveryFee ?? 0;
  const cartTotal = Number((cartSubtotal + cartDeliveryFee).toFixed(2));
  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const openStore = async (storeId: string) => {
    try {
      setSelectedStore(await api.getStore(storeId));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const addProductToCart = (storeId: string, product: Product) => {
    setCartItems((previous) => {
      if (previous.length > 0 && previous[0].storeId !== storeId) {
        return [{ storeId, product, quantity: 1 }];
      }

      const existing = previous.find((item) => item.product.id === product.id);
      if (!existing) {
        return [...previous, { storeId, product, quantity: 1 }];
      }

      return previous.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    });
  };

  const changeCartQuantity = (productId: string, delta: number) => {
    setCartItems((previous) =>
      previous
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const checkout = async () => {
    if (!cartStoreId || cartItems.length === 0) {
      return;
    }

    setProcessingCheckout(true);
    try {
      const order = await api.createOrder({
        storeId: cartStoreId,
        addressText,
        addressLat: 36.842,
        addressLng: 10.272,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });

      await api.payOrder(order.id, { provider: "CARD", cardLast4: "4242" });
      setOrderId(order.id);
      await refreshOrder(order.id);
      setCartItems([]);
      setSelectedStore(null);
      setActiveTab("tracking");
      setInfoMessage("Commande payee et transmise au restaurant");
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setProcessingCheckout(false);
    }
  };

  const cancelOrder = async () => {
    if (!orderId) {
      return;
    }

    try {
      await api.cancelOrder(orderId);
      await refreshOrder(orderId);
      setInfoMessage("Commande annulee");
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const decideOrder = async (
    orderIdToUpdate: string,
    decision: "accept" | "refuse",
  ) => {
    try {
      await api.adminDecideOrder(orderIdToUpdate, { decision });
      await refreshAdminData();
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const createAdminProduct = async () => {
    if (
      !adminProductForm.name.trim() ||
      !adminProductForm.description.trim() ||
      !adminProductForm.category.trim()
    ) {
      setErrorMessage("Remplis nom, description et categorie du produit");
      return;
    }

    const parsedPrice = Number(adminProductForm.price);
    const parsedStock = Number(adminProductForm.stock);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setErrorMessage("Prix invalide");
      return;
    }
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setErrorMessage("Stock invalide");
      return;
    }

    try {
      await api.createAdminProduct({
        name: adminProductForm.name,
        description: adminProductForm.description,
        category: adminProductForm.category,
        price: parsedPrice,
        stock: parsedStock,
        isAvailable: adminProductForm.isAvailable,
        imageUrl: adminProductForm.imageUrl,
        isPopular: true,
      });
      setAdminProductForm((prev) => ({
        ...prev,
        name: "",
        description: "",
        stock: "20",
      }));
      await refreshAdminData();
      setInfoMessage("Produit ajoute");
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const toggleCourierAvailability = async (courier: Courier) => {
    try {
      await api.setCourierAvailability(courier.id, !courier.isAvailable);
      await refreshAdminData();
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const associateCourier = async () => {
    if (!associateLivreurId.trim()) {
      return;
    }

    try {
      await api.associateAdminCourier({
        livreurUserId: associateLivreurId.trim(),
      });
      setAssociateLivreurId("");
      await refreshAdminData();
      setInfoMessage("Livreur associe au restaurant");
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const reviewPendingUser = async (
    userId: string,
    action: "approve" | "reject",
    role: "ADMIN" | "LIVREUR",
  ) => {
    if (action === "approve" && role === "LIVREUR" && !reviewStoreId.trim()) {
      setErrorMessage("Pour un livreur, renseigne Store ID avant approbation");
      return;
    }

    try {
      await api.reviewPendingUser(userId, {
        action,
        storeId:
          action === "approve" && role === "LIVREUR"
            ? reviewStoreId.trim() || undefined
            : undefined,
      });
      await refreshSuperData();
      setInfoMessage(
        action === "approve" ? "Compte approuve" : "Demande rejetee",
      );
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const updateLivreurStatus = async (
    orderToUpdate: string,
    nextStatus: "PICKED_UP" | "ON_THE_WAY" | "DELIVERED",
  ) => {
    try {
      await api.updateLivreurOrderStatus(orderToUpdate, nextStatus);
      await refreshLivreurData();
      setInfoMessage("Statut livreur mis a jour");
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const roleTabs = useMemo(() => {
    if (!currentUser) {
      return clientTabs;
    }
    if (currentUser.role === "ADMIN") {
      return adminTabs;
    }
    if (currentUser.role === "SUPER_ADMIN") {
      return superAdminTabs;
    }
    if (currentUser.role === "LIVREUR") {
      return livreurTabs;
    }
    return clientTabs;
  }, [currentUser]);

  const hasNativeMap =
    mapModule.MapView !== null && mapModule.Marker !== null && mapModule.Polyline !== null;

  const driverCandidates = useMemo(() => {
    if (!selectedRideOption || !selectedDestination) {
      return [];
    }

    const sampleByService: Record<string, Array<{ name: string; car: string; eta: string }>> = {
      UBER_X: [
        { name: "Ahmed K.", car: "Toyota Yaris", eta: "3 min" },
        { name: "Sarra M.", car: "Hyundai i10", eta: "4 min" },
      ],
      COMFORT: [
        { name: "Nour B.", car: "Kia Cerato", eta: "5 min" },
        { name: "Omar R.", car: "Renault Megane", eta: "6 min" },
      ],
      BLACK: [
        { name: "Khaled T.", car: "Mercedes C200", eta: "7 min" },
        { name: "Yassine H.", car: "BMW Serie 3", eta: "8 min" },
      ],
      XL: [
        { name: "Moez A.", car: "Hyundai H1", eta: "6 min" },
        { name: "Rim S.", car: "Peugeot Traveller", eta: "7 min" },
      ],
    };

    return sampleByService[selectedRideOption.serviceType] ?? sampleByService.UBER_X;
  }, [selectedRideOption, selectedDestination]);

  const renderClientHome = () => {
    if (clientMode === "glovo" && selectedStore) {
      const customerPoint = {
        latitude: 36.842,
        longitude: 10.272,
      };
      const storePoint = {
        latitude: selectedStore.lat,
        longitude: selectedStore.lng,
      };
      const storeRegion = computeMapRegion([storePoint, customerPoint]);

      return (
        <View style={styles.screen}>
          <View style={styles.rowBetween}>
            <Pressable
              style={styles.templateIconCircle}
              onPress={() => setSelectedStore(null)}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={20}
                color={templatePalette.ink}
              />
            </Pressable>
            <Text style={styles.templatePageTitle}>{selectedStore.name}</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.templateStoreHeroCard}>
              <Image source={{ uri: selectedStore.imageUrl }} style={styles.storeHeroImage} />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.65)"]}
                style={styles.templateStoreHeroOverlay}
              >
                <Text style={styles.templateStoreHeroTitle}>{selectedStore.name}</Text>
                <Text style={styles.templateStoreHeroSubtitle}>
                  {selectedStore.category} · ⭐ {selectedStore.rating.toFixed(1)}
                </Text>
              </LinearGradient>
            </View>
            <Text style={styles.supportingText}>{selectedStore.description}</Text>

            <View style={styles.templateMapCard}>
              <Text style={styles.mapCardTitle}>Localisation partenaire</Text>
              {hasNativeMap && mapModule.MapView ? (
                <mapModule.MapView style={styles.templateMapView} initialRegion={storeRegion}>
                  {mapModule.Marker ? (
                    <mapModule.Marker
                      coordinate={storePoint}
                      title={selectedStore.name}
                      pinColor="#111827"
                    />
                  ) : null}
                  {mapModule.Marker ? (
                    <mapModule.Marker
                      coordinate={customerPoint}
                      title="Votre adresse"
                      description={addressText}
                      pinColor={templatePalette.primaryDark}
                    />
                  ) : null}
                  {mapModule.Polyline ? (
                    <mapModule.Polyline
                      coordinates={[storePoint, customerPoint]}
                      strokeColor={templatePalette.primaryDark}
                      strokeWidth={3}
                    />
                  ) : null}
                </mapModule.MapView>
              ) : (
                <View style={styles.mapFallbackCard}>
                  <MaterialCommunityIcons
                    name="map-outline"
                    size={22}
                    color={templatePalette.primaryDark}
                  />
                  <Text style={styles.mapFallbackText}>
                    Carte indisponible dans Expo Go (utilise un Dev Build pour la map native).
                  </Text>
                </View>
              )}
            </View>

            {selectedStore.products.map((product) => (
              <View key={product.id} style={styles.templateProductRowCard}>
                <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
                <View style={styles.productContent}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productDescription}>{product.description}</Text>
                  <View style={styles.rowBetween}>
                    <Text style={styles.productPrice}>{money(product.price)}</Text>
                    <View style={styles.rowActions}>
                      <Text style={styles.templateStockText}>Stock {product.stock ?? 0}</Text>
                      <Pressable
                        style={styles.addButton}
                        onPress={() => addProductToCart(selectedStore.id, product)}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color="#111827" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    if (!rideHome || (clientMode === "glovo" && loadingHome)) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={templatePalette.primaryDark} />
          <Text style={styles.centeredStateText}>Chargement super-app...</Text>
        </View>
      );
    }

    const mapRegion =
      clientMode === "uber"
        ? computeMapRegion([
            {
              latitude: rideHome.userLocation.lat,
              longitude: rideHome.userLocation.lng,
            },
            ...(selectedDestination
              ? [
                  {
                    latitude: selectedDestination.lat,
                    longitude: selectedDestination.lng,
                  },
                ]
              : []),
          ])
        : null;
    const homeShortcut = rideHome.shortcuts.home;
    const workShortcut = rideHome.shortcuts.work;
    const savedShortcut = rideHome.shortcuts.saved[0] ?? null;

    return (
      <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.sectionTitle}>Super App Uber + Glovo</Text>
            <Text style={styles.supportingText}>Template Gojek integre (services rapides)</Text>
          </View>
          <Pressable style={styles.templateIconCircle} onPress={() => setActiveTab("profile")}>
            <MaterialCommunityIcons
              name="account-circle-outline"
              size={20}
              color={templatePalette.ink}
            />
          </Pressable>
        </View>

        <View style={styles.gojekHeaderCard}>
          <Text style={styles.gojekHeaderTitle}>Quick services</Text>
          <View style={styles.gojekServiceGrid}>
            {gojekQuickServices.map((service) => (
              <Pressable
                key={service.key}
                style={styles.gojekServiceItem}
                onPress={() => setClientMode(service.target)}
              >
                <View
                  style={[
                    styles.gojekServiceIconWrap,
                    service.target === "uber" ? styles.gojekUberIcon : styles.gojekGlovoIcon,
                  ]}
                >
                  <MaterialCommunityIcons name={service.icon} size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.gojekServiceLabel}>{service.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.rowActions}>
          <Pressable
            style={[
              styles.smallAction,
              clientMode === "uber" ? styles.smallActionSelected : null,
            ]}
            onPress={() => setClientMode("uber")}
          >
            <Text style={styles.smallActionText}>Uber mode</Text>
          </Pressable>
          <Pressable
            style={[
              styles.smallAction,
              clientMode === "glovo" ? styles.smallActionSelected : null,
            ]}
            onPress={() => setClientMode("glovo")}
          >
            <Text style={styles.smallActionText}>Glovo mode</Text>
          </Pressable>
        </View>

        {clientMode === "uber" ? (
          <>
            {mapRegion ? (
              <View style={styles.mapCard}>
                {hasNativeMap && mapModule.MapView ? (
                  <mapModule.MapView style={styles.trackingMapView} initialRegion={mapRegion}>
                    {mapModule.Marker ? (
                      <mapModule.Marker
                        coordinate={{
                          latitude: rideHome.userLocation.lat,
                          longitude: rideHome.userLocation.lng,
                        }}
                        title="Vous"
                        description={rideHome.userLocation.address}
                        pinColor="#111827"
                      />
                    ) : null}
                    {selectedDestination && mapModule.Marker ? (
                      <mapModule.Marker
                        coordinate={{
                          latitude: selectedDestination.lat,
                          longitude: selectedDestination.lng,
                        }}
                        title={selectedDestination.title}
                        description={selectedDestination.address}
                        pinColor={templatePalette.primaryDark}
                      />
                    ) : null}
                  </mapModule.MapView>
                ) : (
                  <View style={styles.mapFallbackCard}>
                    <MaterialCommunityIcons
                      name="map-outline"
                      size={22}
                      color={templatePalette.primaryDark}
                    />
                    <Text style={styles.mapFallbackText}>
                      Carte indisponible en Expo Go. Le flux reste testable sans map.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.searchBox}>
              <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
              <TextInput
                value={rideSearchQuery}
                onChangeText={(value) => void searchRideDestinations(value)}
                placeholder={rideHome.whereToLabel}
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
            </View>

            <LinearGradient
              colors={["#111827", "#1F2937"]}
              style={styles.uberHeroCard}
            >
              <Text style={styles.uberHeroTitle}>Where to?</Text>
              <Text style={styles.uberHeroSubtitle}>
                Selection rapide, ETA instantane, suivi live chauffeur.
              </Text>
              <View style={styles.rowActions}>
                <Pressable style={styles.uberHeroAction} onPress={() => setActiveTab("cart")}>
                  <MaterialCommunityIcons name="car-clock" size={15} color="#FFFFFF" />
                  <Text style={styles.uberHeroActionText}>Choisir un trajet</Text>
                </Pressable>
                <Pressable
                  style={styles.uberHeroAction}
                  onPress={() => setInfoMessage("Paiement: Card / ApplePay / GooglePay / Cash")}
                >
                  <MaterialCommunityIcons name="credit-card-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.uberHeroActionText}>Paiement</Text>
                </Pressable>
              </View>
            </LinearGradient>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {rideHome.quickSuggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  style={styles.templateCategoryChip}
                  onPress={() => void searchRideDestinations(suggestion)}
                >
                  <Text style={styles.templateCategoryText}>{suggestion}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.rowActions}>
              {homeShortcut ? (
                <Pressable
                  style={styles.uberShortcut}
                  onPress={() =>
                    void loadRideOptions({
                      title: "Home",
                      address: homeShortcut.address,
                      lat: homeShortcut.lat,
                      lng: homeShortcut.lng,
                    })
                  }
                >
                  <MaterialCommunityIcons name="home-outline" size={15} color="#111827" />
                  <Text style={styles.smallActionText}>Home</Text>
                </Pressable>
              ) : null}
              {workShortcut ? (
                <Pressable
                  style={styles.uberShortcut}
                  onPress={() =>
                    void loadRideOptions({
                      title: "Work",
                      address: workShortcut.address,
                      lat: workShortcut.lat,
                      lng: workShortcut.lng,
                    })
                  }
                >
                  <MaterialCommunityIcons name="briefcase-outline" size={15} color="#111827" />
                  <Text style={styles.smallActionText}>Work</Text>
                </Pressable>
              ) : null}
              {savedShortcut ? (
                <Pressable
                  style={styles.uberShortcut}
                  onPress={() =>
                    void loadRideOptions({
                      title: "Saved",
                      address: savedShortcut.address,
                      lat: savedShortcut.lat,
                      lng: savedShortcut.lng,
                    })
                  }
                >
                  <MaterialCommunityIcons name="bookmark-outline" size={15} color="#111827" />
                  <Text style={styles.smallActionText}>Saved</Text>
                </Pressable>
              ) : null}
            </View>

            {rideSearchResults?.results.map((result, index) => (
              <Pressable
                key={`${result.address}-${index}`}
                style={styles.addressResultCard}
                onPress={() => void loadRideOptions(result)}
              >
                <View style={styles.addressResultIcon}>
                  <MaterialCommunityIcons
                    name="map-marker-radius-outline"
                    size={16}
                    color={templatePalette.ink}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoCardTitle}>{result.title}</Text>
                  <Text style={styles.infoCardText}>{result.address}</Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>
            ))}

            <Text style={styles.sectionSubtitle}>Historique recent</Text>
            {rideHome.recent.map((entry) => (
              <View key={entry.id} style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>{entry.destination}</Text>
                <Text style={styles.infoCardText}>
                  {entry.serviceType} · {entry.status} · {money(entry.amount)}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <>
            <View style={styles.searchBox}>
              <MaterialCommunityIcons name="magnify" size={18} color="#6B7280" />
              <TextInput
                value={searchValue}
                onChangeText={setSearchValue}
                placeholder="Recherche restaurants, plats, courses..."
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
            </View>

            <LinearGradient
              colors={["#FFF7D6", "#FFFFFF"]}
              style={styles.glovoHeroBanner}
            >
              <Text style={styles.glovoHeroTitle}>Delivery ultra rapide</Text>
              <Text style={styles.glovoHeroText}>
                Choisis une categorie, filtre tes restos et commande en quelques secondes.
              </Text>
            </LinearGradient>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templateCategoriesContainer}
            >
              {categories.map((category) => {
                const selected = category === selectedCategory;
                return (
                  <Pressable
                    key={category}
                    style={[
                      styles.templateCategoryChip,
                      selected ? styles.templateCategoryChipActive : null,
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <MaterialCommunityIcons
                      name={categoryIconFor(category)}
                      size={16}
                      color={selected ? "#111827" : "#6B7280"}
                    />
                    <Text
                      style={[
                        styles.templateCategoryText,
                        selected ? styles.templateCategoryTextActive : null,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templateCategoriesContainer}
            >
              <Pressable
                style={[
                  styles.templateCategoryChip,
                  glovoQuickFilter === "ALL" ? styles.templateCategoryChipActive : null,
                ]}
                onPress={() => setGlovoQuickFilter("ALL")}
              >
                <Text style={styles.templateCategoryText}>Tous</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.templateCategoryChip,
                  glovoQuickFilter === "FAST" ? styles.templateCategoryChipActive : null,
                ]}
                onPress={() => setGlovoQuickFilter("FAST")}
              >
                <Text style={styles.templateCategoryText}>Livraison &lt; 25 min</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.templateCategoryChip,
                  glovoQuickFilter === "TOP" ? styles.templateCategoryChipActive : null,
                ]}
                onPress={() => setGlovoQuickFilter("TOP")}
              >
                <Text style={styles.templateCategoryText}>Top notes 4.6+</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.templateCategoryChip,
                  glovoQuickFilter === "LOW_FEE" ? styles.templateCategoryChipActive : null,
                ]}
                onPress={() => setGlovoQuickFilter("LOW_FEE")}
              >
                <Text style={styles.templateCategoryText}>Frais bas</Text>
              </Pressable>
            </ScrollView>

            {gojekPromoEvents.map((event) => (
              <View key={event.title} style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>{event.title}</Text>
                <Text style={styles.infoCardText}>{event.description}</Text>
              </View>
            ))}

            <Text style={styles.templateSectionLabel}>
              Restaurants & commerces ({filteredStores.length})
            </Text>
            {filteredStores.map((store) => (
              <Pressable
                key={store.id}
                style={styles.templateStoreRowCard}
                onPress={() => void openStore(store.id)}
              >
                <Image source={{ uri: store.imageUrl }} style={styles.templateStoreThumb} />
                <View style={styles.templateStoreContent}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.templateStoreName}>{store.name}</Text>
                    <View style={styles.templateRatingPill}>
                      <MaterialCommunityIcons name="star" size={12} color="#111827" />
                      <Text style={styles.templateRatingText}>{store.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                  <Text numberOfLines={2} style={styles.templateStoreDesc}>
                    {store.description}
                  </Text>
                  <View style={styles.glovoMetaRow}>
                    <View style={styles.templateMetaPill}>
                      <Text style={styles.templateMetaText}>{store.category}</Text>
                    </View>
                    <View style={styles.templateMetaPill}>
                      <MaterialCommunityIcons name="fire" size={12} color="#F59E0B" />
                      <Text style={styles.templateMetaText}>Tendance</Text>
                    </View>
                  </View>
                  <View style={styles.rowActions}>
                    <View style={styles.templateMetaPill}>
                      <MaterialCommunityIcons name="clock-outline" size={12} color="#6B7280" />
                      <Text style={styles.templateMetaText}>{store.etaMinutes} min</Text>
                    </View>
                    <View style={styles.templateMetaPill}>
                      <MaterialCommunityIcons name="bike-fast" size={12} color="#6B7280" />
                      <Text style={styles.templateMetaText}>{money(store.deliveryFee)}</Text>
                    </View>
                    <View style={styles.glovoOpenButton}>
                      <Text style={styles.glovoOpenButtonText}>Voir menu</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}

            {filteredStores.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons
                  name="store-search-outline"
                  size={28}
                  color={templatePalette.primaryDark}
                />
                <Text style={styles.emptyBoxText}>
                  Aucun restaurant pour cette recherche.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    );
  };

  const renderClientCart = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>
        {clientMode === "uber" ? "Selection du trajet & paiement" : "Panier Glovo"}
      </Text>
      <View style={styles.rowActions}>
        <Pressable
          style={[
            styles.smallAction,
            clientMode === "uber" ? styles.smallActionSelected : null,
          ]}
          onPress={() => setClientMode("uber")}
        >
          <Text style={styles.smallActionText}>Uber</Text>
        </Pressable>
        <Pressable
          style={[
            styles.smallAction,
            clientMode === "glovo" ? styles.smallActionSelected : null,
          ]}
          onPress={() => setClientMode("glovo")}
        >
          <Text style={styles.smallActionText}>Glovo</Text>
        </Pressable>
      </View>

      {clientMode === "glovo" ? (
        <>
          <Text style={styles.supportingText}>
            {cartStore ? `${cartStore.name} · ${cartStore.category}` : "Panier vide"}
          </Text>

          {cartItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons
                name="cart-outline"
                size={30}
                color={templatePalette.primaryDark}
              />
              <Text style={styles.emptyBoxText}>Ajoute des produits depuis Glovo mode</Text>
            </View>
          ) : (
            <>
              {cartItems.map((item) => (
                <View key={item.product.id} style={styles.cartItemCard}>
                  <Image source={{ uri: item.product.imageUrl }} style={styles.cartItemImage} />
                  <View style={styles.cartItemContent}>
                    <Text style={styles.cartItemName}>{item.product.name}</Text>
                    <Text style={styles.cartItemPrice}>{money(item.product.price)}</Text>
                  </View>
                  <View style={styles.quantityControls}>
                    <Pressable
                      style={styles.quantityButton}
                      onPress={() => changeCartQuantity(item.product.id, -1)}
                    >
                      <MaterialCommunityIcons name="minus" size={16} color="#1F2937" />
                    </Pressable>
                    <Text style={styles.quantityValue}>{item.quantity}</Text>
                    <Pressable
                      style={styles.quantityButton}
                      onPress={() => changeCartQuantity(item.product.id, 1)}
                    >
                      <MaterialCommunityIcons name="plus" size={16} color="#1F2937" />
                    </Pressable>
                  </View>
                </View>
              ))}

              <View style={styles.addressCard}>
                <Text style={styles.addressTitle}>Adresse livraison</Text>
                <TextInput
                  value={addressText}
                  onChangeText={setAddressText}
                  placeholder="Adresse de livraison"
                  placeholderTextColor="#94A3B8"
                  style={styles.addressInput}
                />
              </View>

              <View style={styles.pricingCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.pricingLabel}>Sous-total</Text>
                  <Text style={styles.pricingValue}>{money(cartSubtotal)}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.pricingLabel}>Livraison</Text>
                  <Text style={styles.pricingValue}>{money(cartDeliveryFee)}</Text>
                </View>
                <View style={styles.separator} />
                <View style={styles.rowBetween}>
                  <Text style={styles.pricingTotalLabel}>Total</Text>
                  <Text style={styles.pricingTotalValue}>{money(cartTotal)}</Text>
                </View>
              </View>

              <Pressable
                style={[
                  styles.checkoutButton,
                  processingCheckout ? styles.checkoutButtonDisabled : null,
                ]}
                onPress={() => void checkout()}
                disabled={processingCheckout}
              >
                {processingCheckout ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.checkoutButtonText}>Commander + paiement instantane</Text>
                )}
              </Pressable>
            </>
          )}
        </>
      ) : !selectedDestination ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons
            name="car-estate"
            size={30}
            color={templatePalette.primaryDark}
          />
          <Text style={styles.emptyBoxText}>Choisis une destination dans l'onglet Ride.</Text>
        </View>
      ) : (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Choose drop-off</Text>
            <Text style={styles.infoCardText}>{selectedDestination.address}</Text>
            <Text style={styles.infoCardText}>
              Distance estimee: {rideOptionsMeta?.distanceKm.toFixed(2) ?? "0.00"} km
            </Text>
            <Pressable style={styles.smallAction} onPress={() => setActiveTab("home")}>
              <Text style={styles.smallActionText}>Modifier destination</Text>
            </Pressable>
          </View>

          {rideOptions.map((option) => (
            <Pressable
              key={option.serviceType}
              style={[
                styles.rideOptionCard,
                selectedRideOption?.serviceType === option.serviceType
                  ? styles.rideOptionCardActive
                  : null,
              ]}
              onPress={() => setSelectedRideOption(option)}
            >
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.infoCardTitle}>{option.label}</Text>
                  <Text style={styles.rideOptionSubline}>
                    {option.serviceType.replace("_", " ")}
                  </Text>
                </View>
                <Text style={styles.rideOptionPrice}>{money(option.estimatedPrice)}</Text>
              </View>
              <Text style={styles.infoCardText}>
                ETA {option.etaMinutes} min · {option.seats} places
              </Text>
            </Pressable>
          ))}

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Input promo code + Payment method</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(["CARD", "APPLE_PAY", "GOOGLE_PAY", "CASH"] as PaymentMethodType[]).map(
                (method) => (
                  <Pressable
                    key={method}
                    style={[
                      styles.templateCategoryChip,
                      selectedPaymentMethod === method
                        ? styles.templateCategoryChipActive
                        : null,
                    ]}
                    onPress={() => setSelectedPaymentMethod(method)}
                  >
                    <Text style={styles.templateCategoryText}>{method}</Text>
                  </Pressable>
                ),
              )}
            </ScrollView>
            <TextInput
              value={couponCode}
              onChangeText={setCouponCode}
              placeholder="Input promo code"
              placeholderTextColor="#94A3B8"
              style={styles.authInput}
            />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Select driver</Text>
            {driverCandidates.map((driver) => (
              <Pressable
                key={driver.name}
                style={[
                  styles.addressResultCard,
                  selectedDriverPreview === driver.name ? styles.rideOptionCardActive : null,
                ]}
                onPress={() => setSelectedDriverPreview(driver.name)}
              >
                <View style={styles.addressResultIcon}>
                  <MaterialCommunityIcons name="account-circle-outline" size={16} color="#111827" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoCardTitle}>{driver.name}</Text>
                  <Text style={styles.infoCardText}>
                    {driver.car} · {driver.eta}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={
                    selectedDriverPreview === driver.name
                      ? "check-circle-outline"
                      : "circle-outline"
                  }
                  size={18}
                  color={selectedDriverPreview === driver.name ? "#16A34A" : "#94A3B8"}
                />
              </Pressable>
            ))}
            <View style={styles.rowActions}>
              <Pressable style={styles.smallAction} onPress={() => void requestRide()}>
                <Text style={styles.smallActionText}>Book now</Text>
              </Pressable>
              <Pressable style={styles.smallAction} onPress={() => void payForRide()}>
                <Text style={styles.smallActionText}>Pay now</Text>
              </Pressable>
            </View>
          </View>

          {activeRide ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>
                {activeRide.status === "PENDING" || activeRide.status === "ACCEPTED"
                  ? "Booking successfully"
                  : "Booking details"}
              </Text>
              <Text style={styles.infoCardText}>
                Driver: {activeRide.driverName ?? selectedDriverPreview ?? "Assignation en cours"}
              </Text>
              <Text style={styles.infoCardText}>
                Vehicle: {activeRide.vehicleLabel ?? "Vehicle incoming"}
              </Text>
              <Text style={styles.infoCardText}>
                Prix: {money(activeRide.finalPrice ?? activeRide.estimatedPrice)}
              </Text>
              <Pressable style={styles.smallAction} onPress={() => setActiveTab("tracking")}>
                <Text style={styles.smallActionText}>Voir tracking details</Text>
              </Pressable>
            </View>
          ) : null}

          {activeRide?.status === "COMPLETED" ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Rate your trip</Text>
              <View style={styles.rowActions}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    style={styles.templateIconCircle}
                    onPress={() => setTripRating(value)}
                  >
                    <MaterialCommunityIcons
                      name={value <= tripRating ? "star" : "star-outline"}
                      size={16}
                      color={value <= tripRating ? "#F59E0B" : "#94A3B8"}
                    />
                  </Pressable>
                ))}
              </View>
              <Text style={styles.infoCardTitle}>Tips</Text>
              <View style={styles.rowActions}>
                {[0, 2, 5, 10].map((tip) => (
                  <Pressable
                    key={tip}
                    style={[
                      styles.templateCategoryChip,
                      tripTip === tip ? styles.templateCategoryChipActive : null,
                    ]}
                    onPress={() => setTripTip(tip)}
                  >
                    <Text style={styles.templateCategoryText}>
                      {tip === 0 ? "No tip" : money(tip)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.smallAction} onPress={submitTripFeedback}>
                <Text style={styles.smallActionText}>
                  {tripFeedbackSent ? "Feedback envoye" : "Envoyer note"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionSubtitle}>Historique trajets</Text>
          {rideHistory.map((ride) => (
            <Pressable
              key={ride.id}
              style={styles.infoCard}
              onPress={() =>
                void loadRideOptions({
                  title: "Recommander",
                  address: ride.destinationAddress,
                  lat: ride.destinationLat,
                  lng: ride.destinationLng,
                })
              }
            >
              <View style={styles.rowBetween}>
                <Text style={styles.infoCardTitle}>{ride.destinationAddress}</Text>
                <Text style={styles.infoCardText}>
                  {money(ride.finalPrice ?? ride.estimatedPrice)}
                </Text>
              </View>
              <Text style={styles.infoCardText}>
                {ride.serviceType} · {ride.status} ·{" "}
                {new Date(ride.createdAt).toLocaleString("fr-FR")}
              </Text>
            </Pressable>
          ))}
          {paymentsHistory.slice(0, 8).map((payment) => (
            <View key={payment.id} style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Paiement {payment.provider}</Text>
              <Text style={styles.infoCardText}>
                {money(payment.amount)} · {payment.status}
              </Text>
              <Text style={styles.infoCardText}>
                Facture: {payment.invoiceUrl ?? "en generation"}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );

  const renderClientTracking = () => {
    const rideRoutePoints =
      activeRideTracking !== null
        ? [
            {
              latitude: activeRideTracking.pickup.lat,
              longitude: activeRideTracking.pickup.lng,
            },
            {
              latitude: activeRideTracking.position.lat,
              longitude: activeRideTracking.position.lng,
            },
            {
              latitude: activeRideTracking.destination.lat,
              longitude: activeRideTracking.destination.lng,
            },
          ]
        : [];
    const rideTrackingRegion = computeMapRegion(rideRoutePoints);

    const orderRoutePoints =
      tracking !== null
        ? [
            {
              latitude: tracking.pickup.lat,
              longitude: tracking.pickup.lng,
            },
            {
              latitude: tracking.position.lat,
              longitude: tracking.position.lng,
            },
            {
              latitude: tracking.destination.lat,
              longitude: tracking.destination.lng,
            },
          ]
        : [];
    const orderTrackingRegion = computeMapRegion(orderRoutePoints);

    return (
      <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Suivi temps reel Uber + Glovo</Text>
        <View style={styles.rowActions}>
          <Pressable
            style={[
              styles.smallAction,
              clientMode === "uber" ? styles.smallActionSelected : null,
            ]}
            onPress={() => setClientMode("uber")}
          >
            <Text style={styles.smallActionText}>Uber</Text>
          </Pressable>
          <Pressable
            style={[
              styles.smallAction,
              clientMode === "glovo" ? styles.smallActionSelected : null,
            ]}
            onPress={() => setClientMode("glovo")}
          >
            <Text style={styles.smallActionText}>Glovo</Text>
          </Pressable>
        </View>

        {clientMode === "uber" ? !activeRide || !activeRideTracking ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons
              name="car-connected"
              size={30}
              color={templatePalette.primaryDark}
            />
            <Text style={styles.emptyBoxText}>
              Aucune course active. Cree une course depuis l'accueil.
            </Text>
          </View>
        ) : (
          <>
            <LinearGradient colors={["#FFF3C4", "#FFF7D6"]} style={styles.trackingHero}>
              <Text style={styles.trackingStatus}>{activeRide.status}</Text>
              <Text style={styles.trackingEta}>ETA {activeRideTracking.etaMinutes} min</Text>
              <Text style={styles.trackingEta}>
                Vehicule: {activeRide.vehicleLabel ?? activeRideTracking.driver?.vehicle ?? "N/A"}
              </Text>
              <Text style={styles.trackingOrder}>#{activeRide.id.slice(0, 8)}</Text>
            </LinearGradient>

            <View style={styles.mapCard}>
              <Text style={styles.mapCardTitle}>Position live</Text>
              {hasNativeMap && mapModule.MapView ? (
                <mapModule.MapView
                  style={styles.trackingMapView}
                  initialRegion={rideTrackingRegion}
                >
                  {mapModule.Marker ? (
                    <mapModule.Marker
                      coordinate={{
                        latitude: activeRideTracking.pickup.lat,
                        longitude: activeRideTracking.pickup.lng,
                      }}
                      title="Pickup"
                      pinColor="#111827"
                    />
                  ) : null}
                  {mapModule.Marker ? (
                    <mapModule.Marker
                      coordinate={{
                        latitude: activeRideTracking.destination.lat,
                        longitude: activeRideTracking.destination.lng,
                      }}
                      title={activeRideTracking.destination.text}
                      pinColor={templatePalette.primaryDark}
                    />
                  ) : null}
                  {mapModule.Marker ? (
                    <mapModule.Marker
                      coordinate={{
                        latitude: activeRideTracking.position.lat,
                        longitude: activeRideTracking.position.lng,
                      }}
                      title={activeRideTracking.driver?.name ?? "Chauffeur"}
                      description={activeRideTracking.driver?.vehicle ?? "En route"}
                      pinColor="#22C55E"
                    />
                  ) : null}
                  {mapModule.Polyline ? (
                    <mapModule.Polyline
                      coordinates={rideRoutePoints}
                      strokeColor="#111827"
                      strokeWidth={3}
                    />
                  ) : null}
                </mapModule.MapView>
              ) : (
                <View style={styles.mapFallbackCard}>
                  <MaterialCommunityIcons
                    name="map-outline"
                    size={22}
                    color={templatePalette.primaryDark}
                  />
                  <Text style={styles.mapFallbackText}>
                    Tracking map indisponible dans Expo Go.
                  </Text>
                </View>
              )}
              <Text style={styles.mapCoordinate}>Depart: {activeRideTracking.pickup.text}</Text>
              <Text style={styles.mapCoordinate}>
                Arrivee: {activeRideTracking.destination.text}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Booking details</Text>
              <Text style={styles.infoCardText}>Status: {activeRide.status}</Text>
              <Text style={styles.infoCardText}>
                Driver: {activeRide.driverName ?? activeRideTracking.driver?.name ?? "N/A"}
              </Text>
              <Text style={styles.infoCardText}>
                Vehicle: {activeRide.vehicleLabel ?? activeRideTracking.driver?.vehicle ?? "N/A"}
              </Text>
              <Text style={styles.infoCardText}>
                ETA: {activeRideTracking.etaMinutes} min
              </Text>
            </View>

            <View style={styles.rowActions}>
              <Pressable style={styles.smallAction} onPress={() => setInfoMessage("Appel chauffeur (demo)")}>
                <Text style={styles.smallActionText}>Appeler</Text>
              </Pressable>
              <Pressable
                style={styles.smallAction}
                onPress={() => setInfoMessage("Message chauffeur envoye (demo)")}
              >
                <Text style={styles.smallActionText}>Message</Text>
              </Pressable>
              <Pressable style={styles.smallAction} onPress={() => setInfoMessage("Partage trajet actif")}>
                <Text style={styles.smallActionText}>Partager</Text>
              </Pressable>
            </View>

            <View style={styles.rowActions}>
              <Pressable style={styles.smallAction} onPress={() => setInfoMessage("Support securite contacte")}>
                <Text style={styles.smallActionText}>Securite</Text>
              </Pressable>
              <Pressable style={styles.smallAction} onPress={() => setActiveTab("profile")}>
                <Text style={styles.smallActionText}>Support</Text>
              </Pressable>
            </View>

            {(activeRide.status === "PENDING" ||
              activeRide.status === "ACCEPTED" ||
              activeRide.status === "ONGOING") && (
              <Pressable style={styles.cancelButton} onPress={() => void cancelRideRequest()}>
                <Text style={styles.cancelButtonText}>Annuler la course</Text>
              </Pressable>
            )}
          </>
        ) : !orderId || !orderDetails || !tracking ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons
              name="map-marker-path"
              size={30}
              color={templatePalette.primaryDark}
            />
            <Text style={styles.emptyBoxText}>
              Pas de commande Glovo active. Passe une commande depuis Glovo mode.
            </Text>
          </View>
        ) : (
          <>
            <LinearGradient colors={["#FFF3C4", "#FFF7D6"]} style={styles.trackingHero}>
              <Text style={styles.trackingStatus}>{orderDetails.statusLabel}</Text>
              <Text style={styles.trackingEta}>Paiement: {orderDetails.paymentStatus}</Text>
              <Text style={styles.trackingEta}>ETA {tracking.etaMinutes} min</Text>
              <Text style={styles.trackingOrder}>#{orderDetails.id.slice(0, 8)}</Text>
            </LinearGradient>

            <View style={styles.mapCard}>
              <Text style={styles.mapCardTitle}>Position livreur</Text>
              {hasNativeMap && mapModule.MapView ? (
                <mapModule.MapView
                  style={styles.trackingMapView}
                  initialRegion={orderTrackingRegion}
                >
                  {mapModule.Marker ? (
                    <mapModule.Marker
                      coordinate={{
                        latitude: tracking.pickup.lat,
                        longitude: tracking.pickup.lng,
                      }}
                      title={tracking.pickup.name}
                      pinColor="#111827"
                    />
                  ) : null}
                  {mapModule.Marker ? (
                    <mapModule.Marker
                      coordinate={{
                        latitude: tracking.destination.lat,
                        longitude: tracking.destination.lng,
                      }}
                      title={tracking.destination.text}
                      pinColor={templatePalette.primaryDark}
                    />
                  ) : null}
                  {mapModule.Marker ? (
                    <mapModule.Marker
                      coordinate={{
                        latitude: tracking.position.lat,
                        longitude: tracking.position.lng,
                      }}
                      title={tracking.courier?.name ?? "Livreur"}
                      description={tracking.courier?.vehicle ?? "En route"}
                      pinColor="#22C55E"
                    />
                  ) : null}
                  {mapModule.Polyline ? (
                    <mapModule.Polyline
                      coordinates={orderRoutePoints}
                      strokeColor="#111827"
                      strokeWidth={3}
                    />
                  ) : null}
                </mapModule.MapView>
              ) : (
                <View style={styles.mapFallbackCard}>
                  <MaterialCommunityIcons
                    name="map-outline"
                    size={22}
                    color={templatePalette.primaryDark}
                  />
                  <Text style={styles.mapFallbackText}>
                    Tracking map indisponible dans Expo Go.
                  </Text>
                </View>
              )}
              <Text style={styles.mapCoordinate}>Depart: {tracking.pickup.name}</Text>
              <Text style={styles.mapCoordinate}>Arrivee: {tracking.destination.text}</Text>
            </View>

            <Text style={styles.sectionSubtitle}>Timeline</Text>
            {orderDetails.timeline.map((event) => (
              <View key={event.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View>
                  <Text style={styles.timelineLabel}>{event.label}</Text>
                  <Text style={styles.timelineTimestamp}>
                    {new Date(event.timestamp).toLocaleTimeString("fr-FR")}
                  </Text>
                </View>
              </View>
            ))}

            {orderDetails.status !== "DELIVERED" &&
            orderDetails.status !== "CANCELLED" &&
            orderDetails.status !== "REFUSED" ? (
              <Pressable style={styles.cancelButton} onPress={() => void cancelOrder()}>
                <Text style={styles.cancelButtonText}>Annuler la commande</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    );
  };

  const renderAdminDashboard = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Dashboard Restaurant</Text>
      {!adminDashboard ? (
        <View style={styles.emptyBox}>
          {loadingRoleData ? (
            <ActivityIndicator size="small" color={templatePalette.primaryDark} />
          ) : (
            <Text style={styles.emptyBoxText}>Aucune donnee dashboard</Text>
          )}
        </View>
      ) : (
        <>
          <ThemeHeaderCard
            icon="storefront-outline"
            title={adminDashboard.store.name}
            subtitle={`${adminDashboard.store.category} · Temps reel`}
            actionLabel="Voir panel"
            onActionPress={() => setActiveTab("tracking")}
          />

          <View style={styles.statsGrid}>
            <ThemeMetricCard
              icon="clipboard-check-outline"
              value={String(adminDashboard.stats.pendingOrders)}
              label="A valider"
            />
            <ThemeMetricCard
              icon="package-variant-closed-check"
              value={String(adminDashboard.stats.deliveredToday)}
              label="Livrees aujourd'hui"
            />
          </View>

          <View style={styles.statsGrid}>
            <ThemeMetricCard
              icon="cash-multiple"
              value={money(adminDashboard.stats.revenueToday)}
              label="CA du jour"
            />
            <ThemeMetricCard
              icon="motorbike"
              value={String(adminDashboard.stats.availableCouriers)}
              label="Livreurs dispo"
            />
          </View>

          <Text style={styles.sectionSubtitle}>Charge recentre</Text>
          <View style={styles.infoCard}>
            {adminDashboard.stats.chart.map((point) => (
              <View key={point.label} style={styles.rowBetween}>
                <Text style={styles.infoCardText}>{point.label}</Text>
                <Text style={styles.infoCardText}>{point.orders} cmd</Text>
              </View>
            ))}
          </View>

          {adminStore ? (
            <Pressable style={styles.infoCard} onPress={() => setActiveTab("tracking")}>
              <View style={styles.rowBetween}>
                <Text style={styles.infoCardTitle}>Panel restaurant</Text>
                <MaterialCommunityIcons
                  name="storefront-outline"
                  size={18}
                  color={templatePalette.primaryDark}
                />
              </View>
              <Text style={styles.infoCardText}>
                {adminStore.name} · {adminStore.category}
              </Text>
              <Text style={styles.infoCardText}>
                {adminStore.products.length} produits · {adminStore.couriers.length} livreurs
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );

  const renderAdminOrders = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Validation commandes</Text>
      {adminOrders.map((order) => (
        <View key={order.id} style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>
            #{order.id.slice(0, 8)} · {order.user.name}
          </Text>
          <Text style={styles.infoCardText}>
            {order.status} · Paiement {order.paymentStatus} · {money(order.total)}
          </Text>
          <View style={styles.rowActions}>
            <Pressable
              style={styles.smallAction}
              onPress={() => void decideOrder(order.id, "accept")}
            >
              <Text style={styles.smallActionText}>Accepter</Text>
            </Pressable>
            <Pressable
              style={[styles.smallAction, styles.smallActionDanger]}
              onPress={() => void decideOrder(order.id, "refuse")}
            >
              <Text style={styles.smallActionText}>Refuser</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {adminOrders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyBoxText}>Pas de commandes en attente</Text>
        </View>
      ) : null}
    </ScrollView>
  );

  const renderAdminProducts = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Produits & Livreurs</Text>

      {adminStore ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>
            {adminStore.name} · {adminStore.category}
          </Text>
          <Text style={styles.infoCardText}>{adminStore.description}</Text>
          <Text style={styles.infoCardText}>
            Produits: {adminProducts.length} · Livreurs: {adminCouriers.length}
          </Text>
        </View>
      ) : null}

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Ajouter un produit complet</Text>
        <TextInput
          value={adminProductForm.name}
          onChangeText={(value) =>
            setAdminProductForm((prev) => ({ ...prev, name: value }))
          }
          placeholder="Nom produit"
          placeholderTextColor="#94A3B8"
          style={styles.authInput}
        />
        <TextInput
          value={adminProductForm.description}
          onChangeText={(value) =>
            setAdminProductForm((prev) => ({ ...prev, description: value }))
          }
          placeholder="Description"
          placeholderTextColor="#94A3B8"
          style={styles.authInput}
        />
        <TextInput
          value={adminProductForm.category}
          onChangeText={(value) =>
            setAdminProductForm((prev) => ({ ...prev, category: value }))
          }
          placeholder="Categorie (ex: Burgers, Sushi, Boissons)"
          placeholderTextColor="#94A3B8"
          style={styles.authInput}
        />
        <TextInput
          value={adminProductForm.price}
          onChangeText={(value) =>
            setAdminProductForm((prev) => ({ ...prev, price: value }))
          }
          placeholder="Prix"
          placeholderTextColor="#94A3B8"
          keyboardType="decimal-pad"
          style={styles.authInput}
        />
        <TextInput
          value={adminProductForm.stock}
          onChangeText={(value) =>
            setAdminProductForm((prev) => ({ ...prev, stock: value }))
          }
          placeholder="Stock disponible"
          placeholderTextColor="#94A3B8"
          keyboardType="number-pad"
          style={styles.authInput}
        />
        <TextInput
          value={adminProductForm.imageUrl}
          onChangeText={(value) =>
            setAdminProductForm((prev) => ({ ...prev, imageUrl: value }))
          }
          placeholder="URL image produit"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          style={styles.authInput}
        />
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            setAdminProductForm((prev) => ({
              ...prev,
              isAvailable: !prev.isAvailable,
            }))
          }
        >
          <Text style={styles.secondaryButtonText}>
            Disponibilite: {adminProductForm.isAvailable ? "Active" : "Inactive"}
          </Text>
        </Pressable>
        <Pressable style={styles.checkoutButton} onPress={() => void createAdminProduct()}>
          <Text style={styles.checkoutButtonText}>Ajouter</Text>
        </Pressable>
      </View>

      {adminProducts.map((product) => (
        <View key={product.id} style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.infoCardTitle}>{product.name}</Text>
            <MaterialCommunityIcons
              name={product.isAvailable ? "check-circle-outline" : "close-circle-outline"}
              size={18}
              color={product.isAvailable ? templatePalette.primaryDark : "#EF4444"}
            />
          </View>
          <Text style={styles.infoCardText}>
            {product.category ?? "General"} · {money(product.price)}
          </Text>
          <Text style={styles.infoCardText}>Stock: {product.stock ?? 0}</Text>
        </View>
      ))}
      {adminProducts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyBoxText}>
            Aucun produit. Ajoute ton premier produit pour qu'il apparaisse chez les clients.
          </Text>
        </View>
      ) : null}

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Associer un Livreur (userId)</Text>
        <TextInput
          value={associateLivreurId}
          onChangeText={setAssociateLivreurId}
          placeholder="cuid utilisateur livreur"
          placeholderTextColor="#94A3B8"
          style={styles.authInput}
        />
        <Pressable style={styles.checkoutButton} onPress={() => void associateCourier()}>
          <Text style={styles.checkoutButtonText}>Associer</Text>
        </Pressable>
      </View>

      {adminCouriers.map((courier) => (
        <View key={courier.id} style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>
            {courier.name} · {courier.vehicle}
          </Text>
          <Text style={styles.infoCardText}>
            {courier.isAvailable ? "Disponible" : "Occupe"}
          </Text>
          <Pressable
            style={styles.smallAction}
            onPress={() => void toggleCourierAvailability(courier)}
          >
            <Text style={styles.smallActionText}>
              {courier.isAvailable ? "Mettre indisponible" : "Mettre disponible"}
            </Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );

  const renderSuperAdminGlobal = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Super Admin Control</Text>
      {!superDashboard ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyBoxText}>Chargement dashboard global...</Text>
        </View>
      ) : (
        <>
          <ThemeHeaderCard
            icon="shield-crown-outline"
            title="Super Admin Control"
            subtitle="Pilotage global de la plateforme en temps reel"
            actionLabel="Actualiser"
            onActionPress={() => void refreshSuperData()}
          />

          <View style={styles.statsGrid}>
            <ThemeMetricCard
              icon="account-group-outline"
              value={String(superDashboard.usersCount)}
              label="Users"
            />
            <ThemeMetricCard
              icon="storefront-outline"
              value={String(superDashboard.storesCount)}
              label="Restaurants"
            />
          </View>
          <View style={styles.statsGrid}>
            <ThemeMetricCard
              icon="account-clock-outline"
              value={String(superDashboard.pendingApprovals)}
              label="A approuver"
            />
            <ThemeMetricCard
              icon="clipboard-list-outline"
              value={String(superDashboard.ordersToday)}
              label="Cmd aujourd'hui"
            />
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Repartition roles</Text>
            {superDashboard.usersByRole.map((entry) => (
              <View key={entry.role} style={styles.rowBetween}>
                <Text style={styles.infoCardText}>{entry.role}</Text>
                <Text style={styles.infoCardText}>{entry.count}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderSuperAdminApprovals = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Validation Admin / Livreur</Text>
        <Pressable style={styles.iconButton} onPress={() => void refreshSuperData()}>
          <MaterialCommunityIcons
            name="refresh"
            size={18}
            color={templatePalette.primaryDark}
          />
        </Pressable>
      </View>
      <Text style={styles.supportingText}>
        En attente: {pendingUsers.length} compte(s)
      </Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Store ID (pour Livreur)</Text>
        <TextInput
          value={reviewStoreId}
          onChangeText={setReviewStoreId}
          placeholder="storeId si besoin"
          placeholderTextColor="#94A3B8"
          style={styles.authInput}
        />
      </View>

      {pendingUsers.map((user) => (
        <View key={user.id} style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>
            {user.name} · {user.role}
          </Text>
          <Text style={styles.infoCardText}>{user.email}</Text>
          <Text style={styles.infoCardText}>
            {user.role === "ADMIN"
              ? `Restaurant: ${user.requestedStoreName ?? "-"}`
              : `Vehicule: ${user.requestedVehicle ?? "-"}`}
          </Text>
          <View style={styles.rowActions}>
            <Pressable
              style={styles.smallAction}
              onPress={() => void reviewPendingUser(user.id, "approve", user.role)}
            >
              <Text style={styles.smallActionText}>Approuver</Text>
            </Pressable>
            <Pressable
              style={[styles.smallAction, styles.smallActionDanger]}
              onPress={() => void reviewPendingUser(user.id, "reject", user.role)}
            >
              <Text style={styles.smallActionText}>Rejeter</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {pendingUsers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyBoxText}>Aucune demande en attente</Text>
        </View>
      ) : null}
    </ScrollView>
  );

  const renderSuperAdminStores = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Restaurants</Text>
      {superStores.map((store) => (
        <Pressable
          key={store.id}
          style={styles.infoCard}
          onPress={() => {
            setReviewStoreId(store.id);
            setActiveTab("cart");
            setInfoMessage(`Store selectionne pour approbation livreur: ${store.name}`);
          }}
        >
          <Text style={styles.infoCardTitle}>{store.name}</Text>
          <Text style={styles.infoCardText}>
            {store.category} · Admin: {store.adminUser?.name ?? "Non assigne"}
          </Text>
          <Text style={styles.infoCardText}>ID: {store.id}</Text>
          <Text style={styles.infoCardText}>
            Produits {store._count.products} · Cmd {store._count.orders} · Livreurs{" "}
            {store._count.couriers}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderLivreurOrders = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Espace Livreur</Text>
      {!livreurData ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyBoxText}>Aucune donnee livreur</Text>
        </View>
      ) : (
        <>
          <ThemeHeaderCard
            icon="motorbike"
            title={livreurData.courier.name}
            subtitle={`${livreurData.courier.vehicle} · ${
              livreurData.courier.isAvailable ? "Disponible" : "Occupe"
            }`}
          />

          {livreurData.orders.map((order) => (
            <View key={order.id} style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>
                #{order.id.slice(0, 8)} · {order.store.name}
              </Text>
              <Text style={styles.infoCardText}>
                {order.status} · {money(order.total)}
              </Text>
              <Text style={styles.infoCardText}>{order.addressText}</Text>
              <View style={styles.rowActions}>
                {(order.status === "ACCEPTED" || order.status === "PREPARING") && (
                  <Pressable
                    style={styles.smallAction}
                    onPress={() => void updateLivreurStatus(order.id, "PICKED_UP")}
                  >
                    <Text style={styles.smallActionText}>Picked Up</Text>
                  </Pressable>
                )}
                {order.status === "PICKED_UP" && (
                  <Pressable
                    style={styles.smallAction}
                    onPress={() => void updateLivreurStatus(order.id, "ON_THE_WAY")}
                  >
                    <Text style={styles.smallActionText}>On The Way</Text>
                  </Pressable>
                )}
                {order.status === "ON_THE_WAY" && (
                  <Pressable
                    style={styles.smallAction}
                    onPress={() => void updateLivreurStatus(order.id, "DELIVERED")}
                  >
                    <Text style={styles.smallActionText}>Delivered</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <ThemeHeaderCard
        icon="account-circle-outline"
        title={currentUser?.name ?? "Profil"}
        subtitle={`${currentUser?.role ?? "USER"} · ${currentUser?.email ?? "Invite"}`}
      />

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Acces</Text>
        <Text style={styles.infoCardText}>
          Statut: {currentUser?.accessStatus ?? "N/A"}
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Configuration API</Text>
        <Text style={styles.infoCardText}>{API_BASE_URL}</Text>
      </View>

      {currentUser?.role === "CLIENT" ? (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Menu</Text>
            {[
              "My History",
              "Message",
              "Notifications",
              "Settings",
              "My Account",
              "My Wallet",
              "Payment Method",
            ].map((item) => (
              <View key={item} style={styles.rowBetween}>
                <Text style={styles.infoCardText}>{item}</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color="#94A3B8" />
              </View>
            ))}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Moyens paiement</Text>
            {paymentMethods.length === 0 ? (
              <Text style={styles.infoCardText}>Aucune carte enregistree</Text>
            ) : (
              paymentMethods.map((method) => (
                <Text key={method.id} style={styles.infoCardText}>
                  {method.type} · {method.label}
                  {method.last4 ? ` · ****${method.last4}` : ""}
                  {method.isDefault ? " (defaut)" : ""}
                </Text>
              ))
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>My Wallet</Text>
            <Text style={styles.infoCardText}>
              Total paiements: {money(paymentsHistory.reduce((sum, p) => sum + p.amount, 0))}
            </Text>
            <Text style={styles.infoCardText}>Transactions: {paymentsHistory.length}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Securite / Langue / Notifications</Text>
            <Text style={styles.infoCardText}>Langue: Francais</Text>
            <Text style={styles.infoCardText}>
              Notifications non lues: {notifications?.unread ?? 0}
            </Text>
            {notifications?.items.slice(0, 5).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void api.markNotificationRead(item.id)}
              >
                <Text style={styles.infoCardText}>
                  • {item.title} — {item.body}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Support</Text>
            <TextInput
              value={supportSubject}
              onChangeText={setSupportSubject}
              placeholder="Sujet du probleme"
              placeholderTextColor="#94A3B8"
              style={styles.authInput}
            />
            <TextInput
              value={supportMessage}
              onChangeText={setSupportMessage}
              placeholder="Decris ton probleme"
              placeholderTextColor="#94A3B8"
              multiline
              style={[styles.authInput, { minHeight: 80, textAlignVertical: "top" }]}
            />
            <Pressable style={styles.smallAction} onPress={() => void createSupportTicket()}>
              <Text style={styles.smallActionText}>Signaler probleme</Text>
            </Pressable>
            {supportFaqs.map((faq) => (
              <View key={faq.question} style={styles.separatorTop}>
                <Text style={styles.infoCardTitle}>{faq.question}</Text>
                <Text style={styles.infoCardText}>{faq.answer}</Text>
              </View>
            ))}
            {supportTickets.slice(0, 3).map((ticket) => (
              <Text key={ticket.id} style={styles.infoCardText}>
                Ticket {ticket.subject} · {ticket.status}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      <Pressable style={styles.secondaryButton} onPress={() => void logout()}>
        <Text style={styles.secondaryButtonText}>Se deconnecter</Text>
      </Pressable>
    </ScrollView>
  );

  const renderRoleContent = () => {
    if (!currentUser) {
      return null;
    }

    if (currentUser.role === "CLIENT") {
      switch (activeTab) {
        case "home":
          return renderClientHome();
        case "cart":
          return renderClientCart();
        case "tracking":
          return renderClientTracking();
        default:
          return renderProfile();
      }
    }

    if (currentUser.role === "ADMIN") {
      switch (activeTab) {
        case "home":
          return renderAdminDashboard();
        case "cart":
          return renderAdminOrders();
        case "tracking":
          return renderAdminProducts();
        default:
          return renderProfile();
      }
    }

    if (currentUser.role === "SUPER_ADMIN") {
      switch (activeTab) {
        case "home":
          return renderSuperAdminGlobal();
        case "cart":
          return renderSuperAdminApprovals();
        case "tracking":
          return renderSuperAdminStores();
        default:
          return renderProfile();
      }
    }

    switch (activeTab) {
      case "home":
      case "cart":
      case "tracking":
        return renderLivreurOrders();
      default:
        return renderProfile();
    }
  };

  const activeTabLabel =
    roleTabs.find((tab) => tab.key === activeTab)?.label ?? "Dashboard";

  const refreshCurrentContext = () => {
    if (!currentUser) {
      return;
    }

    if (currentUser.role === "CLIENT") {
      void refreshHome(true);
      void refreshRideContext();
      void refreshActiveRide();
      return;
    }

    if (currentUser.role === "ADMIN") {
      void refreshAdminData();
      return;
    }

    if (currentUser.role === "SUPER_ADMIN") {
      void refreshSuperData();
      return;
    }

    void refreshLivreurData();
  };

  const renderAuthScreen = () => (
    <SafeAreaView style={styles.authRoot}>
      <StatusBar style="light" />
      <View style={styles.uberAuthHero}>
        <View style={styles.uberBrandPill}>
          <MaterialCommunityIcons name="car-side" size={20} color="#FFFFFF" />
          <Text style={styles.uberBrandPillText}>Uber style login</Text>
        </View>
        <Text style={styles.uberBrandTitle}>Aber-style Taxi UI</Text>
        <Text style={styles.uberBrandSubtitle}>{aberOnboardingSlides[onboardingPage]!.title}</Text>
        <Text style={styles.uberBrandSubtitleSecondary}>
          {aberOnboardingSlides[onboardingPage]!.subtitle}
        </Text>
        <View style={styles.rowActions}>
          {aberOnboardingSlides.map((_, idx) => (
            <Pressable
              key={idx}
              style={[
                styles.onboardingDot,
                onboardingPage === idx ? styles.onboardingDotActive : null,
              ]}
              onPress={() => setOnboardingPage(idx)}
            />
          ))}
        </View>
      </View>

      <View style={styles.uberAuthSheet}>
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#B91C1C" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}
        {infoMessage ? (
          <View style={styles.infoBanner}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#111827" />
            <Text style={styles.infoBannerText}>{infoMessage}</Text>
          </View>
        ) : null}

        <View style={styles.authModeRow}>
          <Pressable
            style={[
              styles.authModeChip,
              authMode === "signin" ? styles.authModeChipActive : null,
            ]}
            onPress={() => setAuthMode("signin")}
          >
            <Text
              style={[
                styles.authModeText,
                authMode === "signin" ? styles.authModeTextActive : null,
              ]}
            >
              Sign in
            </Text>
          </Pressable>
          <Pressable
            style={[styles.authModeChip, authMode === "signup" ? styles.authModeChipActive : null]}
            onPress={() => setAuthMode("signup")}
          >
            <Text
              style={[
                styles.authModeText,
                authMode === "signup" ? styles.authModeTextActive : null,
              ]}
            >
              Sign up
            </Text>
          </Pressable>
        </View>

        {authMode === "signup" ? (
          <>
            <TextInput
              value={authName}
              onChangeText={setAuthName}
              placeholder="Full name"
              placeholderTextColor="#9CA3AF"
              style={styles.uberInput}
            />
            <View style={styles.authRoleRow}>
              {signupRoles.map((entry) => {
                const role = entry.role;
                const selected = authRole === role;
                return (
                  <Pressable
                    key={role}
                    style={[styles.authRoleChip, selected ? styles.authRoleChipActive : null]}
                    onPress={() => setAuthRole(role)}
                  >
                    <MaterialCommunityIcons
                      name={entry.icon}
                      size={16}
                      color={selected ? templatePalette.ink : "#6B7280"}
                      style={{ marginBottom: 4 }}
                    />
                    <Text
                      style={[styles.authRoleText, selected ? styles.authRoleTextActive : null]}
                    >
                      {entry.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {authRole === "ADMIN" ? (
              <TextInput
                value={authStoreName}
                onChangeText={setAuthStoreName}
                placeholder="Restaurant name"
                placeholderTextColor="#9CA3AF"
                style={styles.uberInput}
              />
            ) : null}
            {authRole === "LIVREUR" ? (
              <TextInput
                value={authVehicle}
                onChangeText={setAuthVehicle}
                placeholder="Vehicle type"
                placeholderTextColor="#9CA3AF"
                style={styles.uberInput}
              />
            ) : null}
          </>
        ) : null}

        <TextInput
          value={authEmail}
          onChangeText={setAuthEmail}
          placeholder="Email address"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.uberInput}
        />
        <TextInput
          value={authPassword}
          onChangeText={setAuthPassword}
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          style={styles.uberInput}
        />

        <Pressable
          style={[styles.uberPrimaryButton, authLoading ? styles.checkoutButtonDisabled : null]}
          onPress={() => void submitAuth()}
          disabled={authLoading}
        >
          {authLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.uberPrimaryButtonText}>
              {authMode === "signin" ? "Continue" : "Create account"}
            </Text>
          )}
        </Pressable>

        <Pressable style={styles.uberSecondaryButton} onPress={() => void continueAsGuest()}>
          <Text style={styles.uberSecondaryButtonText}>Continue as guest</Text>
        </Pressable>

        <Text style={styles.authFootnote}>
          Admin/Livreur necessitent validation Super Admin avant acces.
        </Text>
        <Text style={styles.authFootnote}>
          Super Admin: superadmin@livraisonpro.app / SuperAdmin123!
        </Text>
      </View>
    </SafeAreaView>
  );

  if (!currentUser || !sessionToken) {
    return <PaperProvider theme={internetPaperTheme}>{renderAuthScreen()}</PaperProvider>;
  }

  const navigationState = {
    index: Math.max(
      0,
      roleTabs.findIndex((tab) => tab.key === activeTab),
    ),
    routes: roleTabs.map((tab) => ({
      key: tab.key,
      title: tab.label,
      focusedIcon: tab.icon,
    })),
  };

  return (
    <PaperProvider theme={internetPaperTheme}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.root}>
          {currentUser.role !== "CLIENT" ? (
            <Appbar.Header mode="small" style={styles.paperAppbar}>
              <Appbar.Content
                title="Livraison Pro"
                subtitle={`${currentUser.role} · ${activeTabLabel}`}
              />
              <Appbar.Action icon="refresh" onPress={refreshCurrentContext} />
              <Appbar.Action
                icon="account-circle-outline"
                onPress={() => setActiveTab("profile")}
              />
            </Appbar.Header>
          ) : null}

          <View style={styles.content}>{renderRoleContent()}</View>
          <BottomNavigation.Bar
            navigationState={navigationState}
            onTabPress={({ route }) => setActiveTab(route.key as TabKey)}
            renderIcon={({ route, color }) => (
              <MaterialCommunityIcons
                name={
                  ((route as { focusedIcon?: keyof typeof MaterialCommunityIcons.glyphMap })
                    .focusedIcon ?? "circle-outline") as keyof typeof MaterialCommunityIcons.glyphMap
                }
                size={20}
                color={color}
              />
            )}
            activeColor={templatePalette.primaryDark}
            inactiveColor="#94A3B8"
            style={styles.paperBottomBar}
          />
        </View>
        <Snackbar
          visible={Boolean(errorMessage)}
          onDismiss={() => setErrorMessage(null)}
          duration={3600}
          style={styles.paperErrorSnackbar}
        >
          {errorMessage}
        </Snackbar>
        <Snackbar
          visible={Boolean(infoMessage)}
          onDismiss={() => setInfoMessage(null)}
          duration={2600}
          style={styles.paperInfoSnackbar}
        >
          {infoMessage}
        </Snackbar>
      </SafeAreaView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: templatePalette.background,
  },
  authRoot: {
    flex: 1,
    backgroundColor: "#111827",
  },
  uberAuthHero: {
    flex: 0.38,
    paddingHorizontal: 20,
    paddingTop: 26,
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  uberBrandPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  uberBrandPillText: {
    color: "#F9FAFB",
    fontSize: 11,
    fontWeight: "700",
  },
  uberBrandTitle: {
    color: "#FFFFFF",
    marginTop: 12,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  uberBrandSubtitle: {
    color: "#D1D5DB",
    marginTop: 8,
    lineHeight: 19,
    maxWidth: "90%",
  },
  uberBrandSubtitleSecondary: {
    color: "#9CA3AF",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: "92%",
    fontSize: 12,
  },
  onboardingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4B5563",
    marginTop: 8,
  },
  onboardingDotActive: {
    backgroundColor: "#FFFFFF",
    width: 18,
  },
  uberAuthSheet: {
    flex: 0.62,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 16,
  },
  uberInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    color: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 14,
  },
  uberPrimaryButton: {
    borderRadius: 12,
    minHeight: 50,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  uberPrimaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  uberSecondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#111827",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uberSecondaryButtonText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 14,
  },
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  paperAppbar: {
    backgroundColor: templatePalette.surface,
    borderBottomWidth: 1,
    borderBottomColor: templatePalette.border,
  },
  paperBottomBar: {
    backgroundColor: templatePalette.surface,
    borderTopWidth: 1,
    borderTopColor: templatePalette.border,
  },
  paperErrorSnackbar: {
    backgroundColor: "#B91C1C",
  },
  paperInfoSnackbar: {
    backgroundColor: "#1F2937",
  },
  authScreen: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  authHeader: {
    marginBottom: 18,
  },
  authTitle: {
    color: "#0F172A",
    fontSize: 30,
    fontWeight: "800",
  },
  authSubtitle: {
    color: "#475569",
    marginTop: 8,
    lineHeight: 20,
  },
  authCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: templatePalette.border,
    backgroundColor: templatePalette.surface,
    padding: 14,
  },
  authModeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  authModeChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingVertical: 8,
    alignItems: "center",
  },
  authModeChipActive: {
    borderColor: templatePalette.primaryDark,
    backgroundColor: "#FFF3C4",
  },
  authModeText: {
    color: "#475569",
    fontWeight: "600",
  },
  authModeTextActive: {
    color: templatePalette.ink,
  },
  authRoleRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  authRoleChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  authRoleChipActive: {
    borderColor: templatePalette.primaryDark,
    backgroundColor: "#FFF3C4",
  },
  authRoleText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  authRoleTextActive: {
    color: templatePalette.ink,
  },
  authInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    color: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  authFootnote: {
    color: "#64748B",
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  heroCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  heroTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: "#334155",
    marginTop: 6,
  },
  searchBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderColor: "#E2E8F0",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 46,
  },
  searchInput: {
    color: "#111827",
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  templateHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  templateGreeting: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  templateLocation: {
    color: "#6B7280",
    marginTop: 4,
    fontSize: 13,
  },
  templatePageTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  templateIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: templatePalette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  templateFilterButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: templatePalette.primary,
  },
  templatePromoCard: {
    height: 170,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#111827",
  },
  templatePromoImage: {
    width: "100%",
    height: "100%",
  },
  templatePromoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 14,
  },
  templatePromoBadge: {
    alignSelf: "flex-start",
    backgroundColor: templatePalette.primary,
    color: "#111827",
    fontWeight: "700",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 8,
  },
  templatePromoTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  templatePromoSubtitle: {
    color: "#F3F4F6",
    marginTop: 4,
  },
  templateSectionLabel: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 6,
  },
  templateCategoriesContainer: {
    paddingBottom: 12,
    gap: 8,
  },
  templateCategoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: templatePalette.border,
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  templateCategoryChipActive: {
    backgroundColor: templatePalette.primary,
    borderColor: templatePalette.primary,
  },
  templateCategoryText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  templateCategoryTextActive: {
    color: "#111827",
  },
  templateStoreRowCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: templatePalette.border,
    backgroundColor: "#FFFFFF",
    padding: 9,
    marginBottom: 10,
    gap: 10,
  },
  templateStoreThumb: {
    width: 84,
    height: 84,
    borderRadius: 12,
  },
  templateStoreContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  templateStoreName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  templateStoreDesc: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 16,
    marginVertical: 5,
  },
  templateRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    backgroundColor: "#FFF7D6",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  templateRatingText: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "700",
  },
  templateMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F9FAFB",
  },
  templateMetaText: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
  },
  glovoMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  glovoOpenButton: {
    borderRadius: 999,
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 5,
    justifyContent: "center",
  },
  glovoOpenButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  templateStoreHeroCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 12,
  },
  templateStoreHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 14,
  },
  templateMapCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: templatePalette.border,
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginBottom: 12,
  },
  templateMapView: {
    width: "100%",
    height: 180,
    borderRadius: 12,
  },
  templateStoreHeroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  templateStoreHeroSubtitle: {
    color: "#E5E7EB",
    marginTop: 4,
    fontSize: 13,
  },
  templateProductRowCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderColor: templatePalette.border,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  templateStockText: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
    marginRight: 4,
  },
  categoriesContainer: {
    paddingBottom: 12,
    gap: 8,
  },
  categoryChip: {
    borderRadius: 999,
    borderColor: "#CBD5E1",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  categoryChipActive: {
    backgroundColor: templatePalette.primary,
    borderColor: templatePalette.primary,
  },
  categoryChipText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  sectionSubtitle: {
    color: "#334155",
    marginBottom: 8,
    marginTop: 4,
    fontSize: 15,
    fontWeight: "600",
  },
  supportingText: {
    color: "#64748B",
    marginBottom: 12,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  centeredStateText: {
    color: "#64748B",
  },
  storeCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    marginBottom: 12,
  },
  storeCardImage: {
    width: "100%",
    height: 130,
  },
  storeCardContent: {
    padding: 12,
  },
  storeCardTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  storeCardDescription: {
    color: "#64748B",
    lineHeight: 18,
  },
  storeCardMeta: {
    color: "#475569",
    marginTop: 8,
    fontSize: 12,
  },
  productCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  storeHeroImage: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    marginBottom: 12,
  },
  productImage: {
    width: 95,
    height: 95,
  },
  productContent: {
    flex: 1,
    padding: 10,
    justifyContent: "space-between",
  },
  productName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  productDescription: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
  },
  productMeta: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 6,
  },
  productPrice: {
    color: templatePalette.ink,
    fontWeight: "700",
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: templatePalette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cartItemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginBottom: 10,
  },
  cartItemImage: {
    width: 58,
    height: 58,
    borderRadius: 12,
  },
  cartItemContent: {
    flex: 1,
    marginLeft: 10,
  },
  cartItemName: {
    color: "#111827",
    fontWeight: "600",
    marginBottom: 4,
  },
  cartItemPrice: {
    color: templatePalette.primaryDark,
    fontWeight: "700",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: {
    color: "#111827",
    minWidth: 18,
    textAlign: "center",
    fontWeight: "700",
  },
  addressCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 10,
  },
  addressTitle: {
    color: "#111827",
    fontWeight: "600",
    marginBottom: 8,
  },
  addressInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    color: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pricingCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  pricingLabel: {
    color: "#64748B",
  },
  pricingValue: {
    color: "#111827",
  },
  pricingTotalLabel: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 16,
  },
  pricingTotalValue: {
    color: templatePalette.primaryDark,
    fontWeight: "700",
    fontSize: 16,
  },
  separator: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  separatorTop: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    marginTop: 8,
  },
  checkoutButton: {
    borderRadius: 14,
    backgroundColor: templatePalette.primary,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  checkoutButtonDisabled: {
    opacity: 0.7,
  },
  checkoutButtonText: {
    color: templatePalette.ink,
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: templatePalette.primaryDark,
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: templatePalette.ink,
    fontWeight: "700",
  },
  trackingHero: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  trackingStatus: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "700",
  },
  trackingEta: {
    color: "#475569",
    marginTop: 6,
  },
  trackingOrder: {
    color: "#64748B",
    marginTop: 2,
  },
  mapCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  trackingMapView: {
    width: "100%",
    height: 210,
    borderRadius: 12,
  },
  mapFallbackCard: {
    width: "100%",
    minHeight: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    gap: 8,
  },
  mapFallbackText: {
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    fontSize: 12,
  },
  mapCardTitle: {
    color: "#111827",
    fontWeight: "600",
  },
  mapCoordinate: {
    color: "#64748B",
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: templatePalette.primaryDark,
  },
  timelineLabel: {
    color: "#111827",
    fontWeight: "600",
  },
  timelineTimestamp: {
    color: "#64748B",
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EF4444",
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  emptyBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  emptyBoxText: {
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  profileCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: templatePalette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 16,
  },
  profileHint: {
    color: "#64748B",
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 14,
    alignItems: "center",
  },
  statValue: {
    color: templatePalette.primaryDark,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  statLabel: {
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
    fontSize: 12,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 10,
    gap: 5,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  addressResultCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addressResultIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  rideOptionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 10,
    gap: 5,
  },
  rideOptionCardActive: {
    borderColor: "#111827",
    backgroundColor: "#F8FAFC",
  },
  rideOptionSubline: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },
  rideOptionPrice: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 16,
  },
  gojekHeaderCard: {
    borderRadius: 16,
    backgroundColor: gojekPalette.lightGrey,
    borderWidth: 1,
    borderColor: gojekPalette.grey,
    padding: 12,
    marginBottom: 10,
  },
  gojekHeaderTitle: {
    color: gojekPalette.darkGreen,
    fontWeight: "800",
    marginBottom: 10,
  },
  gojekServiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gojekServiceItem: {
    width: "22%",
    alignItems: "center",
  },
  gojekServiceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  gojekUberIcon: {
    backgroundColor: templatePalette.primaryDark,
  },
  gojekGlovoIcon: {
    backgroundColor: gojekPalette.green,
  },
  gojekServiceLabel: {
    color: "#1F2937",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  glovoHeroBanner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    marginBottom: 10,
  },
  glovoHeroTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  glovoHeroText: {
    color: "#475569",
    lineHeight: 19,
    fontSize: 13,
  },
  uberHeroCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  uberHeroTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  uberHeroSubtitle: {
    color: "#D1D5DB",
    marginTop: 6,
    lineHeight: 18,
    fontSize: 13,
  },
  uberHeroAction: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  uberHeroActionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  infoCardTitle: {
    color: "#111827",
    fontWeight: "700",
    marginBottom: 4,
  },
  infoCardText: {
    color: "#475569",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  rowActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  smallAction: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: templatePalette.primaryDark,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  uberShortcut: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smallActionSelected: {
    backgroundColor: "#FEF3C7",
  },
  smallActionDanger: {
    borderColor: "#EF4444",
  },
  smallActionText: {
    color: templatePalette.ink,
    fontWeight: "600",
    fontSize: 12,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorBannerText: {
    color: "#B91C1C",
    flex: 1,
  },
  infoBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoBannerText: {
    color: templatePalette.ink,
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  tabItem: {
    alignItems: "center",
    gap: 4,
    minWidth: 65,
  },
  tabLabel: {
    color: "#64748B",
    fontSize: 11,
  },
  tabLabelActive: {
    color: templatePalette.primaryDark,
    fontWeight: "600",
  },
});
