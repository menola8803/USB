# Ändringar

Varje version beskrivs här och under **Releases** på GitHub. Nya versioner läggs till automatiskt när de byggs. Varje rättelse skrivs ut som en egen punkt som börjar med "Rättat:".

## Version 1.0.3 – 2026-10-15

- Nytt, elegantare namn: ett runt emblem i guld med USB-symbolen, namnet USB i Cormorant Garamond med luft mellan bokstäverna och en guldglans som sveper över när appen öppnas, och en tunn guldlinje med undertexten PORTLÅS.
- Kompaktare meny längst ner: ikon och text står bredvid varandra i en låg list, och den valda fliken markeras med guld.
- Rättat: man behövde skrolla på startskärmen. Nu ryms allt på en skärm, även på mindre telefoner. Toppen är lägre, beskrivningen av appen och versionsnumret visas bara under Om, och ringen och knapparna är något mindre. På låga skärmar ligger snabbvalen för tid på en rad.

## Version 1.0.2 – 2026-10-15

- Ändrat: den arabiska texten (قفل) under namnet USB är borttagen, både på startskärmen och på Om-sidan. Det arabiska typsnittet är också borttaget, så appen blir lite mindre.

## Version 1.0.1 – 2026-10-15

Första versionen av USB.

- Stäng av USB med PIN-kod. Välj hur länge USB ska vara avstängd med − och + (15 minuter i taget) eller snabbval: 30 min, 1 h, 2 h, 3 h, 6 h och 12 h. Förvalt är 3 timmar.
- Timern öppnar USB-porten automatiskt när tiden är ute, även om appen är stängd. Startas telefonen om under tiden öppnas USB direkt om tiden har gått ut, annars fortsätter timern.
- Laddning fungerar hela tiden. Bara dataöverföringen stängs av.
- Med Android 12 eller senare, på telefoner som stöder det, stängs all USB-data av. Annars spärras filöverföring, USB-minnen och USB-felsökning (adb).
- Nedräkning i en ring på startskärmen och i en notis, med klockslaget när USB öppnas.
- Öppna USB i förtid med PIN-koden. Efter 5 fel PIN-koder i rad måste man vänta, först 30 sekunder och sedan längre för varje nytt fel.
- PIN-koden (4–8 siffror) väljs första gången appen öppnas och kan bytas under Inställningar. Den sparas krypterad (hash) i telefonen.
- Logg över när USB stängts av och öppnats, och hur (timer eller PIN-kod).
- Inställningar: språk (svenska/engelska), förvald tid, byt PIN-kod, status för telefonen, steg för att aktivera USB-låset och knapp för att ta bort administratörsrätten innan appen avinstalleras.
- Samma design som Conversation: mörkgrön bakgrund, guld och turkos, namnet i Cormorant Garamond med arabiska ordet för lås (قفل) under, stjärnmönster i toppen, samma meny och Om-sida med "Utvecklare – Claes Sundman från SNC AB".
- APK-filen heter usb-versionsnummer.apk, t.ex. usb-1.0.1.apk.
- Rättat (under utvecklingen): knappen **Stäng av USB** doldes bakom menyn längst ner. Den ligger nu ovanför menyn och ringen är mindre, så att allt syns utan att skrolla.
