package se.menola.usb;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Efter omstart eller uppdatering av appen: om tiden har gått ut öppnas USB direkt,
 * annars startas timern igen (larm försvinner när telefonen startas om).
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        UsbLocker.resume(context);
    }
}
