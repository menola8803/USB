# USB

Android-app som stänger av USB-dataöverföring med PIN-kod. Du väljer hur länge USB ska vara avstängd (förvalt 3 timmar) och timern öppnar porten igen automatiskt. Laddning av mobilen fungerar hela tiden.

## Så fungerar appen

1. Första gången väljer du en PIN-kod (4–8 siffror).
2. Välj tid med − och + eller ett snabbval (30 min – 12 h) och tryck **Stäng av USB**. Skriv PIN-koden.
3. Startskärmen och en notis visar hur lång tid som är kvar och när USB öppnas.
4. När tiden är ute öppnas USB automatiskt, även om appen är stängd eller telefonen har startats om. Vill du öppna tidigare trycker du **Öppna USB nu** och skriver PIN-koden.

Vad som stängs av:

- **Android 12 eller senare, om telefonen stöder det:** all dataöverföring via USB.
- **Alltid:** filöverföring (MTP/PTP), USB-minnen och USB-felsökning (adb).

Laddningen påverkas aldrig. Efter att USB öppnats igen behöver USB-felsökning slås på manuellt om du använde den.

## Aktivera USB-låset (en gång)

Android låter bara en app stänga av USB om appen är **enhetsägare**. Det ställs in en gång med en dator:

1. Ta bort alla konton från telefonen (Inställningar → Konton). Android godkänner bara en enhetsägare när inga konton finns. Lägg tillbaka dem efteråt.
2. Slå på Utvecklaralternativ och USB-felsökning.
3. Anslut telefonen till datorn och kör:

   ```bash
   adb shell dpm set-device-owner se.menola.usb/.AdminReceiver
   ```

4. Svaret ska börja med `Success`. Lägg tillbaka dina konton.

Stegen och kommandot (med knapp för att kopiera) finns också i appen under Inställningar → Aktivera USB-låset.

**Avinstallera:** en enhetsägar-app kan inte avinstalleras direkt. Gå till Inställningar → Ta bort administratörsrätten (kräver PIN-kod) och avinstallera sedan som vanligt.

## Installera på Android

1. Ladda ner den senaste versionen under **[Releases → senaste](https://github.com/menola8803/USB/releases/latest)**. Filen heter `usb-<version>.apk`, t.ex. `usb-1.0.1.apk`. Den senaste finns också i mappen `apk/`.
2. Öppna filen på telefonen. Om telefonen frågar, tillåt installation från okänd källa.
3. Nya versioner kan installeras ovanpå den gamla. PIN-koden och enhetsägar-rätten finns kvar.

## Ändringar

Varje ändring och rättelse står i [CHANGELOG.md](CHANGELOG.md) och under **Releases**.

## Utveckling

```bash
npm install
npm run dev        # kör appen i webbläsaren (med en låtsasversion av USB-låset)
npm run sync       # bygger webbdelen och kopierar den till android/
```

APK-filen byggs automatiskt av GitHub Actions (`.github/workflows/android.yml`) vid varje push till `main` och läggs upp som en release. Misslyckas bygget sparas loggen i grenen `build-log`.

Tekniken bakom: Vite och vanlig JavaScript, Capacitor 7 och samma design som appen Conversation. USB-låset finns i `android/app/src/main/java/se/menola/usb/`:

- `UsbLocker.java` – stänger av och öppnar USB, timern (AlarmManager), notisen, PIN-koden och loggen.
- `UsbLockPlugin.java` – kopplingen till gränssnittet.
- `UnlockReceiver.java` – öppnar USB när timern är klar.
- `BootReceiver.java` – efter omstart: öppnar USB om tiden gått ut, annars startar timern igen.
- `AdminReceiver.java` – enhetsägare.
