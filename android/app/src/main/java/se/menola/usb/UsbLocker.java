package se.menola.usb;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.UserManager;
import android.util.Base64;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONObject;

import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * Stänger av och öppnar USB-dataöverföring.
 *
 * Kräver att appen är enhetsägare (adb shell dpm set-device-owner se.menola.usb/.AdminReceiver).
 * - Android 12 och senare, om telefonen stöder det: all USB-data stängs av (setUsbDataSignalingEnabled).
 * - Alltid: filöverföring, USB-minnen och USB-felsökning (adb) spärras.
 * Laddning påverkas aldrig.
 *
 * När låset startas sätts ett larm som öppnar USB igen när tiden är ute, även om appen är stängd.
 */
public final class UsbLocker {
    private UsbLocker() {}

    private static final String PREFS = "usb_lock";
    private static final String CHANNEL = "usb_lock";
    private static final int NOTIFY_ID = 1;
    private static final int MAX_EVENTS = 200;

    /** Det som spärras när USB är avstängd. */
    private static final String[] RESTRICTIONS = {
            UserManager.DISALLOW_USB_FILE_TRANSFER,
            UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA,
            UserManager.DISALLOW_DEBUGGING_FEATURES,
    };

    // ---------- Hjälpare ----------

    /** Sparas i enhetsskyddad lagring så att låset kan hanteras direkt efter omstart, före upplåsning. */
    static SharedPreferences prefs(Context c) {
        Context d = Build.VERSION.SDK_INT >= 24 ? c.createDeviceProtectedStorageContext() : c;
        return d.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static ComponentName admin(Context c) {
        return new ComponentName(c, AdminReceiver.class);
    }

    static DevicePolicyManager dpm(Context c) {
        return (DevicePolicyManager) c.getSystemService(Context.DEVICE_POLICY_SERVICE);
    }

    static boolean isOwner(Context c) {
        try {
            return dpm(c).isDeviceOwnerApp(c.getPackageName());
        } catch (Exception e) {
            return false;
        }
    }

    /** Kan telefonen stänga av all USB-data (Android 12+ och stöd i hårdvaran)? */
    static boolean signalingSupported(Context c) {
        if (Build.VERSION.SDK_INT < 31) return false;
        try {
            return dpm(c).canUsbDataSignalingBeDisabled();
        } catch (Throwable e) {
            return false;
        }
    }

    static long until(Context c) {
        return prefs(c).getLong("until", 0);
    }

    static boolean isLocked(Context c) {
        return until(c) > 0;
    }

    // ---------- Låsa och öppna ----------

    static synchronized void lock(Context c, int minutes) throws Exception {
        if (!isOwner(c)) throw new Exception("Appen är inte enhetsägare. Följ stegen under Inställningar → Aktivera USB-låset.");
        if (minutes < 1) minutes = 1;
        if (minutes > 24 * 60) minutes = 24 * 60;
        long now = System.currentTimeMillis();
        long until = now + minutes * 60_000L;
        String mode = apply(c);
        prefs(c).edit().putLong("until", until).putLong("started", now).putInt("minutes", minutes).putString("mode", mode).commit();
        schedule(c, until);
        showNotification(c, until);
        addEvent(c, "lock", "pin", minutes, mode);
    }

    /** Stänger av USB-data. Returnerar "signal" om all data stängdes av, annars "restrict". */
    private static String apply(Context c) {
        DevicePolicyManager d = dpm(c);
        ComponentName a = admin(c);
        for (String r : RESTRICTIONS) {
            try {
                d.addUserRestriction(a, r);
            } catch (Exception ignored) {
            }
        }
        if (signalingSupported(c)) {
            try {
                d.setUsbDataSignalingEnabled(false);
                return "signal";
            } catch (Exception ignored) {
            }
        }
        return "restrict";
    }

    /** Öppnar USB igen. reason: "timer", "pin", "boot" eller "release". */
    static synchronized void unlock(Context c, String reason) {
        boolean wasLocked = isLocked(c);
        if (isOwner(c)) {
            DevicePolicyManager d = dpm(c);
            ComponentName a = admin(c);
            if (Build.VERSION.SDK_INT >= 31) {
                try {
                    d.setUsbDataSignalingEnabled(true);
                } catch (Throwable ignored) {
                }
            }
            for (String r : RESTRICTIONS) {
                try {
                    d.clearUserRestriction(a, r);
                } catch (Exception ignored) {
                }
            }
        }
        prefs(c).edit().remove("until").remove("started").commit();
        cancelAlarm(c);
        try {
            NotificationManagerCompat.from(c).cancel(NOTIFY_ID);
        } catch (Exception ignored) {
        }
        if (wasLocked) addEvent(c, "unlock", reason, 0, null);
    }

    /** Vid appstart och omstart: öppna om tiden gått ut, annars starta om timern och notisen. */
    static synchronized void resume(Context c) {
        long until = until(c);
        if (until <= 0) return;
        if (System.currentTimeMillis() >= until) {
            unlock(c, "timer");
        } else {
            if (isOwner(c)) apply(c);
            schedule(c, until);
            showNotification(c, until);
        }
    }

    /** Tar bort appens rätt som enhetsägare så att den kan avinstalleras. Öppnar USB först. */
    static synchronized void release(Context c) throws Exception {
        unlock(c, "release");
        if (!isOwner(c)) throw new Exception("Appen är inte enhetsägare.");
        dpm(c).clearDeviceOwnerApp(c.getPackageName());
        addEvent(c, "release", "pin", 0, null);
    }

    // ---------- Timer ----------

    private static PendingIntent alarmIntent(Context c) {
        Intent i = new Intent(c, UnlockReceiver.class);
        return PendingIntent.getBroadcast(c, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void schedule(Context c, long at) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = alarmIntent(c);
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    private static void cancelAlarm(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.cancel(alarmIntent(c));
    }

    // ---------- Notis med nedräkning ----------

    private static void showNotification(Context c, long until) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "USB-lås", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Visar hur länge USB är avstängd");
                ch.setShowBadge(false);
                c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
            }
            Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            String time = android.text.format.DateFormat.getTimeFormat(c).format(new java.util.Date(until));
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat_usb)
                    .setColor(0xFFE8B04A)
                    .setContentTitle("USB är avstängd")
                    .setContentText("Öppnas automatiskt kl. " + time + ". Laddning fungerar.")
                    .setWhen(until)
                    .setShowWhen(true)
                    .setUsesChronometer(true)
                    .setOngoing(true)
                    .setOnlyAlertOnce(true)
                    .setContentIntent(pi)
                    .setPriority(NotificationCompat.PRIORITY_LOW);
            if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(true);
            NotificationManagerCompat.from(c).notify(NOTIFY_ID, b.build());
        } catch (SecurityException ignored) {
            // Notiser är inte tillåtna. Låset och timern fungerar ändå.
        } catch (Exception ignored) {
        }
    }

    // ---------- PIN-kod ----------

    static boolean validPin(String pin) {
        return pin != null && pin.matches("\\d{4,8}");
    }

    static boolean hasPin(Context c) {
        return prefs(c).contains("pinHash");
    }

    private static String hash(byte[] salt, String pin) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] h = pin.getBytes("UTF-8");
        for (int i = 0; i < 20000; i++) {
            md.reset();
            md.update(salt);
            md.update(h);
            h = md.digest();
        }
        return Base64.encodeToString(h, Base64.NO_WRAP);
    }

    static void savePin(Context c, String pin) {
        try {
            byte[] salt = new byte[16];
            new SecureRandom().nextBytes(salt);
            prefs(c).edit()
                    .putString("pinSalt", Base64.encodeToString(salt, Base64.NO_WRAP))
                    .putString("pinHash", hash(salt, pin))
                    .putInt("pinFails", 0)
                    .putLong("pinBlockedUntil", 0)
                    .commit();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * Kontrollerar PIN-koden. Efter 5 fel i rad måste man vänta, först 30 sekunder och sedan
     * dubbelt så länge för varje nytt fel (högst 15 minuter).
     * Svar: { ok, wait (ms att vänta), left (försök kvar innan väntan) }.
     */
    static synchronized JSObject verifyPin(Context c, String pin) {
        JSObject r = new JSObject();
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis();
        long blocked = p.getLong("pinBlockedUntil", 0);
        if (blocked > now) {
            r.put("ok", false);
            r.put("wait", blocked - now);
            return r;
        }
        boolean ok = false;
        try {
            byte[] salt = Base64.decode(p.getString("pinSalt", ""), Base64.NO_WRAP);
            String stored = p.getString("pinHash", null);
            ok = stored != null && pin != null && MessageDigest.isEqual(stored.getBytes("UTF-8"), hash(salt, pin).getBytes("UTF-8"));
        } catch (Exception ignored) {
        }
        if (ok) {
            p.edit().putInt("pinFails", 0).putLong("pinBlockedUntil", 0).commit();
            r.put("ok", true);
            return r;
        }
        int fails = p.getInt("pinFails", 0) + 1;
        long wait = 0;
        if (fails >= 5) wait = Math.min(30_000L << Math.min(fails - 5, 5), 15 * 60_000L);
        p.edit().putInt("pinFails", fails).putLong("pinBlockedUntil", wait > 0 ? now + wait : 0).commit();
        r.put("ok", false);
        r.put("wait", wait);
        r.put("left", Math.max(0, 5 - fails));
        return r;
    }

    // ---------- Logg ----------

    private static synchronized void addEvent(Context c, String type, String reason, int minutes, String mode) {
        try {
            JSONArray a = new JSONArray(prefs(c).getString("events", "[]"));
            JSONObject e = new JSONObject();
            e.put("t", System.currentTimeMillis());
            e.put("type", type);
            e.put("reason", reason);
            if (minutes > 0) e.put("minutes", minutes);
            if (mode != null) e.put("mode", mode);
            JSONArray out = new JSONArray();
            out.put(e);
            for (int i = 0; i < a.length() && out.length() < MAX_EVENTS; i++) out.put(a.get(i));
            prefs(c).edit().putString("events", out.toString()).commit();
        } catch (Exception ignored) {
        }
    }

    static JSArray events(Context c) {
        try {
            return new JSArray(prefs(c).getString("events", "[]"));
        } catch (Exception e) {
            return new JSArray();
        }
    }

    static void clearEvents(Context c) {
        prefs(c).edit().remove("events").commit();
    }

    // ---------- Status ----------

    static JSObject status(Context c) {
        // Säkerhetsnät: har tiden gått ut utan att timern hann köra öppnas USB nu.
        long u = until(c);
        if (u > 0 && System.currentTimeMillis() >= u) unlock(c, "timer");
        SharedPreferences p = prefs(c);
        JSObject r = new JSObject();
        r.put("owner", isOwner(c));
        r.put("signaling", signalingSupported(c));
        r.put("locked", isLocked(c));
        r.put("until", p.getLong("until", 0));
        r.put("started", p.getLong("started", 0));
        r.put("mode", p.getString("mode", ""));
        r.put("now", System.currentTimeMillis());
        r.put("hasPin", hasPin(c));
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("model", Build.MANUFACTURER + " " + Build.MODEL);
        r.put("admin", c.getPackageName() + "/.AdminReceiver");
        return r;
    }
}
