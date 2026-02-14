import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
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

import { API_BASE_URL, api } from "./src/api";
import type {
  HomeResponse,
  OrderDetails,
  Product,
  StoreDetails,
  TrackingResponse,
} from "./src/types";

type TabKey = "home" | "cart" | "tracking" | "profile";

type CartItem = {
  product: Product;
  quantity: number;
  storeId: string;
};

const tabConfig: Array<{
  key: TabKey;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: "home", label: "Accueil", icon: "home-variant-outline" },
  { key: "cart", label: "Panier", icon: "cart-outline" },
  { key: "tracking", label: "Tracking", icon: "map-marker-path" },
  { key: "profile", label: "Profil", icon: "account-circle-outline" },
];

const money = (value: number): string => `${value.toFixed(2)} DT`;

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "Une erreur inattendue est survenue";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreDetails | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [searchValue, setSearchValue] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [loadingStore, setLoadingStore] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);
  const [addressText, setAddressText] = useState("Les Berges du Lac, Tunis");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchHome = async () => {
      setLoadingHome(true);
      try {
        const response = await api.getHome();
        setHome(response);
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(errorText(error));
      } finally {
        setLoadingHome(false);
      }
    };

    void fetchHome();
  }, []);

  const refreshOrderState = async (targetOrderId: string): Promise<void> => {
    const [details, trackingData] = await Promise.all([
      api.getOrder(targetOrderId),
      api.getTracking(targetOrderId),
    ]);

    setOrderDetails(details);
    setTracking(trackingData);
  };

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let isCancelled = false;

    const pollOrder = async () => {
      try {
        const [details, trackingData] = await Promise.all([
          api.getOrder(orderId),
          api.getTracking(orderId),
        ]);

        if (!isCancelled) {
          setOrderDetails(details);
          setTracking(trackingData);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(errorText(error));
        }
      }
    };

    void pollOrder();
    const interval = setInterval(() => void pollOrder(), 6000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [orderId]);

  const ensureGuestUser = async (): Promise<string> => {
    if (guestUserId) {
      return guestUserId;
    }

    const auth = await api.authGuest({ name: "Client Mobile" });
    setGuestUserId(auth.user.id);
    return auth.user.id;
  };

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

    const normalizedSearch = searchValue.trim().toLowerCase();

    return home.stores.filter((store) => {
      const matchCategory =
        selectedCategory === "Tous" || store.category === selectedCategory;
      const matchSearch =
        normalizedSearch.length === 0 ||
        store.name.toLowerCase().includes(normalizedSearch) ||
        store.description.toLowerCase().includes(normalizedSearch) ||
        store.category.toLowerCase().includes(normalizedSearch);

      return matchCategory && matchSearch;
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
    setLoadingStore(true);
    setErrorMessage(null);
    try {
      const store = await api.getStore(storeId);
      setSelectedStore(store);
      setActiveTab("home");
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setLoadingStore(false);
    }
  };

  const addProductToCart = (storeId: string, product: Product) => {
    setCartItems((previousCart) => {
      if (previousCart.length > 0 && previousCart[0].storeId !== storeId) {
        return [{ product, quantity: 1, storeId }];
      }

      const existingItem = previousCart.find(
        (item) => item.product.id === product.id,
      );

      if (existingItem) {
        return previousCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...previousCart, { product, quantity: 1, storeId }];
    });
  };

  const changeCartQuantity = (productId: string, delta: number) => {
    setCartItems((previousCart) =>
      previousCart
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const checkout = async () => {
    if (cartItems.length === 0 || !cartStoreId) {
      return;
    }

    setProcessingCheckout(true);
    try {
      const userId = await ensureGuestUser();
      const order = await api.createOrder({
        userId,
        storeId: cartStoreId,
        addressText,
        addressLat: 36.842,
        addressLng: 10.272,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });

      setOrderId(order.id);
      await refreshOrderState(order.id);
      setActiveTab("tracking");
      setSelectedStore(null);
      setCartItems([]);
      setErrorMessage(null);
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
      await refreshOrderState(orderId);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  };

  const renderStoreDetails = () => {
    if (!selectedStore) {
      return null;
    }

    return (
      <View style={styles.screen}>
        <View style={styles.storeHeaderRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => setSelectedStore(null)}
            accessibilityLabel="Retour"
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.storeHeaderTitle}>{selectedStore.name}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Image source={{ uri: selectedStore.imageUrl }} style={styles.storeHeroImage} />

          <View style={styles.storeIdentity}>
            <View style={styles.badgeRow}>
              <View style={styles.badgeChip}>
                <MaterialCommunityIcons
                  name="star"
                  size={14}
                  color="#F59E0B"
                />
                <Text style={styles.badgeText}>{selectedStore.rating.toFixed(1)}</Text>
              </View>
              <View style={styles.badgeChip}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color="#22C55E"
                />
                <Text style={styles.badgeText}>{selectedStore.etaMinutes} min</Text>
              </View>
              <View style={styles.badgeChip}>
                <MaterialCommunityIcons
                  name="motorbike"
                  size={14}
                  color="#60A5FA"
                />
                <Text style={styles.badgeText}>{money(selectedStore.deliveryFee)}</Text>
              </View>
            </View>
            <Text style={styles.storeDescription}>{selectedStore.description}</Text>
          </View>

          <Text style={styles.sectionTitle}>Le menu</Text>
          {selectedStore.products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
              <View style={styles.productContent}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productDescription}>{product.description}</Text>
                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>{money(product.price)}</Text>
                  <Pressable
                    style={styles.addButton}
                    onPress={() => addProductToCart(selectedStore.id, product)}
                    accessibilityLabel={`Ajouter ${product.name}`}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={18}
                      color="#0B1020"
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {cartItemsCount > 0 ? (
          <Pressable style={styles.floatingCartButton} onPress={() => setActiveTab("cart")}>
            <Text style={styles.floatingCartText}>
              Voir le panier · {cartItemsCount} article(s)
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#0B1020" />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderHome = () => {
    if (selectedStore) {
      return renderStoreDetails();
    }

    if (loadingHome) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#22D3EE" />
          <Text style={styles.centeredStateText}>Chargement de l'accueil...</Text>
        </View>
      );
    }

    if (!home) {
      return (
        <View style={styles.centeredState}>
          <Text style={styles.centeredStateText}>Impossible de charger les donnees.</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#121B3A", "#1E293B"]} style={styles.heroCard}>
          <Text style={styles.heroTitle}>{home.hero.title}</Text>
          <Text style={styles.heroSubtitle}>{home.hero.subtitle}</Text>
          <View style={styles.heroPills}>
            <View style={styles.heroPill}>
              <MaterialCommunityIcons name="lightning-bolt" color="#22D3EE" size={14} />
              <Text style={styles.heroPillText}>Livraison 20-30 min</Text>
            </View>
            <View style={styles.heroPill}>
              <MaterialCommunityIcons name="storefront-outline" color="#F59E0B" size={14} />
              <Text style={styles.heroPillText}>+20 partenaires</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color="#93A1C6" />
          <TextInput
            value={searchValue}
            onChangeText={setSearchValue}
            placeholder="Rechercher un store ou une categorie"
            placeholderTextColor="#7A89AF"
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

        <Text style={styles.sectionTitle}>Stores recommandes</Text>
        {loadingStore ? (
          <ActivityIndicator size="small" color="#22D3EE" style={styles.inlineLoader} />
        ) : null}

        {filteredStores.map((store) => (
          <Pressable key={store.id} style={styles.storeCard} onPress={() => void openStore(store.id)}>
            <Image source={{ uri: store.imageUrl }} style={styles.storeCardImage} />
            <View style={styles.storeCardContent}>
              <View style={styles.storeCardTitleRow}>
                <Text style={styles.storeCardTitle}>{store.name}</Text>
                <Text style={styles.storeCardCategory}>{store.category}</Text>
              </View>
              <Text style={styles.storeCardDescription} numberOfLines={2}>
                {store.description}
              </Text>
              <View style={styles.storeCardMetaRow}>
                <Text style={styles.storeCardMeta}>⭐ {store.rating.toFixed(1)}</Text>
                <Text style={styles.storeCardMeta}>🕒 {store.etaMinutes} min</Text>
                <Text style={styles.storeCardMeta}>🚚 {money(store.deliveryFee)}</Text>
              </View>
            </View>
          </Pressable>
        ))}

        {filteredStores.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyBoxText}>Aucun resultat pour ce filtre.</Text>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  const renderCart = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Votre panier</Text>
      <Text style={styles.supportingText}>
        {cartStore ? `${cartStore.name} · ${cartStore.category}` : "Aucun store selectionne"}
      </Text>

      {cartItems.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="cart-outline" size={32} color="#9FAED0" />
          <Text style={styles.emptyBoxText}>
            Panier vide. Ajoutez des produits depuis un store.
          </Text>
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
                  <MaterialCommunityIcons name="minus" size={16} color="#E6EDFF" />
                </Pressable>
                <Text style={styles.quantityValue}>{item.quantity}</Text>
                <Pressable
                  style={styles.quantityButton}
                  onPress={() => changeCartQuantity(item.product.id, 1)}
                >
                  <MaterialCommunityIcons name="plus" size={16} color="#E6EDFF" />
                </Pressable>
              </View>
            </View>
          ))}

          <View style={styles.addressCard}>
            <Text style={styles.addressTitle}>Adresse de livraison</Text>
            <TextInput
              value={addressText}
              onChangeText={setAddressText}
              placeholder="Votre adresse"
              placeholderTextColor="#7A89AF"
              style={styles.addressInput}
            />
          </View>

          <View style={styles.pricingCard}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Sous-total</Text>
              <Text style={styles.pricingValue}>{money(cartSubtotal)}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Livraison</Text>
              <Text style={styles.pricingValue}>{money(cartDeliveryFee)}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.pricingRow}>
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
              <ActivityIndicator size="small" color="#0B1020" />
            ) : (
              <>
                <Text style={styles.checkoutButtonText}>Commander maintenant</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#0B1020" />
              </>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );

  const renderTracking = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Suivi en direct</Text>

      {!orderId || !orderDetails || !tracking ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="map-marker-path" size={32} color="#9FAED0" />
          <Text style={styles.emptyBoxText}>
            Passez une commande pour activer le tracking.
          </Text>
        </View>
      ) : (
        <>
          <LinearGradient colors={["#163A73", "#1E3A8A"]} style={styles.trackingHero}>
            <Text style={styles.trackingStatus}>{orderDetails.statusLabel}</Text>
            <Text style={styles.trackingEta}>ETA {tracking.etaMinutes} min</Text>
            <Text style={styles.trackingOrder}>Commande #{orderDetails.id.slice(0, 8)}</Text>
          </LinearGradient>

          <View style={styles.mapCard}>
            <Text style={styles.mapCardTitle}>Position livreur (simulation)</Text>
            <Text style={styles.mapCoordinate}>
              📍 {tracking.position.lat.toFixed(4)}, {tracking.position.lng.toFixed(4)}
            </Text>
            <Text style={styles.mapCoordinate}>
              🎯 Destination : {tracking.destination.text}
            </Text>
          </View>

          <View style={styles.courierCard}>
            <Text style={styles.courierTitle}>Livreur</Text>
            {tracking.courier ? (
              <>
                <Text style={styles.courierText}>
                  {tracking.courier.name} · {tracking.courier.vehicle}
                </Text>
                <Text style={styles.courierText}>
                  Note {tracking.courier.rating.toFixed(1)} / 5
                </Text>
              </>
            ) : (
              <Text style={styles.courierText}>Affectation en cours...</Text>
            )}
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

          {orderDetails.status !== "DELIVERED" && orderDetails.status !== "CANCELLED" ? (
            <Pressable style={styles.cancelButton} onPress={() => void cancelOrder()}>
              <Text style={styles.cancelButtonText}>Annuler la commande</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Profil</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <MaterialCommunityIcons name="account" size={24} color="#0B1020" />
        </View>
        <View>
          <Text style={styles.profileName}>Client Mobile</Text>
          <Text style={styles.profileHint}>Compte invite connecte</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{home?.stores.length ?? 0}</Text>
          <Text style={styles.statLabel}>Stores actifs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{orderId ? 1 : 0}</Text>
          <Text style={styles.statLabel}>Commande recente</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Configuration API</Text>
        <Text style={styles.infoCardText}>{API_BASE_URL}</Text>
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return renderHome();
      case "cart":
        return renderCart();
      case "tracking":
        return renderTracking();
      case "profile":
        return renderProfile();
      default:
        return renderHome();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.root}>
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" color="#FCA5A5" size={16} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}
        <View style={styles.content}>{renderContent()}</View>
        <View style={styles.tabBar}>
          {tabConfig.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <Pressable key={tab.key} style={styles.tabItem} onPress={() => setActiveTab(tab.key)}>
                <MaterialCommunityIcons
                  name={tab.icon}
                  size={20}
                  color={isActive ? "#22D3EE" : "#7A89AF"}
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
    backgroundColor: "#070B17",
  },
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  heroTitle: {
    color: "#F8FAFF",
    fontSize: 20,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: "#C5D4F5",
    marginTop: 8,
    marginBottom: 12,
    lineHeight: 20,
  },
  heroPills: {
    flexDirection: "row",
    gap: 10,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  heroPillText: {
    color: "#D8E4FF",
    fontSize: 12,
  },
  searchBox: {
    backgroundColor: "#0F172C",
    borderRadius: 14,
    borderColor: "#1F2B49",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 46,
  },
  searchInput: {
    color: "#E6EDFF",
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
    borderColor: "#2B3758",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#0E162B",
  },
  categoryChipActive: {
    backgroundColor: "#22D3EE",
    borderColor: "#22D3EE",
  },
  categoryChipText: {
    color: "#B9C7E8",
    fontSize: 13,
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: "#0B1020",
  },
  sectionTitle: {
    color: "#F8FAFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  sectionSubtitle: {
    color: "#C7D5F6",
    marginBottom: 8,
    marginTop: 4,
    fontSize: 15,
    fontWeight: "600",
  },
  supportingText: {
    color: "#95A7CF",
    marginBottom: 14,
  },
  storeCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0F172C",
    borderColor: "#1D2948",
    borderWidth: 1,
    marginBottom: 12,
  },
  storeCardImage: {
    width: "100%",
    height: 140,
  },
  storeCardContent: {
    padding: 12,
  },
  storeCardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  storeCardTitle: {
    color: "#F8FAFF",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  storeCardCategory: {
    color: "#22D3EE",
    fontSize: 12,
    fontWeight: "600",
    alignSelf: "center",
  },
  storeCardDescription: {
    color: "#9FB0D8",
    fontSize: 13,
    lineHeight: 18,
  },
  storeCardMetaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  storeCardMeta: {
    color: "#C6D5F6",
    fontSize: 12,
  },
  emptyBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#243255",
    backgroundColor: "#0E162B",
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  emptyBoxText: {
    color: "#AFC0E5",
    textAlign: "center",
    lineHeight: 20,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  centeredStateText: {
    color: "#B8C8EB",
  },
  inlineLoader: {
    marginBottom: 10,
  },
  storeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1B2743",
    marginRight: 8,
  },
  storeHeaderTitle: {
    color: "#F8FAFF",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  storeHeroImage: {
    width: "100%",
    height: 180,
    borderRadius: 18,
  },
  storeIdentity: {
    marginVertical: 12,
    gap: 8,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  badgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#121D39",
    borderRadius: 999,
    borderColor: "#27365D",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: "#D6E4FF",
    fontSize: 12,
    fontWeight: "600",
  },
  storeDescription: {
    color: "#AFC1E9",
    lineHeight: 20,
  },
  productCard: {
    flexDirection: "row",
    backgroundColor: "#0F172C",
    borderColor: "#1D2948",
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
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
    color: "#F8FAFF",
    fontSize: 14,
    fontWeight: "600",
  },
  productDescription: {
    color: "#A6B8E2",
    fontSize: 12,
    lineHeight: 17,
  },
  productFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productPrice: {
    color: "#22D3EE",
    fontWeight: "700",
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#22D3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingCartButton: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    borderRadius: 14,
    backgroundColor: "#22D3EE",
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  floatingCartText: {
    color: "#0B1020",
    fontWeight: "700",
  },
  cartItemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#243255",
    backgroundColor: "#0E162B",
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
    color: "#F8FAFF",
    fontWeight: "600",
    marginBottom: 4,
  },
  cartItemPrice: {
    color: "#22D3EE",
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
    backgroundColor: "#1E2A49",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: {
    color: "#E6EDFF",
    minWidth: 18,
    textAlign: "center",
    fontWeight: "700",
  },
  addressCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#25345A",
    backgroundColor: "#0E162B",
    padding: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  addressTitle: {
    color: "#D8E4FF",
    fontWeight: "600",
    marginBottom: 8,
  },
  addressInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A3B65",
    backgroundColor: "#101B34",
    color: "#F1F5FF",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pricingCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#25345A",
    backgroundColor: "#0E162B",
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pricingLabel: {
    color: "#AFC0E5",
  },
  pricingValue: {
    color: "#E7EEFF",
  },
  pricingTotalLabel: {
    color: "#F8FAFF",
    fontWeight: "700",
    fontSize: 16,
  },
  pricingTotalValue: {
    color: "#22D3EE",
    fontWeight: "700",
    fontSize: 16,
  },
  separator: {
    height: 1,
    backgroundColor: "#25345A",
  },
  checkoutButton: {
    borderRadius: 14,
    backgroundColor: "#22D3EE",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  checkoutButtonDisabled: {
    opacity: 0.7,
  },
  checkoutButtonText: {
    color: "#0B1020",
    fontWeight: "700",
    fontSize: 15,
  },
  trackingHero: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  trackingStatus: {
    color: "#F8FAFF",
    fontSize: 18,
    fontWeight: "700",
  },
  trackingEta: {
    color: "#C5D4F6",
    marginTop: 8,
  },
  trackingOrder: {
    color: "#9AB1DE",
    marginTop: 2,
  },
  mapCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#26355B",
    backgroundColor: "#0E162B",
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  mapCardTitle: {
    color: "#D7E4FF",
    fontWeight: "600",
  },
  mapCoordinate: {
    color: "#AFC0E5",
  },
  courierCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#26355B",
    backgroundColor: "#0E162B",
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  courierTitle: {
    color: "#D8E4FF",
    fontWeight: "700",
  },
  courierText: {
    color: "#AFC0E5",
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
    paddingBottom: 2,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: "#22D3EE",
  },
  timelineLabel: {
    color: "#E5EEFF",
    fontWeight: "600",
  },
  timelineTimestamp: {
    color: "#95A8D1",
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
    color: "#FCA5A5",
    fontWeight: "700",
  },
  profileCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#27375D",
    backgroundColor: "#0E162B",
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
    backgroundColor: "#22D3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    color: "#F8FAFF",
    fontWeight: "700",
    fontSize: 16,
  },
  profileHint: {
    color: "#9EB0D8",
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
    borderColor: "#27375D",
    backgroundColor: "#0E162B",
    padding: 14,
    alignItems: "center",
  },
  statValue: {
    color: "#22D3EE",
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    color: "#9EB0D8",
    marginTop: 4,
    textAlign: "center",
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#27375D",
    backgroundColor: "#0E162B",
    padding: 14,
  },
  infoCardTitle: {
    color: "#D8E4FF",
    fontWeight: "700",
    marginBottom: 6,
  },
  infoCardText: {
    color: "#9FB1D8",
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7F1D1D",
    backgroundColor: "#3F1118",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorBannerText: {
    color: "#FECACA",
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#1B2743",
    backgroundColor: "#090F1D",
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
    color: "#7A89AF",
    fontSize: 11,
  },
  tabLabelActive: {
    color: "#22D3EE",
    fontWeight: "600",
  },
});
