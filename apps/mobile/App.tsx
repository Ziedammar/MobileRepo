import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
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
  setAuthToken,
} from "./src/api";
import type {
  AdminDashboardResponse,
  AdminOrder,
  AuthResponse,
  AuthUser,
  Courier,
  HomeResponse,
  LivreurOrdersResponse,
  OrderDetails,
  Product,
  StoreDetails,
  TrackingResponse,
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

const signupRoles: Array<{
  role: SignupRole;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { role: "CLIENT", label: "Client", icon: "account-outline" },
  { role: "ADMIN", label: "Admin", icon: "storefront-outline" },
  { role: "LIVREUR", label: "Livreur", icon: "motorbike" },
];

const clientTabs: Array<{
  key: TabKey;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: "home", label: "Accueil", icon: "home-variant-outline" },
  { key: "cart", label: "Panier", icon: "cart-outline" },
  { key: "tracking", label: "Suivi", icon: "map-marker-path" },
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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [loadingHome, setLoadingHome] = useState(true);
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreDetails | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [searchValue, setSearchValue] = useState("");

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authRole, setAuthRole] = useState<Exclude<UserRole, "SUPER_ADMIN">>("CLIENT");
  const [authName, setAuthName] = useState("Client Mobile");
  const [authEmail, setAuthEmail] = useState("client@livraisonpro.app");
  const [authPassword, setAuthPassword] = useState("Client123!");
  const [authStoreName, setAuthStoreName] = useState("Mon Restaurant");
  const [authVehicle, setAuthVehicle] = useState("Scooter");
  const [authLoading, setAuthLoading] = useState(false);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [addressText, setAddressText] = useState("Les Berges du Lac, Tunis");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);

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
  }, [sessionToken]);

  const applyAuthResponse = (response: AuthResponse) => {
    if (response.token && response.user.accessStatus === "ACTIVE") {
      setSessionToken(response.token);
      setCurrentUser(response.user);
      setInfoMessage(response.message);
      setErrorMessage(null);
      setActiveTab("home");
      return;
    }

    setSessionToken(null);
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

  const logout = () => {
    setSessionToken(null);
    setCurrentUser(null);
    setAuthToken(null);
    setActiveTab("home");
    setOrderId(null);
    setOrderDetails(null);
    setTracking(null);
    setInfoMessage("Session deconnectee");
  };

  const refreshOrder = async (targetOrderId: string) => {
    const [details, trackingData] = await Promise.all([
      api.getOrder(targetOrderId),
      api.getTracking(targetOrderId),
    ]);
    setOrderDetails(details);
    setTracking(trackingData);
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
      return categoryMatch && searchMatch;
    });
  }, [home, selectedCategory, searchValue]);

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

  const renderClientHome = () => {
    if (selectedStore) {
      return (
        <View style={styles.screen}>
          <View style={styles.rowBetween}>
            <Pressable
              style={styles.iconButton}
              onPress={() => setSelectedStore(null)}
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color="#1F2937" />
            </Pressable>
            <Text style={styles.sectionTitle}>{selectedStore.name}</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Image source={{ uri: selectedStore.imageUrl }} style={styles.storeHeroImage} />
            <Text style={styles.supportingText}>{selectedStore.description}</Text>

            {selectedStore.products.map((product) => (
              <View key={product.id} style={styles.productCard}>
                <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
                <View style={styles.productContent}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productDescription}>{product.description}</Text>
                  <Text style={styles.productMeta}>
                    {product.category ?? "General"} · Stock: {product.stock ?? 0}
                  </Text>
                  <View style={styles.rowBetween}>
                    <Text style={styles.productPrice}>{money(product.price)}</Text>
                    <Pressable
                      style={styles.addButton}
                      onPress={() => addProductToCart(selectedStore.id, product)}
                    >
                      <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    if (loadingHome) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#00A082" />
          <Text style={styles.centeredStateText}>Chargement...</Text>
        </View>
      );
    }

    if (!home) {
      return (
        <View style={styles.centeredState}>
          <Text style={styles.centeredStateText}>Impossible de charger l'accueil.</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#D1FAE5", "#ECFDF5"]} style={styles.heroCard}>
          <Text style={styles.heroTitle}>{home.hero.title}</Text>
          <Text style={styles.heroSubtitle}>{home.hero.subtitle}</Text>
        </LinearGradient>

        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color="#64748B" />
          <TextInput
            value={searchValue}
            onChangeText={setSearchValue}
            placeholder="Rechercher un restaurant"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((category) => {
            const selected = category === selectedCategory;
            return (
              <Pressable
                key={category}
                style={[styles.categoryChip, selected ? styles.categoryChipActive : null]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selected ? styles.categoryChipTextActive : null,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionSubtitle}>Restaurants</Text>
        {filteredStores.map((store) => (
          <Pressable
            key={store.id}
            style={styles.storeCard}
            onPress={() => void openStore(store.id)}
          >
            <Image source={{ uri: store.imageUrl }} style={styles.storeCardImage} />
            <View style={styles.storeCardContent}>
              <Text style={styles.storeCardTitle}>{store.name}</Text>
              <Text style={styles.storeCardDescription}>{store.description}</Text>
              <Text style={styles.storeCardMeta}>
                ⭐ {store.rating.toFixed(1)} · {store.etaMinutes} min · 🚚{" "}
                {money(store.deliveryFee)}
              </Text>
            </View>
          </Pressable>
        ))}
        {filteredStores.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="store-search-outline" size={28} color="#00A082" />
            <Text style={styles.emptyBoxText}>
              Aucun restaurant pour le moment. Cree un compte Admin, fais valider par Super
              Admin, puis ajoute des produits.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  const renderClientCart = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Panier client</Text>
      <Text style={styles.supportingText}>
        {cartStore ? `${cartStore.name} · ${cartStore.category}` : "Panier vide"}
      </Text>

      {cartItems.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="cart-outline" size={30} color="#8FA1CB" />
          <Text style={styles.emptyBoxText}>Ajoutez des produits pour commander</Text>
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
            <Text style={styles.addressTitle}>Adresse</Text>
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
              <Text style={styles.checkoutButtonText}>
                Commander + paiement instantane
              </Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );

  const renderClientTracking = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Suivi commande</Text>

      {!orderId || !orderDetails || !tracking ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="map-marker-path" size={30} color="#8FA1CB" />
          <Text style={styles.emptyBoxText}>
            Passez une commande pour activer le tracking.
          </Text>
        </View>
      ) : (
        <>
          <LinearGradient colors={["#E0F2FE", "#ECFDF5"]} style={styles.trackingHero}>
            <Text style={styles.trackingStatus}>{orderDetails.statusLabel}</Text>
            <Text style={styles.trackingEta}>Paiement: {orderDetails.paymentStatus}</Text>
            <Text style={styles.trackingEta}>ETA {tracking.etaMinutes} min</Text>
            <Text style={styles.trackingOrder}>#{orderDetails.id.slice(0, 8)}</Text>
          </LinearGradient>

          <View style={styles.mapCard}>
            <Text style={styles.mapCardTitle}>Position live</Text>
            <Text style={styles.mapCoordinate}>
              📍 {tracking.position.lat.toFixed(4)}, {tracking.position.lng.toFixed(4)}
            </Text>
            <Text style={styles.mapCoordinate}>
              🎯 {tracking.destination.text}
            </Text>
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

  const renderAdminDashboard = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Dashboard Restaurant</Text>
      {!adminDashboard ? (
        <View style={styles.emptyBox}>
          {loadingRoleData ? (
            <ActivityIndicator size="small" color="#00A082" />
          ) : (
            <Text style={styles.emptyBoxText}>Aucune donnee dashboard</Text>
          )}
        </View>
      ) : (
        <>
          <LinearGradient colors={["#D1FAE5", "#ECFDF5"]} style={styles.heroCard}>
            <Text style={styles.heroTitle}>{adminDashboard.store.name}</Text>
            <Text style={styles.heroSubtitle}>
              {adminDashboard.store.category} · Temps reel
            </Text>
          </LinearGradient>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{adminDashboard.stats.pendingOrders}</Text>
              <Text style={styles.statLabel}>A valider</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{adminDashboard.stats.deliveredToday}</Text>
              <Text style={styles.statLabel}>Livrees aujourd'hui</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {money(adminDashboard.stats.revenueToday)}
              </Text>
              <Text style={styles.statLabel}>CA du jour</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{adminDashboard.stats.availableCouriers}</Text>
              <Text style={styles.statLabel}>Livreurs dispo</Text>
            </View>
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
                  color="#00A082"
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
              color={product.isAvailable ? "#00A082" : "#EF4444"}
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
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{superDashboard.usersCount}</Text>
              <Text style={styles.statLabel}>Users</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{superDashboard.storesCount}</Text>
              <Text style={styles.statLabel}>Restaurants</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{superDashboard.pendingApprovals}</Text>
              <Text style={styles.statLabel}>A approuver</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{superDashboard.ordersToday}</Text>
              <Text style={styles.statLabel}>Cmd aujourd'hui</Text>
            </View>
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
          <MaterialCommunityIcons name="refresh" size={18} color="#00A082" />
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
          <LinearGradient colors={["#D1FAE5", "#ECFDF5"]} style={styles.heroCard}>
            <Text style={styles.heroTitle}>{livreurData.courier.name}</Text>
            <Text style={styles.heroSubtitle}>
              {livreurData.courier.vehicle} ·{" "}
              {livreurData.courier.isAvailable ? "Disponible" : "Occupe"}
            </Text>
          </LinearGradient>

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
      <Text style={styles.sectionTitle}>Profil</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <MaterialCommunityIcons name="account" size={24} color="#FFFFFF" />
        </View>
        <View>
          <Text style={styles.profileName}>{currentUser?.name}</Text>
          <Text style={styles.profileHint}>
            {currentUser?.role} · {currentUser?.email ?? "Invite"}
          </Text>
        </View>
      </View>

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

      <Pressable style={styles.secondaryButton} onPress={logout}>
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

  const renderAuthScreen = () => (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <LinearGradient colors={["#F9FAFB", "#F3F4F6"]} style={styles.authScreen}>
        <View style={styles.authHeader}>
          <Text style={styles.authTitle}>Livraison Pro</Text>
          <Text style={styles.authSubtitle}>
            Sign In / Sign Up moderne avec roles et validation Super Admin
          </Text>
        </View>

        <View style={styles.authCard}>
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={16}
                color="#B91C1C"
              />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}
          {infoMessage ? (
            <View style={styles.infoBanner}>
              <MaterialCommunityIcons
                name="information-outline"
                size={16}
                color="#065F46"
              />
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
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.authModeChip,
                authMode === "signup" ? styles.authModeChipActive : null,
              ]}
              onPress={() => setAuthMode("signup")}
            >
              <Text
                style={[
                  styles.authModeText,
                  authMode === "signup" ? styles.authModeTextActive : null,
                ]}
              >
                Sign Up
              </Text>
            </Pressable>
          </View>

          {authMode === "signup" ? (
            <>
              <TextInput
                value={authName}
                onChangeText={setAuthName}
                placeholder="Nom complet"
                placeholderTextColor="#94A3B8"
                style={styles.authInput}
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
                        color={selected ? "#00796B" : "#64748B"}
                        style={{ marginBottom: 4 }}
                      />
                      <Text
                        style={[
                          styles.authRoleText,
                          selected ? styles.authRoleTextActive : null,
                        ]}
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
                  placeholder="Nom restaurant (demande)"
                  placeholderTextColor="#94A3B8"
                  style={styles.authInput}
                />
              ) : null}
              {authRole === "LIVREUR" ? (
                <TextInput
                  value={authVehicle}
                  onChangeText={setAuthVehicle}
                  placeholder="Vehicule"
                  placeholderTextColor="#94A3B8"
                  style={styles.authInput}
                />
              ) : null}
            </>
          ) : null}

          <TextInput
            value={authEmail}
            onChangeText={setAuthEmail}
            placeholder="Email"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.authInput}
          />
          <TextInput
            value={authPassword}
            onChangeText={setAuthPassword}
            placeholder="Mot de passe"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            style={styles.authInput}
          />

          <Pressable
            style={[styles.checkoutButton, authLoading ? styles.checkoutButtonDisabled : null]}
            onPress={() => void submitAuth()}
            disabled={authLoading}
          >
            {authLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.checkoutButtonText}>
                {authMode === "signin" ? "Se connecter" : "Creer un compte"}
              </Text>
            )}
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => void continueAsGuest()}>
            <Text style={styles.secondaryButtonText}>Continuer en invite (client)</Text>
          </Pressable>

          <Text style={styles.authFootnote}>
            Client: acces direct. Admin et Livreur: validation Super Admin obligatoire.
          </Text>
          <Text style={styles.authFootnote}>
            Compte Super Admin de test: superadmin@livraisonpro.app / SuperAdmin123!
          </Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );

  if (!currentUser || !sessionToken) {
    return renderAuthScreen();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.root}>
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FCA5A5" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}
        {infoMessage ? (
          <View style={styles.infoBanner}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#7DD3FC" />
            <Text style={styles.infoBannerText}>{infoMessage}</Text>
          </View>
        ) : null}

        <View style={styles.content}>{renderRoleContent()}</View>
        <View style={styles.tabBar}>
          {roleTabs.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                style={styles.tabItem}
                onPress={() => setActiveTab(tab.key)}
              >
                <MaterialCommunityIcons
                  name={tab.icon}
                  size={20}
                  color={isActive ? "#00A082" : "#94A3B8"}
                />
                <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
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
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
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
    borderColor: "#00A082",
    backgroundColor: "#E6FFFA",
  },
  authModeText: {
    color: "#475569",
    fontWeight: "600",
  },
  authModeTextActive: {
    color: "#00796B",
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
    borderColor: "#00A082",
    backgroundColor: "#E6FFFA",
  },
  authRoleText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  authRoleTextActive: {
    color: "#00796B",
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
    backgroundColor: "#00A082",
    borderColor: "#00A082",
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
    color: "#00A082",
    fontWeight: "700",
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#00A082",
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
    color: "#00A082",
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
    color: "#00A082",
    fontWeight: "700",
    fontSize: 16,
  },
  separator: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  checkoutButton: {
    borderRadius: 14,
    backgroundColor: "#00A082",
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
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#00A082",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: "#00796B",
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
    backgroundColor: "#00A082",
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
    backgroundColor: "#00A082",
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
    color: "#00A082",
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
    borderColor: "#00A082",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  smallActionDanger: {
    borderColor: "#EF4444",
  },
  smallActionText: {
    color: "#00796B",
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
    borderColor: "#6EE7B7",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoBannerText: {
    color: "#065F46",
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
    color: "#00A082",
    fontWeight: "600",
  },
});
