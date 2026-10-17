package expo.modules.shabzoslauncherapps

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.util.Locale

class ShabzLauncherAppsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShabzLauncherApps")

    AsyncFunction("getLaunchableApps") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, String>>()
      val packageManager = context.packageManager
      val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
      }

      packageManager.queryIntentActivities(launcherIntent, 0)
        .asSequence()
        .mapNotNull { resolveInfo ->
          val activity = resolveInfo.activityInfo ?: return@mapNotNull null
          if (activity.packageName == context.packageName) return@mapNotNull null

          val icon = runCatching { resolveInfo.loadIcon(packageManager) }.getOrNull()
            ?: return@mapNotNull null
          val iconData = runCatching { drawableToDataUri(icon) }.getOrNull()
            ?: return@mapNotNull null

          mapOf(
            "name" to resolveInfo.loadLabel(packageManager).toString(),
            "packageName" to activity.packageName,
            "iconDataUri" to iconData,
          )
        }
        .distinctBy { it["packageName"] }
        .sortedBy { it["name"]?.lowercase(Locale.ROOT) ?: "" }
        .toList()
    }

    AsyncFunction("launchApp") { packageName: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
        ?: return@AsyncFunction false
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(launchIntent)
      true
    }
  }

  private fun drawableToDataUri(drawable: Drawable): String {
    val bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, canvas.width, canvas.height)
    drawable.draw(canvas)

    val output = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
    bitmap.recycle()
    return "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
  }
}
