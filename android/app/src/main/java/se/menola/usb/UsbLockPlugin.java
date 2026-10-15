package se.menola.usb;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Bryggan mellan appens gränssnitt och USB-låset. PIN-koden kontrolleras här, inte i webbdelen. */
@CapacitorPlugin(name = "UsbLock")
public class UsbLockPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(UsbLocker.status(getContext()));
    }

    @PluginMethod
    public void setPin(PluginCall call) {
        String pin = call.getString("pin", "");
        String old = call.getString("old", "");
        if (UsbLocker.hasPin(getContext())) {
            JSObject r = UsbLocker.verifyPin(getContext(), old);
            if (!r.getBool("ok")) { call.resolve(r); return; }
        }
        if (!UsbLocker.validPin(pin)) { call.reject("PIN-koden måste vara 4–8 siffror."); return; }
        UsbLocker.savePin(getContext(), pin);
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    @PluginMethod
    public void verifyPin(PluginCall call) {
        call.resolve(UsbLocker.verifyPin(getContext(), call.getString("pin", "")));
    }

    @PluginMethod
    public void lock(PluginCall call) {
        JSObject r = UsbLocker.verifyPin(getContext(), call.getString("pin", ""));
        if (!r.getBool("ok")) { call.resolve(r); return; }
        int minutes = call.getInt("minutes", 180);
        try {
            UsbLocker.lock(getContext(), minutes);
            r.put("status", UsbLocker.status(getContext()));
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        JSObject r = UsbLocker.verifyPin(getContext(), call.getString("pin", ""));
        if (!r.getBool("ok")) { call.resolve(r); return; }
        UsbLocker.unlock(getContext(), "pin");
        r.put("status", UsbLocker.status(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void release(PluginCall call) {
        JSObject r = UsbLocker.verifyPin(getContext(), call.getString("pin", ""));
        if (!r.getBool("ok")) { call.resolve(r); return; }
        try {
            UsbLocker.release(getContext());
            r.put("status", UsbLocker.status(getContext()));
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void log(PluginCall call) {
        JSObject r = new JSObject();
        r.put("events", UsbLocker.events(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void clearLog(PluginCall call) {
        UsbLocker.clearEvents(getContext());
        call.resolve();
    }
}
