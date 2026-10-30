# MOJA MALA MAHALA

Browser društvena igra izgradnje mahale za solo i multiplayer. Koristi Node.js, Express i Socket.IO. Svaki igrač gradi na vlastitoj tabli 4 × 4.

## Pokretanje
```bash
npm install
npm start
```
Otvori `http://localhost:3000`. Za multiplayer otvori igru na dva ili više uređaja: jedan igrač kreira sobu, a ostali se pridružuju kodom.

## Render
- Build Command: `npm install`
- Start Command: `npm start`
- Node 18 ili noviji
- Server sluša na `0.0.0.0` i koristi `process.env.PORT`.

## Materijali i gradnja
Igra koristi Drvo, Ciglu i Kamen. Svaki krug igrači dobijaju isti materijal i postavljaju ga na prazno polje. U fazi gradnje mogu izgraditi najviše jednu građevinu. Svi materijali iz recepta moraju biti povezani horizontalno ili vertikalno; dijagonalno povezivanje se ne računa. Nije potreban poseban oblik. Nakon gradnje materijali se vraćaju u zajedničku zalihu i uklanjaju s table; građevina zauzima jedno od njihovih polja, a ostala polja postaju prazna.

## Građevine
- Glavna kuća: 3 materijala; +1 za svaki različiti tip susjedne građevine.
- Farma: 3 materijala; +2 za svaku susjednu Farmu.
- Kula: 3 materijala; +2 u uglu table.
- Ciglana: 3 materijala; +1 ako je u istom redu ili koloni druga Ciglana ili Radionica.
- Radionica: 3 materijala; isto industrijsko pravilo kao Ciglana.
- Pijaca: 3 materijala; na kraju +2 za svaki susjedni neiskorišteni materijal.
- Biblioteka: jedina građevina s 4 materijala; +1 za svaku drugu građevinu u osam okolnih polja (uključujući dijagonale), najviše +7.
- Fontana: dopunska građevina, 2 materijala; na kraju +1 za svako prazno susjedno polje, najviše +4.

Sedam građevina je označeno kao glavne, a Fontana kao dopunska, jer je to raspored izričito naveden u specifikaciji pojedinačnih građevina.

## Dodatni bonusi
Svaki kompletiran red ili kolona sa četiri građevine donosi +1 novčić odmah, samo jednom po liniji. Na kraju partije svaki takav red i kolona donose i +1 bod.

## Završno bodovanje
Bodovi građevina i bonusi se računaju na kraju partije. Pijaca i Fontana ostvaruju završne bonuse tek tada. U multiplayeru jedinstveni prvak po broju građevina dobija +3, po različitim tipovima +3, a po broju Farma +2; kod izjednačenja nagrada se ne dodjeljuje. Solo igra dodjeljuje odgovarajuću nagradu ako je uslov ispunjen.

Svaki igrač ima jedan REWIND po partiji, kojim može zamijeniti jedan postavljeni materijal trenutnim materijalom. Građevine se ne mogu uklanjati.
