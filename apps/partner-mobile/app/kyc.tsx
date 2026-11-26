import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@wag/design-tokens';

// DigiLocker sends the phone back to wagandtailspartner://kyc?requestId=...&result=ok.
// The sign-up screen reads the real result from the server once the browser closes, so this screen only has to
// step out of the way. Without it Android showed "Unmatched Route" when the link opened as a normal deep link.
export default function KycReturn() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/signup');
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
      <ActivityIndicator color={colors.brandBrown} />
    </View>
  );
}
