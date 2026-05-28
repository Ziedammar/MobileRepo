import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { Colors, Fonts, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import type { RideHomeResponse, RideSearchResponse } from '@/src/types';

export default function RideSearchScreen() {
  const [rideHome, setRideHome] = useState<RideHomeResponse | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RideSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRideHome().then(setRideHome).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await api.searchRideDestination(q);
      setSearchResults(res);
    } catch {
      //
    } finally {
      setSearching(false);
    }
  };

  const handleSelectDestination = (dest: { title: string; address: string; lat: number; lng: number }) => {
    router.push({
      pathname: '/(client)/ride/options',
      params: {
        destTitle: dest.title,
        destAddress: dest.address,
        destLat: String(dest.lat),
        destLng: String(dest.lng),
        pickupLat: String(rideHome?.userLocation?.lat ?? 36.8065),
        pickupLng: String(rideHome?.userLocation?.lng ?? 10.1815),
        pickupAddress: rideHome?.userLocation?.address ?? 'Ma position',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Où allez-vous ?</Text>
      </View>

      {/* Pickup / Destination inputs */}
      <View style={styles.inputsCard}>
        <View style={styles.inputRow}>
          <View style={[styles.dot, styles.dotGreen]} />
          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>Départ</Text>
            <Text style={styles.inputValue} numberOfLines={1}>
              {rideHome?.userLocation?.address ?? 'Ma position actuelle'}
            </Text>
          </View>
        </View>
        <View style={styles.inputDivider} />
        <View style={styles.inputRow}>
          <View style={[styles.dot, styles.dotBlue]} />
          <TextInput
            style={styles.destInput}
            placeholder="Entrez votre destination"
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={handleSearch}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setSearchResults(null); }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {searching && <ActivityIndicator style={{ margin: 20 }} color={Colors.primary} />}

      {searchResults && searchResults.results.length > 0 ? (
        <FlatList
          data={searchResults.results}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => handleSelectDestination(item)}
              activeOpacity={0.8}
            >
              <View style={styles.resultIcon}>
                <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle}>{item.title}</Text>
                <Text style={styles.resultAddr} numberOfLines={1}>{item.address}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : !searching && !loading ? (
        <View style={styles.suggestions}>
          {/* Saved places */}
          {rideHome?.shortcuts?.home && (
            <TouchableOpacity
              style={styles.savedRow}
              onPress={() => handleSelectDestination({
                title: 'Maison',
                address: rideHome.shortcuts.home!.address,
                lat: rideHome.shortcuts.home!.lat,
                lng: rideHome.shortcuts.home!.lng,
              })}
            >
              <View style={[styles.savedIcon, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="home-outline" size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.savedLabel}>Maison</Text>
                <Text style={styles.savedAddr}>{rideHome.shortcuts.home.address}</Text>
              </View>
            </TouchableOpacity>
          )}

          {rideHome?.shortcuts?.work && (
            <TouchableOpacity
              style={styles.savedRow}
              onPress={() => handleSelectDestination({
                title: 'Bureau',
                address: rideHome.shortcuts.work!.address,
                lat: rideHome.shortcuts.work!.lat,
                lng: rideHome.shortcuts.work!.lng,
              })}
            >
              <View style={[styles.savedIcon, { backgroundColor: Colors.warningLight }]}>
                <Ionicons name="briefcase-outline" size={18} color={Colors.warning} />
              </View>
              <View>
                <Text style={styles.savedLabel}>Bureau</Text>
                <Text style={styles.savedAddr}>{rideHome.shortcuts.work.address}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Quick suggestions */}
          {rideHome?.quickSuggestions && rideHome.quickSuggestions.length > 0 && (
            <View>
              <Text style={styles.suggestTitle}>Suggestions</Text>
              {rideHome.quickSuggestions.map((s, i) => (
                <TouchableOpacity key={i} style={styles.savedRow} onPress={() => handleSearch(s)}>
                  <View style={[styles.savedIcon, { backgroundColor: Colors.backgroundGray }]}>
                    <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
                  </View>
                  <Text style={styles.savedLabel}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Recent rides */}
          {rideHome?.recent && rideHome.recent.length > 0 && (
            <View>
              <Text style={styles.suggestTitle}>Trajets récents</Text>
              {rideHome.recent.slice(0, 3).map((r) => (
                <TouchableOpacity key={r.id} style={styles.savedRow}>
                  <View style={[styles.savedIcon, { backgroundColor: Colors.backgroundGray }]}>
                    <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.savedLabel}>{r.destination}</Text>
                    <Text style={styles.savedAddr}>{r.serviceType} • {r.amount.toFixed(2)} DT</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: Fonts.brandBold, fontSize: 18, color: Colors.text },

  inputsCard: {
    margin: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundGray,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  dotGreen: { backgroundColor: Colors.success, borderColor: Colors.success },
  dotBlue: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  inputDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 34 },
  inputField: { flex: 1 },
  inputLabel: { fontFamily: Fonts.brand, fontSize: 11, color: Colors.textMuted },
  inputValue: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  destInput: { flex: 1, fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: { flex: 1 },
  resultTitle: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  resultAddr: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textMuted },

  suggestions: { padding: Spacing.lg, gap: 4 },
  suggestTitle: { fontFamily: Fonts.brandBold, fontSize: 13, color: Colors.textMuted, marginTop: 12, marginBottom: 4 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  savedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedLabel: { fontFamily: Fonts.brandMedium, fontSize: 14, color: Colors.text },
  savedAddr: { fontFamily: Fonts.brand, fontSize: 12, color: Colors.textMuted },
});
