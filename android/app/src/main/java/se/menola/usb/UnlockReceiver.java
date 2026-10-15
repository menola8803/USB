package se.menola.usb;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Körs när timern löper ut: öppnar USB igen. */
public class UnlockReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        UsbLocker.unlock(context, "timer");
    }
}
