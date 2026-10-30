# MINI KINGDOM

Mini Kingdom je originalna browser board game igra izgradnje grada. Projekat koristi Node.js, Express i Socket.IO. Multiplayer sobe podržavaju 2–8 igrača, a solo režim koristi iste materijale, recepte i bodovanje.

## Pokretanje lokalno

Potrebni su Node.js 18 ili noviji i npm.

```bash
npm install
npm start
```

Otvori `http://localhost:3000` u pregledniku. Za testiranje multiplayera otvori adresu u dva ili više različitih prozora/uređaja. Jedan igrač kreira sobu, a ostali ulaze pomoću šestocifrenog koda.

## Postavljanje na GitHub

1. Napravi novi GitHub repository.
2. Raspakuj ovaj projekat i otvori terminal u njegovom korijenskom folderu.
3. Pokreni:

```bash
git init
git add .
git commit -m "Initial Mini Kingdom release"
git branch -M main
git remote add origin https://github.com/TVOJE-IME/mini-kingdom.git
git push -u origin main
```

Zamijeni URL stvarnim URL-om svog repozitorija.

## Objavljivanje na Renderu

1. Prijavi se na [Render](https://render.com/) i odaberi **New → Web Service**.
2. Poveži GitHub repository u kojem se nalazi Mini Kingdom.
3. Odaberi Node okruženje.
4. Postavi **Build Command** na `npm install`.
5. Postavi **Start Command** na `npm start`.
6. Odaberi besplatni plan ako je dostupan za tvoj račun i regiju.
7. Klikni **Create Web Service** i sačekaj da se završi deploy.

Server koristi `process.env.PORT` i sluša na `0.0.0.0`, što odgovara Render Web Service okruženju. Nije potrebna baza podataka za ovu prvu verziju.

## Pravila igre

- Svaki igrač ima privatnu ploču 4×4.
- U multiplayeru jedan igrač bira jedan od pet materijala, a svi ga postavljaju na vlastitu ploču. Birač se rotira iz kruga u krug.
- Nakon postavljanja slijedi faza gradnje. Svaki igrač može izgraditi najviše jednu zgradu po krugu: izabere recept, označi tri odgovarajuća resursa, a zatim sam odabere jedno od ta tri oslobođena polja na koje postavlja zgradu. Preostala dva polja ostaju prazna.
- Zgrade koje traže liniju, susjedstvo ili L-oblik moraju ispuniti taj raspored. Ostali recepti mogu se sastaviti s bilo kojih polja.
- Svaki igrač ima jedan REWIND. Nakon što je postavio resurs u tekućem krugu može vratiti jedan resurs i zamijeniti ga trenutno odabranim materijalom. Zgrade se ne mogu ukloniti.
- Ako igrač ne postavi resurs u vremenu, server ga automatski postavlja na prvo slobodno polje. Ako ne završi fazu gradnje, faza se automatski preskače.
- Partija se završava nakon odabranog broja krugova. Bodovi uključuju osnovne vrijednosti i bonuse zgrada, kompletne redove/kolone te tri posebne nagrade.

### Materijali

| Materijal | Ikona | Osnovna uloga |
|---|---:|---|
| Drvo | ▰ | Kuće, farme, radionice i svetišta |
| Cigla | ▧ | Industrija, trgovina i odbrana |
| Kamen | ⬡ | Industrija, utvrde i kule |
| Žito | ✣ | Farme, kuće i trgovina |
| Kristal | ✦ | Biblioteke, pijace, svetišta i obelisci |

### Zgrade i recepti

| Zgrada | Recept | Raspored | Osnovni bodovi |
|---|---|---|---:|
| Mirna kuća | 2 drvo + 1 žito | Bilo gdje | 2 |
| Zlatna farma | 2 žito + 1 drvo | Bilo gdje | 2 |
| Crvena ciglana | 2 cigla + 1 kamen | Linija | 3 |
| Majstorska radionica | 1 drvo + 1 cigla + 1 kamen | Bilo gdje | 3 |
| Trgovački trg | 1 žito + 1 cigla + 1 kristal | Susjedna polja | 3 |
| Stražarska kula | 1 drvo + 1 cigla + 1 kamen | L-oblik | 4 |
| Kristalna biblioteka | 2 kristal + 1 drvo | Bilo gdje | 4 |
| Šumsko svetište | 1 drvo + 1 žito + 1 kristal | Susjedna polja | 4 |
| Kamena utvrda | 1 cigla + 2 kamen | L-oblik | 5 |
| Nebeski obelisk | 1 kristal + 1 kamen + 1 žito | Bilo gdje | 5 |

## Bodovanje

- Osnovni bodovi zgrade i njeni posebni bonusi obračunavaju se pri gradnji.
- Svaki kompletan horizontalni red zgrada donosi +1 bod; isto važi za vertikalnu kolonu.
- Jedinstveni lider po broju zgrada dobija +3 boda. Izjednačenje znači da nema nagrade.
- Jedinstveni lider po broju različitih vrsta zgrada dobija +3 boda. Izjednačenje znači da nema nagrade.
- Jedinstveni lider po broju farmi dobija +2 boda. Izjednačenje znači da nema nagrade.

## Tehničke napomene

- Server je autoritativan za provjeru faza, poteza, recepata, rasporeda, REWIND tokena i rezultata.
- Stanje soba živi u memoriji Node procesa. Nije potrebna baza za ovu verziju, ali aktivne sobe se gube ako se Render instanca ugasi ili ponovo pokrene. Besplatni hosting može uspavati servis nakon perioda neaktivnosti.
- Ponovno povezivanje koristi lokalno sačuvan token i kod sobe. Token se ne šalje drugim igračima.
- Za produkciju s mnogo paralelnih soba ili trajno čuvanje partija preporučuje se baza podataka i Socket.IO adapter, ali to nije uslov za pokretanje ove verzije.
- Solo najbolji rezultat čuva se lokalno u pregledniku uređaja.

## Kontrolna lista testiranja

- [ ] Kreiranje sobe i ulazak putem koda.
- [ ] Partija sa 2 igrača.
- [ ] Partija sa 8 igrača.
- [ ] Rotacija izbora materijala.
- [ ] Istovremeno postavljanje resursa.
- [ ] Validacija svih deset recepata i prostornih oblika.
- [ ] Ručni izbor jednog od tri oslobođena polja za zgradu.
- [ ] Jednokratna upotreba REWIND tokena.
- [ ] Automatski potez nakon isteka vremena.
- [ ] Pauza, nastavak i preskakanje faze od strane domaćina.
- [ ] Ponovno povezivanje nakon prekida veze ili osvježavanja stranice.
- [ ] Završno bodovanje i nagrade.
- [ ] Prikaz na širinama 360, 390, 430, 768, 1024 i 1440 px.

Ova kontrolna lista je namijenjena završnom testiranju na stvarnom hostingu i različitim uređajima; nije tvrdnja da su svi navedeni ručni testovi već izvršeni.
