import React from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, BorderRadius, Spacing } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400',
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400',
];

export default function Landing() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark, '#005FA3']}
        style={styles.gradient}
      />

      <View style={styles.heroImages}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          contentContainerStyle={styles.imagesRow}
        >
          {HERO_IMAGES.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={[
                styles.heroImage,
                { marginTop: i % 2 === 0 ? 0 : 30 },
              ]}
            />
          ))}
        </ScrollView>
        <LinearGradient
          colors={['transparent', Colors.primary]}
          style={styles.imageGradient}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.logoRow}>
          <Ionicons name="bicycle" size={32} color={Colors.white} />
          <Text style={styles.logoText}>LivraisonPro</Text>
        </View>

        <Text style={styles.tagline}>
          Tout livré,{'\n'}presque instantanément
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push('/(public)/signin')}
            activeOpacity={0.85}
          >
            <Ionicons name="mail-outline" size={20} color={Colors.text} />
            <Text style={styles.signInText}>Continuer avec l'e-mail</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signUpBtn}
            onPress={() => router.push('/(public)/signup')}
            activeOpacity={0.85}
          >
            <Text style={styles.signUpText}>Créer un compte</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.privacy}>
          En continuant, vous acceptez nos{' '}
          <Text style={styles.privacyLink}>Conditions d'utilisation</Text>
          {' '}et notre{' '}
          <Text style={styles.privacyLink}>Politique de confidentialité</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImages: {
    height: height * 0.45,
    overflow: 'hidden',
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 60,
  },
  heroImage: {
    width: 150,
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    justifyContent: 'flex-end',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontFamily: Fonts.brandBlack,
    fontSize: 24,
    color: Colors.white,
  },
  tagline: {
    fontFamily: Fonts.brandBlack,
    fontSize: 32,
    color: Colors.white,
    lineHeight: 38,
    marginBottom: Spacing.xxxl,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: Spacing.xl,
  },
  signInBtn: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
  },
  signInText: {
    fontFamily: Fonts.brandBold,
    fontSize: 16,
    color: Colors.text,
  },
  signUpBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  signUpText: {
    fontFamily: Fonts.brandBold,
    fontSize: 16,
    color: Colors.white,
  },
  privacy: {
    fontFamily: Fonts.brand,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 16,
  },
  privacyLink: {
    color: Colors.white,
    textDecorationLine: 'underline',
  },
});
