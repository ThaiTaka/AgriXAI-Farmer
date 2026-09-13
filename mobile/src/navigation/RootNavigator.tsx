import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';

import {useAuth} from '../auth/AuthContext';
import {Screen} from '../components/Screen';
import {FertilizerGroupsScreen} from '../screens/fertilizer/FertilizerGroupsScreen';
import {FertilizerProductsScreen} from '../screens/fertilizer/FertilizerProductsScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {PlotDetailScreen} from '../screens/PlotDetailScreen';
import {PlotFormScreen} from '../screens/PlotFormScreen';
import {VarietyCategoryScreen} from '../screens/variety/VarietyCategoryScreen';
import {VarietyCropTypeScreen} from '../screens/variety/VarietyCropTypeScreen';
import {VarietyPickScreen} from '../screens/variety/VarietyPickScreen';
import {colors} from '../theme';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const {status} = useAuth();

  if (status === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary.default} />
        </View>
      </Screen>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: {backgroundColor: colors.surface.page},
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
            <Stack.Screen name="VarietyCropType" component={VarietyCropTypeScreen} />
            <Stack.Screen name="VarietyCategory" component={VarietyCategoryScreen} />
            <Stack.Screen name="VarietyPick" component={VarietyPickScreen} />
            <Stack.Screen name="FertilizerGroups" component={FertilizerGroupsScreen} />
            <Stack.Screen name="FertilizerProducts" component={FertilizerProductsScreen} />
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
