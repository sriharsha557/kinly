import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../state/useAuthStore';
import { GardenCard } from '../components/GardenCard';
import { BuddyCard } from '../components/BuddyCard';
import { ChallengesCard } from '../components/ChallengesCard';
import { VisionBoardCard } from '../components/VisionBoardCard';
import { MeetUpCard } from '../components/MeetUpCard';
import { CircleAICard } from '../components/CircleAICard';
import { WeeklyRecapCard } from '../components/WeeklyRecapCard';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CircleScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Circle</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CircleSettings')}>
            <Text style={styles.settingsLink}>⚙️ Settings</Text>
          </TouchableOpacity>
        </View>

        {circleId && <GardenCard circleId={circleId} />}
        {userId && circleId && <BuddyCard circleId={circleId} userId={userId} />}
        {userId && circleId && <ChallengesCard circleId={circleId} userId={userId} />}
        {userId && circleId && <VisionBoardCard circleId={circleId} userId={userId} />}
        {userId && circleId && <MeetUpCard circleId={circleId} userId={userId} />}
        {userId && circleId && <CircleAICard circleId={circleId} userId={userId} />}
        {circleId && <WeeklyRecapCard circleId={circleId} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  page: { padding: 16, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  settingsLink: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
