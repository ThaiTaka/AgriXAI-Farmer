package com.thaitaka.agrilogapp

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Drops any saved instance state before React Native starts.
   *
   * react-native-screens cannot rebuild its fragments from a restored state and
   * throws "Screen fragments should never be restored" straight out of
   * onCreate, which kills the process. Android restores that state whenever it
   * has evicted the app from memory — routine on the low-end phones this app is
   * built for, so the farmer would come back to a crash instead of their
   * ledger. Handing React Native a null bundle makes it rebuild the navigation
   * tree from scratch, which is what it does on a cold start anyway.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "agrilogapp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
