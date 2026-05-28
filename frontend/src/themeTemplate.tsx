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
          color="#D89B00"
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
    borderRadius: 18,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
  },
  headerMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    backgroundColor: "#FFF3C4",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: "#0F172A",
    fontWeight: "800",
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: 12,
    alignItems: "center",
  },
  metricIconWrap: {
    backgroundColor: "#FFF7D6",
    marginBottom: 8,
  },
  metricValue: {
    color: "#D89B00",
    fontWeight: "800",
    textAlign: "center",
  },
  metricLabel: {
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
});
