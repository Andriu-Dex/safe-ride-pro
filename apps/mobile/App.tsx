import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App(): JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.badge}>Aplicacion movil</Text>
        <Text style={styles.title}>SafeRidePro</Text>
        <Text style={styles.description}>
          Este espacio queda preparado para la app movil con Expo.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4efe7',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  badge: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#111827',
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 12,
  },
  description: {
    color: '#374151',
    fontSize: 16,
    lineHeight: 26,
  },
});
