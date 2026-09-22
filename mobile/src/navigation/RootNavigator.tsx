import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useAuth} from '../auth/AuthContext';
import {ConflictDialog} from '../components/ConflictDialog';
import {HomeIcon, SettingsIcon, ToolsIcon} from '../components/icons';
import {OfflineBanner} from '../components/OfflineBanner';
import {Screen} from '../components/Screen';
import {ScreenErrorBoundary} from '../components/ScreenErrorBoundary';
import {FertilizerCalculatorScreen} from '../screens/calculator/FertilizerCalculatorScreen';
import {CareProtocolScreen} from '../screens/care/CareProtocolScreen';
import {FertilizerBudgetScreen} from '../screens/fertilizer/FertilizerBudgetScreen';
import {FertilizerGroupsScreen} from '../screens/fertilizer/FertilizerGroupsScreen';
import {FertilizerProductsScreen} from '../screens/fertilizer/FertilizerProductsScreen';
import {FinanceScreen} from '../screens/finance/FinanceScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {PlotDetailScreen} from '../screens/PlotDetailScreen';
import {PlotPickerScreen} from '../screens/PlotPickerScreen';
import {PlotFormScreen} from '../screens/PlotFormScreen';
import {ReportExportScreen} from '../screens/report/ReportExportScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {StockCheckScreen} from '../screens/stock/StockCheckScreen';
import {ToolsScreen} from '../screens/ToolsScreen';
import {VarietyCategoryScreen} from '../screens/variety/VarietyCategoryScreen';
import {VarietyCropTypeScreen} from '../screens/variety/VarietyCropTypeScreen';
import {VarietyPickScreen} from '../screens/variety/VarietyPickScreen';
import {WarehouseScreen} from '../screens/warehouse/WarehouseScreen';
import {colors, space, text} from '../theme';

// text() always bakes in a color; keeping it would beat tabBarActiveTintColor.
const {color: _tabLabelColor, ...tabLabelStyle} = text('caption');
import type {MainTabParamList, RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

// Stable icon renderers (defining them inline would remount the tab bar on every render).
const homeIcon = ({color}: {color: string}) => <HomeIcon color={color} />;
const toolsIcon = ({color}: {color: string}) => <ToolsIcon color={color} />;
const settingsIcon = ({color}: {color: string}) => <SettingsIcon color={color} />;

/**
 * Wraps every screen in its own error boundary (react-navigation's
 * `screenLayout`), so a crash in one screen shows "Oops" there and leaves
 * the tab bar and the rest of the app working.
 */
function useScreenLayout() {
  const {session} = useAuth();
  const userId = session?.user.id ?? null;
  const token = session?.token ?? null;
  return React.useCallback(
    ({children, route}: {children: React.ReactNode; route: {name: string; params?: object}}) => (
      <ScreenErrorBoundary route={route.name} userId={userId} token={token}>
        {children}
      </ScreenErrorBoundary>
    ),
    [userId, token],
  );
}

function MainTabs() {
  const layout = useScreenLayout();
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      screenLayout={layout}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.default,
        tabBarInactiveTintColor: colors.text.muted,
        // tabBarStyle is merged after the library's own {height, paddingBottom:
        // insets.bottom}, so a bare height here would sit on the home indicator.
        tabBarStyle: [styles.tabBar, {height: 64 + insets.bottom, paddingBottom: space.sm + insets.bottom}],
        tabBarLabelStyle: tabLabelStyle,
        sceneStyle: {backgroundColor: colors.surface.page},
      }}>
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{title: 'Trang chủ', tabBarIcon: homeIcon, tabBarButtonTestID: 'tab-home'}}
      />
      <Tabs.Screen
        name="Tools"
        component={ToolsScreen}
        options={{title: 'Công cụ', tabBarIcon: toolsIcon, tabBarButtonTestID: 'tab-tools'}}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{title: 'Cài đặt', tabBarIcon: settingsIcon, tabBarButtonTestID: 'tab-settings'}}
      />
    </Tabs.Navigator>
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
            <Stack.Screen name="Main" component={MainTabs} />
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
  tabBar: {
    backgroundColor: colors.surface.card,
    borderTopColor: colors.border.default,
    paddingTop: space.sm,
  },
});
