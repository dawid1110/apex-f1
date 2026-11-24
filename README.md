# APEX — centrum wyścigu F1

Gotowa aplikacja na tablet: klasyfikacja, odstępy, mapa toru, analiza kierowców, strategia opon i interaktywna powtórka GP Włoch 2025. Interfejs jest po polsku.

**Ten eksport działa samodzielnie.** Zawiera kod, dane demonstracyjne, lokalny font, ikony, prezentację i konfigurację GitHub Pages. Nie wymaga konta ChatGPT ani pierwotnego projektu. Demo nie wymaga klucza API. Kod używa zwykłego HTML, CSS i JavaScript; nie ma zależności npm do instalowania ani etapu kompilacji.

## 1. Wrzuć projekt na GitHub

1. Rozpakuj `APEX_F1_GitHub.zip`. W środku znajduje się katalog `apex-f1`.
2. Utwórz na swoim GitHubie nowe, puste repozytorium, np. **apex-f1**. Nie dodawaj osobnego README, `.gitignore` ani licencji podczas tworzenia — pliki projektu są już w paczce.
3. Wgraj **zawartość** katalogu `apex-f1` do głównego katalogu repozytorium. Na głównym poziomie muszą znaleźć się `README.md`, `package.json`, `.github`, `dist`, `scripts` i `tests`. Nie przesyłaj ZIP-a jako pojedynczego pliku ani dodatkowego nadrzędnego katalogu.
4. Zapisz pliki na gałęzi **main**.

Możesz użyć funkcji **Add file → Upload files** lub zwykłego Gita. Dopilnuj, żeby w repozytorium był również folder **`.github/workflows`** — zawiera automatyczne wdrażanie.

### Wariant z Gitem / terminalem VS Code

Otwórz terminal w rozpakowanym katalogu `apex-f1`. Zastąp `TWOJ_LOGIN` swoim loginem GitHub; jeśli wybierzesz inną nazwę repozytorium, zmień również `apex-f1` w adresie zdalnym.

```bash
git init -b main
git add .
git commit -m "Initial APEX F1 app"
git remote add origin https://github.com/TWOJ_LOGIN/apex-f1.git
git push -u origin main
```

GitHub obsłuży logowanie zgodnie z konfiguracją Twojego Gita. Nie wpisuj tokenów ani haseł do plików aplikacji.

## 2. Włącz stronę na GitHub Pages

1. W repozytorium otwórz **Settings → Pages**.
2. W sekcji **Build and deployment** ustaw **Source: GitHub Actions**.
3. Przejdź do **Actions → Deploy APEX to GitHub Pages**.
4. Jeśli pierwszy automatyczny przebieg zakończył się przed włączeniem Pages lub nie wystartował, wybierz **Run workflow**, gałąź **main**, i uruchom go ponownie.
5. Po udanym wdrożeniu adres zobaczysz w **Settings → Pages** oraz przy zadaniu wdrożeniowym.

Przykładowe adresy dla repozytorium `apex-f1`:

```text
https://TWOJ_LOGIN.github.io/apex-f1/
https://TWOJ_LOGIN.github.io/apex-f1/showcase.html
https://TWOJ_LOGIN.github.io/apex-f1/?demo=tour
```

Każdy następny push do `main` uruchamia kontrole i publikuje nową wersję. Workflow wdraża sam katalog `dist`, więc pliki instrukcji i testów nie trafiają do aplikacji. Nazwa repozytorium może być inna — ścieżki są względne i nie wymagają ręcznej zmiany w kodzie.

**Dostępność i widoczność:** na GitHub Free najprostszy wariant to repozytorium publiczne. Pages dla prywatnych repozytoriów zależy od planu. Prywatne repozytorium nie oznacza automatycznie prywatnej strony Pages; publikuj z założeniem, że stronę mogą oglądać inni. Jeśli chcesz tylko przechować kod, możesz użyć prywatnego repozytorium i nie włączać Pages.

Źródła: [konfiguracja źródła publikacji](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [własne workflow Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## 3. Uruchomienie lokalne — opcjonalnie

Potrzebny jest Node.js 22 lub nowszy. Kontrole tej paczki wykonano na Node.js 24. Nie trzeba uruchamiać `npm install`.

```bash
npm start
```

Otwórz `http://127.0.0.1:5173/`. Interaktywna ramka tabletu jest pod `http://127.0.0.1:5173/showcase.html`. Zatrzymanie serwera: **Ctrl+C**.

Aby sprawdzić układ adresu podobny do GitHub Pages:

```bash
npm run preview:pages
```

Otwórz `http://127.0.0.1:5173/apex-f1/`. Używaj serwera HTTP — otwieranie `index.html` dwuklikiem przez `file://` nie zapewnia poprawnego działania modułów i pobierania danych.

## Funkcje i sterowanie

- **Wyścig:** kolejność, interwały lub strata do lidera, opony, mapa Monzy, szczegóły kierowcy i Race Control.
- **Tempo:** porównanie dwóch kierowców na tych samych ukończonych okrążeniach.
- **Strategia:** mieszanki, stinty, liczba pit stopów i czas obsługi bolidu.
- **Sezon:** historyczna klasyfikacja kierowców i konstruktorów przed/po GP Włoch 2025.
- **Powtórka:** pauza, start, suwak czasu i prędkości 1×, 2×, 4×, 8×, 16×, 32×.
- **Dane sesji:** pobranie ostatniego dostępnego wyścigu z OpenF1.
- **PWA:** ikona aplikacji, możliwość dodania do ekranu głównego i powtórka offline po pełnym załadowaniu.
- **Ustawienia:** zwarta tabela, ograniczenie animacji, obsługa wibracji na wspieranych urządzeniach oraz informacja o gotowości offline.

Dotknij wiersza kierowcy lub jego bolidu, aby go śledzić. Gwiazdka zapisuje ulubionego. **Spacja** zatrzymuje/wznawia odtwarzanie, **strzałki w lewo/prawo** przesuwają je o 30 s, **Escape** zamyka okno. Preferencje są zapisywane lokalnie w przeglądarce.

## Dane i LIVE

Powtórka to zapis GP Włoch z 7 września 2025: 20 kierowców i 53 okrążenia, OpenF1 `session_key=9912`. Dane są dołączone jako `dist/replay.json`, więc pokaz demonstracyjny nie wymaga dostępu do API. Obrys toru pochodzi z telemetrii; ruch bolidów jest przybliżany z czasów okrążeń. To nie jest dokładna rekonstrukcja GPS wszystkich kierowców.

OpenF1 udostępnia archiwum bez uwierzytelniania. **Pełny strumień LIVE wymaga płatnego dostępu u dostawcy i nie jest podłączony w tej wersji.** UI oddziela powtórkę, archiwum i bieżącą sesję. Ograniczenia sieci lub API nie wyłączają dołączonej powtórki.

GitHub Pages jest hostingiem statycznym. Ewentualna integracja wymagająca hasła lub sekretu powinna mieć osobny backend; poświadczenia nie mogą trafić do `dist/`. Źródła: [OpenF1](https://openf1.org/), [dokumentacja](https://openf1.org/docs/), [uwierzytelnianie](https://openf1.org/auth.html).

## Instalacja i pamięć offline

Otwórz opublikowany adres na tablecie. W Safari na iPadzie użyj opcji dodania do ekranu głównego z menu udostępniania. W Chrome na Androidzie użyj opcji instalacji aplikacji/dodania do ekranu głównego. Dostępność nazw i opcji zależy od przeglądarki.

Pierwsze otwarcie wymaga internetu. W ustawieniach APEX status **Powtórka offline: Gotowa** potwierdza zapis danych. Przeglądarka może później usunąć pamięć witryny; pobieranie nowej sesji zawsze wymaga internetu. Zmiany adresu repozytorium lub domeny traktowane są jako nowa instalacja.

## Struktura projektu

| Ścieżka | Zawartość |
|---|---|
| `dist/` | Cała gotowa aplikacja i dane powtórki |
| `dist/showcase.html` | Działająca aplikacja w ramce tabletu/telefonu |
| `dist/engine.js` | Silnik odtwarzania chronologii wyścigu |
| `dist/api.js` | Klient publicznego API OpenF1 |
| `dist/sw.js` | Aktualizacja plików i pamięć offline ograniczona do katalogu aplikacji |
| `scripts/serve.mjs` | Lokalny serwer bez dodatkowych zależności |
| `tests/` | Kontrole danych, końcowych wyników i przenośności |
| `.github/workflows/pages.yml` | Automatyczne sprawdzanie i wdrażanie na GitHub Pages |
| `THIRD_PARTY_NOTICES.md` | Informacje o danych i foncie |

## Kontrole przed publikacją

```bash
npm test
```

Sprawdzane są składnia JavaScript, chronologia i końcowe wyniki wyścigu, DNF/DNS, dublowanie, najpóźniejsze okrążenia, ścieżki pod `/` i `/apex-f1/`, manifest PWA, działanie offline oraz izolacja cache innych aplikacji.

Gotowy workflow zweryfikowano z dokumentacją oficjalnych akcji GitHub. W tej paczce nie ma docelowego repozytorium, więc jej deployment wykona się dopiero po Twoim pushu. Eksport nie zawiera oryginalnego `.git`, konfiguracji `.openai`, identyfikatorów hostingu ani tokenów.

Po zachowaniu ZIP-a oraz sprawdzeniu nowej strony możesz usunąć pierwotny projekt. Ta kopia nie odwołuje się do jego adresu ani usług.
