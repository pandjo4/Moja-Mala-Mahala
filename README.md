# MINI KINGDOM

Mini Kingdom je brza browser igra izgradnje grada za solo i multiplayer. Koristi Node.js, Express i Socket.IO. Svaki igrač gradi na vlastitoj ploči 4 × 4.

## Pokretanje

```bash
npm install
npm start
```

Otvori `http://localhost:3000`. Za multiplayer otvori igru u dva ili više prozora/uređaja. Jedan igrač kreira sobu, ostali se pridružuju kodom.

## Render

- Build Command: `npm install`
- Start Command: `npm start`
- Node 18 ili noviji

Server sluša na `0.0.0.0` i koristi `process.env.PORT`.

## Osnovna pravila

- Ploča ima 16 polja (4 × 4), označenih brojevima 1–16.
- Igra koristi samo tri materijala: drvo, ciglu i kamen.
- Svaki krug dobija se jedan materijal. U multiplayeru ga bira aktivni igrač; u solo modu bira se nasumično.
- Postavi materijal na prazno polje. Zatim možeš izgraditi najviše jednu građevinu.
- Svaka građevina traži tačno tri materijala prema receptu.
- **Sva tri korištena materijala moraju činiti jednu povezanu grupu.** Polja se povezuju samo gore, dolje, lijevo i desno; dijagonalni dodir nije dovoljan. Primjer: polja 1, 2 i 4 su povezana; polja 1, 2 i 6 nisu.
- Građevine ostaju prikazane u listi. Zelena kartica znači da trenutno imaš recept i povezane materijale za gradnju. Svaka kartica prikazuje recept, osnovne bodove i poseban bonus. Klik na bilo koju karticu otvara detalje.
- Kada izgradiš zgradu, odabrana tri materijala se uklanjaju, a zgrada zauzima jedno od tri oslobođena polja.
- `I am done` završava tvoj dio kruga. U multiplayeru sljedeći krug počinje kada svi završe; solo prelazi odmah.
- Svaki igrač ima jedan REWIND po partiji, kojim može zamijeniti postavljeni resurs trenutnim materijalom.
- Ploča, građevine i tajne završne nagrade prikazane su u vodiču `?`.

## Građevine

1. Mirna kuća — 3 boda; +1 uz farmu.
2. Zlatna farma — 2 boda; +1 uz drugu farmu.
3. Crvena ciglana — 3 boda; +1 ako je u istom redu/koloni s drugom ciglanom.
4. Majstorska radionica — 3 boda; +1 uz kuću.
5. Trgovački trg — 3 boda; +1 za svaku različitu susjednu vrstu zgrade, najviše +2.
6. Stražarska kula — 4 boda; +2 u uglu ploče.
7. Kamena biblioteka — 4 boda; +1 za svaku drugu biblioteku u istom redu/koloni, najviše +2.
8. Kamena utvrda — 5 bodova; +2 ako dodiruje najmanje dvije različite vrste zgrada.

## Završne nagrade

- Najveći graditelj: +3 boda za najviše izgrađenih zgrada.
- Najraznovrsniji grad: +3 boda za najviše različitih vrsta građevina.
- Najveći poljoprivrednik: +2 boda za najviše farmi.
- Svaki kompletan red ili kolona sastavljen od građevina: +1 bod.
- Nagrade za prvo mjesto se ne dodjeljuju kod izjednačenja.
