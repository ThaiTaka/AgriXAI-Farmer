import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';

import {useAuth} from '../auth/AuthContext';
import {ScreenBackground} from '../components/ScreenBackground';
import {AnalyzingScreen} from '../screens/AnalyzingScreen';
import {CaptureImageScreen} from '../screens/CaptureImageScreen';
import {DiagnosisHistoryScreen} from '../screens/DiagnosisHistoryScreen';
import {DiagnosisResultScreen} from '../screens/DiagnosisResultScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {PlotDetailScreen} from '../screens/PlotDetailScreen';
import {PlotFormScreen} from '../screens/PlotFormScreen';
import {TreatmentRecommendationScreen} from '../screens/TreatmentRecommendationScreen';
import {colors} from '../theme';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const {status} = useAuth();

  if (status === 'loading') {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green['700']} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // Screens paint their own gradient shell; a white card underneath
          // would flash on every transition.
          contentStyle: {backgroundColor: 'transparent'},
          animation: 'slide_from_right',
        }}>
        {status === 'signedOut' ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="PlotDetail" component={PlotDetailScreen} />
            <Stack.Screen
              name="PlotForm"
              component={PlotFormScreen}
              options={{animation: 'slide_from_bottom'}}
            />
            <Stack.Screen name="CaptureImage" component={CaptureImageScreen} />
            <Stack.Screen
              name="Analyzing"
              component={AnalyzingScreen}
              // No swipe-back: the upload is already in flight and the farmer
              // would land on the camera with a photo that is being analysed.
              options={{gestureEnabled: false, animation: 'fade'}}
            />
            <Stack.Screen name="DiagnosisResult" component={DiagnosisResultScreen} />
            <Stack.Screen name="Treatment" component={TreatmentRecommendationScreen} />
            <Stack.Screen name="DiagnosisHistory" component={DiagnosisHistoryScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
