import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type ThemeHeaderCardProps = {
  icon: IconName;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

type ThemeMetricCardProps = {
  icon: IconName;
  value: string;
  label: string;
};

export function ThemeHeaderCard({
  icon,
  title,
  subtitle,
  actionLabel,
  onActionPress,
}: ThemeHeaderCardProps) {
  return (
    <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.headerCard}>
      <View style={styles.headerMain}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={icon} size={20} color="#00A082" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable style={styles.headerAction} onPress={onActionPress}>
          <Text style={styles.headerActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );
}

export function ThemeMetricCard({ icon, value, label }: ThemeMetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIconWrap}>
        <MaterialCommunityIcons name={icon} size={16} color="#00A082" />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  headerMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E6FFFA",
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 17,
  },
  headerSubtitle: {
    color: "#475569",
    marginTop: 4,
    lineHeight: 18,
  },
  headerAction: {
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00A082",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerActionText: {
    color: "#00796B",
    fontWeight: "700",
    fontSize: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    alignItems: "center",
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricValue: {
    color: "#00A082",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
  },
  metricLabel: {
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
    fontSize: 12,
  },
});
