import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../state/useAuthStore';
import { useUpdateProfile } from '../hooks/useProfile';
import { pickAndUploadAvatar } from '../lib/avatarUpload';
import { Logo } from '../components/Logo';
import { AppTextInput } from '../components/AppTextInput';
import { PillButton } from '../components/PillButton';
import { InterestPicker } from '../components/InterestPicker';
import { colors } from '../theme/colors';
import type { InterestCategory } from '../types/models';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? null);
  const [interests, setInterests] = useState<InterestCategory[]>(user?.interests ?? []);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  function toggleInterest(key: InterestCategory) {
    setInterests((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handlePickAvatar() {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadAvatar(user.id);
      if (url) setAvatar(url);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    await updateProfile.mutateAsync({ name: name.trim(), bio: bio.trim() || null, avatar, interests });
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} disabled={uploadingAvatar}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <Logo size={88} color="#FFFFFF" background={colors.celebration} />
          )}
          <Text style={styles.avatarHint}>{uploadingAvatar ? 'Uploading…' : 'Tap to change photo'}</Text>
        </TouchableOpacity>

        <View style={styles.form}>
          <AppTextInput label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <AppTextInput
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="A short line about you"
            multiline
          />

          <Text style={styles.sectionLabel}>Interests</Text>
          <InterestPicker selected={interests} onToggle={toggleInterest} />

          <PillButton
            label="Save"
            onPress={handleSave}
            loading={updateProfile.isPending}
            disabled={!name.trim()}
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60, alignItems: 'center' },
  avatarWrap: { alignItems: 'center', gap: 8, marginBottom: 24 },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarHint: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  form: { width: '100%', gap: 14 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 4 },
});
