import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';

import {useAuth} from '../auth/AuthContext';
import {ScreenBackground} from '../components/ScreenBackground';
import {HomeScreen} from '../screens/HomeScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {PlotDetailScreen} from '../screens/PlotDetailScreen';
import {PlotFormScreen} from '../screens/PlotFormScreen';
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
