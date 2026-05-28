import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Avatar, Button, Card, Surface, Text } from "react-native-paper";

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
    <Card mode="outlined" style={styles.headerCard}>
      <Card.Content style={styles.headerMain}>
        <Avatar.Icon
          size={38}
          style={styles.iconWrap}
          color="#111827"
          icon={({ size, color }) => (
            <MaterialCommunityIcons name={icon} size={size} color={color} />
          )}
        />
        <View style={styles.headerContent}>
          <Text variant="titleMedium" style={styles.headerTitle}>
            {title}
          </Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>
            {subtitle}
          </Text>
        </View>
      </Card.Content>
      {actionLabel && onActionPress ? (
        <Card.Actions style={styles.cardActions}>
          <Button
            mode="contained"
            buttonColor="#F5C518"
            textColor="#111827"
            onPress={onActionPress}
          >
            {actionLabel}
          </Button>
        </Card.Actions>
      ) : null}
    </Card>
  );
}

export function ThemeMetricCard({ icon, value, label }: ThemeMetricCardProps) {
  return (
    <Surface style={styles.metricCard} elevation={0}>
      <Avatar.Icon
        size={28}
        style={styles.metricIconWrap}
        color="#D89B00"
        icon={({ size, color }) => (
          <MaterialCommunityIcons name={icon} size={size} color={color} />
        )}
      />
      <Text variant="headlineSmall" style={styles.metricValue}>
        {value}
      </Text>
      <Text variant="bodySmall" style={styles.metricLabel}>
        {label}
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    borderRadius: 22,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  headerMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    backgroundColor: "#F8FAFC",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: "#0F172A",
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#475569",
    marginTop: 2,
  },
  cardActions: {
    justifyContent: "flex-start",
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  metricIconWrap: {
    backgroundColor: "#EEF2FF",
    marginBottom: 8,
  },
  metricValue: {
    color: "#111827",
    fontWeight: "800",
    textAlign: "center",
  },
  metricLabel: {
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
});
