import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';

import {useAuth} from '../auth/AuthContext';
import {ConflictDialog} from '../components/ConflictDialog';
import {OfflineBanner} from '../components/OfflineBanner';
import {Screen} from '../components/Screen';
import {ScreenErrorBoundary} from '../components/ScreenErrorBoundary';
import {FertilizerCalculatorScreen} from '../screens/calculator/FertilizerCalculatorScreen';
import {CareProtocolScreen} from '../screens/care/CareProtocolScreen';
import {FertilizerBudgetScreen} from '../screens/fertilizer/FertilizerBudgetScreen';
import {FertilizerGroupsScreen} from '../screens/fertilizer/FertilizerGroupsScreen';
import {FertilizerProductsScreen} from '../screens/fertilizer/FertilizerProductsScreen';
import {FinanceScreen} from '../screens/finance/FinanceScreen';
import {CareGuideListScreen} from '../screens/guide/CareGuideListScreen';
import {CareGuideScreen} from '../screens/guide/CareGuideScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {PlotDetailScreen} from '../screens/PlotDetailScreen';
import {PlotPickerScreen} from '../screens/PlotPickerScreen';
import {PlotFormScreen} from '../screens/PlotFormScreen';
import {ReportExportScreen} from '../screens/report/ReportExportScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {StockCheckScreen} from '../screens/stock/StockCheckScreen';
import {TaskDetailScreen} from '../screens/task/TaskDetailScreen';
import {ToolsScreen} from '../screens/ToolsScreen';
import {VarietyCategoryScreen} from '../screens/variety/VarietyCategoryScreen';
import {VarietyCropTypeScreen} from '../screens/variety/VarietyCropTypeScreen';
import {VarietyPickScreen} from '../screens/variety/VarietyPickScreen';
import {WarehouseScreen} from '../screens/warehouse/WarehouseScreen';
import {colors} from '../theme';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Wraps every screen in its own error boundary (react-navigation's
 * `screenLayout`), so a crash in one screen shows "Oops" there and leaves
 * the rest of the app working.
 */
function useScreenLayout() {
  const {session} = useAuth();
  const userId = session?.user.id ?? null;
  const token = session?.token ?? null;
  return React.useCallback(
    ({
      children,
      route,
      navigation,
    }: {
      children: React.ReactNode;
      route: {name: string; params?: object};
      navigation: {canGoBack: () => boolean; popToTop: () => void};
    }) => (
      <ScreenErrorBoundary
        route={route.name}
        userId={userId}
        token={token}
        onGoHome={navigation.canGoBack() ? () => navigation.popToTop() : undefined}>
        {children}
      </ScreenErrorBoundary>
    ),
    [userId, token],
  );
}

export function RootNavigator() {
  const {status} = useAuth();
  const layout = useScreenLayout();

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
      {status === 'signedIn' ? <OfflineBanner /> : null}
      <Stack.Navigator
        screenLayout={layout}
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
            <Stack.Screen name="Tools" component={ToolsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="PlotDetail" component={PlotDetailScreen} />
            <Stack.Screen name="PlotPicker" component={PlotPickerScreen} />
            <Stack.Screen name="PlotForm" component={PlotFormScreen} options={{animation: 'slide_from_bottom'}} />
            <Stack.Screen name="VarietyCropType" component={VarietyCropTypeScreen} />
            <Stack.Screen name="VarietyCategory" component={VarietyCategoryScreen} />
            <Stack.Screen name="VarietyPick" component={VarietyPickScreen} />
            <Stack.Screen name="FertilizerGroups" component={FertilizerGroupsScreen} />
            <Stack.Screen name="FertilizerProducts" component={FertilizerProductsScreen} />
            <Stack.Screen name="FertilizerCalculator" component={FertilizerCalculatorScreen} />
            <Stack.Screen name="FertilizerBudget" component={FertilizerBudgetScreen} />
            <Stack.Screen name="StockCheck" component={StockCheckScreen} />
            <Stack.Screen name="CareProtocol" component={CareProtocolScreen} />
            <Stack.Screen name="Warehouse" component={WarehouseScreen} />
            <Stack.Screen name="Finance" component={FinanceScreen} />
            <Stack.Screen name="ReportExport" component={ReportExportScreen} />
            <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
            <Stack.Screen name="CareGuides" component={CareGuideListScreen} />
            <Stack.Screen name="CareGuide" component={CareGuideScreen} />
          </>
        )}
      </Stack.Navigator>
      {status === 'signedIn' ? <ConflictDialog /> : null}
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
