# Mandi Price Trends — Data Coverage & Working Selections Guide

> **Data Provenance & Audit Notice**: Extracted directly by querying all 3,211 rows in Supabase `mandi_prices`.
> Current as of: October 2026 | Source: data.gov.in / Agmarknet snapshot dataset.

---

## 1. Executive Summary & Why You See 0–1 Reports

If you have been selecting combinations in **Price Trends** and consistently seeing **0 reports**, **1 report**, or a **"Thin Data / Limited History"** notice, this is the root cause:

1. **There are currently ZERO combinations with >= 10 reports in the database.**
2. The entire `mandi_prices` database table contains **3,211 records** collected on only **5 calendar dates**:
   - `2026-09-09` (481 records)
   - `2026-09-12` (642 records)
   - `2026-09-14` (240 records)
   - `2026-09-22` (1,544 records)
   - `2026-09-23` (304 records)
3. Because records exist on only 5 distinct dates, the **absolute maximum number of report dates for ANY combination in the entire database is 3 reports**.
4. **Codebase Threshold**: In `backend/app/data/mandi/series.py`, any series with fewer than 3 reports (`THIN_DATA_MIN_REPORTS = 3`) is flagged as `thin_data: true`. This causes the frontend to display the data in a table format rather than computing a 30-day percentage trend line.

---

## 2. Top Working Selections for Live Demo (3 Report Dates)

These 3 combinations have **3 distinct arrival dates** across the database. They meet the `THIN_DATA_MIN_REPORTS` threshold and render active multi-point trend graphs:

| # | Crop | State | Market (Mandi) | District | Available Report Dates | Latest Modal Price | Price Range (Min - Max) | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | **Wheat** | **Madhya Pradesh** | **Gorakhpur** | Dindori | `2026-09-09, 2026-09-12, 2026-09-22` | ₹2,500/qtl | ₹2,500 - ₹2,500 | ✅ 3 Reports (Active Chart) |
| 2 | **Wheat** | **Madhya Pradesh** | **Sidhi** | Sidhi | `2026-09-12, 2026-09-22, 2026-09-23` | ₹2,400/qtl | ₹2,360 - ₹2,410 | ✅ 3 Reports (Active Chart) |
| 3 | **Pomegranate** | **Punjab** | **Khanna** | Ludhiana | `2026-09-12, 2026-09-22, 2026-09-23` | ₹8,000/qtl | ₹8,000 - ₹8,000 | ✅ 3 Reports (Active Chart) |

### How to Test in the Web App:
- **Demo Option 1**: State: `Madhya Pradesh` → Crop: `Wheat` → Market: `Gorakhpur`
- **Demo Option 2**: State: `Madhya Pradesh` → Crop: `Wheat` → Market: `Sidhi`
- **Demo Option 3**: State: `Punjab` → Crop: `Pomegranate` → Market: `Khanna`

> 💡 **Crucial UI Tip**: In the web UI, click the **`90D`** (or `180D`) timeframe button in the chart header. Because the current date is October 2026 and the snapshot records are from September 2026 (Sep 9–Sep 23), the default 30-day window begins on Sep 14. Selecting **`90D`** encompasses all 3 report dates, rendering the full active Recharts price curve with `thin_data: false`.

---

## 3. High-Priority Working Combinations with 2 Reports (115 Mandis)

These combinations contain **2 distinct arrival dates**. While flagged as "Limited History (<3 reports)", they will render two verified data points and price metrics:

### Crop: Wheat (39 Mandis with 2 Reports)

| State | Market (Mandi) | District | Report Dates | Latest Modal Price | Price Range |
|---|---|---|---|---|---|
| Gujarat | **Bhesan** | Junagarh | `2026-09-09, 2026-09-22` | ₹2,500 | ₹2,000 - ₹2,750 |
| Gujarat | **Himatnagar** | Sabarkantha | `2026-09-12, 2026-09-22` | ₹2,850 | ₹2,700 - ₹3,000 |
| Gujarat | **Jetpur(Dist.Rajkot)** | Rajkot | `2026-09-12, 2026-09-22` | ₹2,850 | ₹2,675 - ₹3,020 |
| Gujarat | **Morva Hafad** | Panchmahals | `2026-09-09, 2026-09-12` | ₹2,325 | ₹2,250 - ₹2,400 |
| Gujarat | **Porbandar** | Porbandar | `2026-09-09, 2026-09-12` | ₹2,275 | ₹2,275 - ₹2,275 |
| Gujarat | **Vankaner** | Morbi | `2026-09-12, 2026-09-22` | ₹2,750 | ₹2,500 - ₹2,855 |
| Madhya Pradesh | **Badnagar** | Ujjain | `2026-09-12, 2026-09-22` | ₹2,816 | ₹2,510 - ₹2,830 |
| Madhya Pradesh | **Bareli** | Raisen | `2026-09-09, 2026-09-22` | ₹2,751 | ₹2,750 - ₹2,751 |
| Madhya Pradesh | **Bhopal** | Bhopal | `2026-09-09, 2026-09-22` | ₹2,852 | ₹2,250 - ₹2,852 |
| Madhya Pradesh | **Dabra** | Gwalior | `2026-09-09, 2026-09-22` | ₹2,600 | ₹2,600 - ₹2,650 |
| Madhya Pradesh | **Dhar** | Dhar | `2026-09-12, 2026-09-22` | ₹2,650 | ₹2,550 - ₹2,650 |
| Madhya Pradesh | **Indore** | Indore | `2026-09-09, 2026-09-12` | ₹2,700 | ₹2,700 - ₹2,700 |
| Madhya Pradesh | **Katni** | Katni | `2026-09-09, 2026-09-12` | ₹2,700 | ₹2,415 - ₹2,725 |
| Madhya Pradesh | **Krishi Upaj Mandi Samiti Bichhiya** | Mandla | `2026-09-09, 2026-09-12` | ₹2,505 | ₹2,450 - ₹2,505 |
| Madhya Pradesh | **Kukshi** | Dhar | `2026-09-09, 2026-09-22` | ₹2,500 | ₹2,400 - ₹2,700 |
| Madhya Pradesh | **Lakhnadon** | Seoni | `2026-09-09, 2026-09-22` | ₹2,261 | ₹2,251 - ₹2,262 |
| Madhya Pradesh | **Mandsaur** | Mandsaur | `2026-09-09, 2026-09-22` | ₹3,080 | ₹3,080 - ₹3,080 |
| Madhya Pradesh | **Narsinghpur** | Narsinghpur | `2026-09-09, 2026-09-22` | ₹2,611 | ₹2,589 - ₹2,631 |
| Madhya Pradesh | **Panna** | Panna | `2026-09-09, 2026-09-22` | ₹2,510 | ₹2,490 - ₹2,510 |
| Madhya Pradesh | **Satna** | Satna | `2026-09-09, 2026-09-22` | ₹2,461 | ₹2,421 - ₹2,461 |
| Madhya Pradesh | **Sehore** | Sehore | `2026-09-09, 2026-09-22` | ₹2,700 | ₹2,500 - ₹3,271 |
| Maharashtra | **Hinganghat** | Wardha | `2026-09-09, 2026-09-12` | ₹2,600 | ₹2,585 - ₹2,685 |
| Maharashtra | **Malegaon** | Nashik | `2026-09-12, 2026-09-22` | ₹2,751 | ₹2,586 - ₹3,115 |
| Maharashtra | **Washim** | Washim | `2026-09-09, 2026-09-12` | ₹2,600 | ₹2,585 - ₹2,781 |
| Rajasthan | **Gajsinghpur** | Ganganagar | `2026-09-09, 2026-09-12` | ₹2,601 | ₹2,585 - ₹2,610 |
| Rajasthan | **Suratgarh** | Ganganagar | `2026-09-09, 2026-09-14` | ₹2,662 | ₹2,650 - ₹2,666 |
| Uttar Pradesh | **Bahraich** | Bahraich | `2026-09-09, 2026-09-12` | ₹2,545 | ₹2,530 - ₹2,560 |
| Uttar Pradesh | **Bareilly** | Bareilly | `2026-09-09, 2026-09-12` | ₹2,603 | ₹2,600 - ₹2,610 |
| Uttar Pradesh | **Baripaal** | Kanpur | `2026-09-09, 2026-09-12` | ₹2,550 | ₹2,550 - ₹2,550 |
| Uttar Pradesh | **Basti** | Basti | `2026-09-09, 2026-09-12` | ₹2,490 | ₹2,480 - ₹2,500 |
| Uttar Pradesh | **Bharuasumerpur** | Hamirpur | `2026-09-09, 2026-09-12` | ₹2,597 | ₹2,580 - ₹2,650 |
| Uttar Pradesh | **Chirgaon** | Jhansi | `2026-09-09, 2026-09-12` | ₹2,446 | ₹2,415 - ₹2,470 |
| Uttar Pradesh | **Jalalabad** | Shahjahanpur | `2026-09-12, 2026-09-22` | ₹2,584 | ₹2,500 - ₹2,670 |
| Uttar Pradesh | **Kasganj** | Kasganj | `2026-09-12, 2026-09-22` | ₹2,575 | ₹2,500 - ₹2,650 |
| Uttar Pradesh | **Lalitpur** | Lalitpur | `2026-09-09, 2026-09-12` | ₹2,351 | ₹2,350 - ₹2,352 |
| Uttar Pradesh | **Meeranpur Katra** | Shahjahanpur | `2026-09-09, 2026-09-22` | ₹2,525 | ₹2,525 - ₹2,525 |
| Uttar Pradesh | **Shahganj** | Jaunpur | `2026-09-09, 2026-09-12` | ₹2,600 | ₹2,400 - ₹2,720 |
| Uttar Pradesh | **Shahjahanpur** | Shahjahanpur | `2026-09-09, 2026-09-22` | ₹2,525 | ₹2,525 - ₹2,525 |
| Uttar Pradesh | **Sultanpur** | Amethi | `2026-09-09, 2026-09-12` | ₹2,665 | ₹2,650 - ₹2,700 |

### Crop: Maize (2 Mandis with 2 Reports)

| State | Market (Mandi) | District | Report Dates | Latest Modal Price | Price Range |
|---|---|---|---|---|---|
| Andhra Pradesh | **Santhamaguluru** | Prakasam | `2026-09-22, 2026-09-23` | ₹2,450 | ₹2,400 - ₹2,480 |
| Maharashtra | **Malegaon** | Nashik | `2026-09-09, 2026-09-22` | ₹2,100 | ₹1,690 - ₹2,399 |

### Crop: Potato (3 Mandis with 2 Reports)

| State | Market (Mandi) | District | Report Dates | Latest Modal Price | Price Range |
|---|---|---|---|---|---|
| Gujarat | **Kapadvanj** | Kheda | `2026-09-09, 2026-09-22` | ₹1,050 | ₹600 - ₹1,500 |
| Punjab | **Khanna** | Ludhiana | `2026-09-22, 2026-09-23` | ₹500 | ₹500 - ₹500 |
| Rajasthan | **Rawatsar** | Hanumangarh | `2026-09-12, 2026-09-14` | ₹800 | ₹600 - ₹1,000 |

### Crop: Onion (8 Mandis with 2 Reports)

| State | Market (Mandi) | District | Report Dates | Latest Modal Price | Price Range |
|---|---|---|---|---|---|
| Bihar | **Balliah** | Begusarai | `2026-09-12, 2026-09-22` | ₹5,100 | ₹5,000 - ₹5,200 |
| Gujarat | **Navsari** | Navsari | `2026-09-09, 2026-09-22` | ₹4,800 | ₹3,800 - ₹5,800 |
| Keralam | **Mukkom Market** | Kozhikode(Calicut) | `2026-09-12, 2026-09-22` | ₹5,200 | ₹5,100 - ₹5,300 |
| Maharashtra | **Manmad** | Nashik | `2026-09-09, 2026-09-12` | ₹3,900 | ₹500 - ₹4,300 |
| Rajasthan | **Bayana** | Bharatpur | `2026-09-12, 2026-09-14` | ₹2,200 | ₹2,200 - ₹2,200 |
| Rajasthan | **Rajsamand** | Rajsamand | `2026-09-14, 2026-09-23` | ₹2,600 | ₹2,200 - ₹3,000 |
| Rajasthan | **Rawatsar** | Hanumangarh | `2026-09-12, 2026-09-14` | ₹1,700 | ₹1,300 - ₹2,000 |
| Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹5,000 | ₹4,800 - ₹5,200 |

### Crop: Mustard (1 Mandis with 2 Reports)

| State | Market (Mandi) | District | Report Dates | Latest Modal Price | Price Range |
|---|---|---|---|---|---|
| Madhya Pradesh | **Pohari** | Shivpuri | `2026-09-09, 2026-09-22` | ₹8,040 | ₹7,000 - ₹8,075 |

### Crop: Tomato (2 Mandis with 2 Reports)

| State | Market (Mandi) | District | Report Dates | Latest Modal Price | Price Range |
|---|---|---|---|---|---|
| Rajasthan | **Rawatsar** | Hanumangarh | `2026-09-12, 2026-09-14` | ₹1,800 | ₹1,000 - ₹2,000 |
| Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹2,900 | ₹2,700 - ₹3,000 |

### Other Crops with 2-Report Mandis

| Crop | State | Market (Mandi) | District | Report Dates | Latest Modal Price |
|---|---|---|---|---|---|
| Bhindi(Ladies Finger) | Gujarat | **Himatnagar(Veg.Market Himatnagar)** | Sabarkantha | `2026-09-09, 2026-09-22` | ₹2,300 |
| Bhindi(Ladies Finger) | Haryana | **Ladwa** | Kurukshetra | `2026-09-12, 2026-09-22` | ₹4,000 |
| Bhindi(Ladies Finger) | Maharashtra | **Nasik** | Nashik | `2026-09-09, 2026-09-22` | ₹1,250 |
| Bhindi(Ladies Finger) | Punjab | **Khanna** | Ludhiana | `2026-09-22, 2026-09-23` | ₹2,500 |
| Bhindi(Ladies Finger) | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹2,200 |
| Bhindi(Ladies Finger) | Uttarakhand | **Roorkee** | Haridwar | `2026-09-22, 2026-09-23` | ₹1,300 |
| Cauliflower | Gujarat | **Kalol(Veg,Market,Kalol)** | Gandhinagar | `2026-09-09, 2026-09-22` | ₹2,000 |
| Cauliflower | Gujarat | **Kapadvanj** | Kheda | `2026-09-09, 2026-09-22` | ₹2,250 |
| Cauliflower | Haryana | **Ganaur** | Sonipat | `2026-09-12, 2026-09-22` | ₹4,200 |
| Cauliflower | Keralam | **Kattappana Market** | Idukki | `2026-09-22, 2026-09-23` | ₹4,600 |
| Cauliflower | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹3,800 |
| Banana | Gujarat | **Mehsana(Mehsana Veg)** | Mehsana | `2026-09-09, 2026-09-22` | ₹2,000 |
| Banana | Keralam | **Kattappana Market** | Idukki | `2026-09-22, 2026-09-23` | ₹5,800 |
| Banana | Keralam | **Kollengode Market** | Palakad | `2026-09-12, 2026-09-22` | ₹4,700 |
| Banana | Maharashtra | **Nasik** | Nashik | `2026-09-09, 2026-09-22` | ₹1,300 |
| Cabbage | Gujarat | **Kapadvanj** | Kheda | `2026-09-09, 2026-09-22` | ₹1,350 |
| Cabbage | Punjab | **Khanna** | Ludhiana | `2026-09-22, 2026-09-23` | ₹800 |
| Cabbage | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹1,900 |
| Pumpkin | Haryana | **Ganaur** | Sonipat | `2026-09-12, 2026-09-22` | ₹2,800 |
| Pumpkin | Keralam | **Mananthavady Market** | Wayanad | `2026-09-12, 2026-09-23` | ₹1,200 |
| Pumpkin | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹1,600 |
| Lentil(Masur)(Whole) | Madhya Pradesh | **Jabalpur** | Jabalpur | `2026-09-09, 2026-09-22` | ₹5,900 |
| Lentil(Masur)(Whole) | Madhya Pradesh | **Narsinghpur** | Narsinghpur | `2026-09-09, 2026-09-22` | ₹6,000 |
| Green Gram(Moong)(Whole) | Haryana | **Hissar** | Hissar | `2026-09-12, 2026-09-22` | ₹7,380 |
| Green Gram(Moong)(Whole) | Madhya Pradesh | **Gadarwada** | Narsinghpur | `2026-09-09, 2026-09-22` | ₹7,825 |
| Tinda | Gujarat | **Himatnagar(Veg.Market Himatnagar)** | Sabarkantha | `2026-09-09, 2026-09-22` | ₹2,300 |
| Tinda | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹4,500 |
| Brinjal | Gujarat | **Nadiyad(Chaklasi)** | Kheda | `2026-09-09, 2026-09-22` | ₹950 |
| Brinjal | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹1,700 |
| Cucumbar(Kheera) | Keralam | **Mukkom Market** | Kozhikode(Calicut) | `2026-09-12, 2026-09-22` | ₹1,900 |
| Cucumbar(Kheera) | Punjab | **Khanna** | Ludhiana | `2026-09-22, 2026-09-23` | ₹1,500 |
| Ginger(Green) | Keralam | **Mananthavady Market** | Wayanad | `2026-09-12, 2026-09-23` | ₹9,060 |
| Ginger(Green) | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹8,000 |
| Carrot | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹3,100 |
| Carrot | Telangana | **RYTHU BAZAR FALAKNUMA** | Hyderabad | `2026-09-12, 2026-09-22` | ₹4,500 |
| Tender Coconut | Rajasthan | **Jodhpur (F&V)** | Jodhpur | `2026-09-14, 2026-09-22` | ₹3,000 |
| Tender Coconut | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹6,800 |
| Apple | Keralam | **Kattappana Market** | Idukki | `2026-09-22, 2026-09-23` | ₹33,000 |
| Apple | Punjab | **Khanna** | Ludhiana | `2026-09-12, 2026-09-22` | ₹8,000 |
| Bottle gourd | Punjab | **Khanna** | Ludhiana | `2026-09-12, 2026-09-22` | ₹1,200 |
| Bottle gourd | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹1,100 |
| Garlic | Rajasthan | **Bayana** | Bharatpur | `2026-09-12, 2026-09-14` | ₹10,000 |
| Garlic | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹16,500 |
| Cummin Seed(Jeera) | Gujarat | **Tharad** | Banaskanth | `2026-09-09, 2026-09-22` | ₹17,525 |
| Castor Seed | Gujarat | **Lakhani** | Banaskanth | `2026-09-09, 2026-09-22` | ₹7,562 |
| Beetroot | Keralam | **Kollengode Market** | Palakad | `2026-09-12, 2026-09-22` | ₹3,800 |
| Papaya | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹3,500 |
| Water Melon | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹2,500 |
| Lemon | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹9,000 |
| Spinach | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹2,500 |
| Coriander(Leaves) | Rajasthan | **Dungarpur** | Dungarpur | `2026-09-12, 2026-09-14` | ₹2,000 |
| Bitter gourd | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹3,000 |
| Cluster beans | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹6,700 |
| Guar | Rajasthan | **Sadulpur** | Churu | `2026-09-12, 2026-09-14` | ₹6,000 |
| Bajra(Pearl Millet/Cumbu) | Rajasthan | **Govindgarh** | Alwar | `2026-09-12, 2026-09-14` | ₹2,000 |
| Guava | Rajasthan | **Sriganganagar (F&V)** | Ganganagar | `2026-09-12, 2026-09-14` | ₹5,600 |
| Bengal Gram(Gram)(Whole) | Andhra Pradesh | **Maddipadu** | Prakasam | `2026-09-22, 2026-09-23` | ₹6,000 |
| Sweet Potato | Keralam | **Kattappana Market** | Idukki | `2026-09-22, 2026-09-23` | ₹5,500 |
| Green Chilli | Punjab | **Khanna** | Ludhiana | `2026-09-22, 2026-09-23` | ₹1,500 |
| Paddy(Common) | Andhra Pradesh | **Maddipadu** | Prakasam | `2026-09-22, 2026-09-23` | ₹2,800 |

---

## 4. Root Cause: Why Are There No >= 10 Report Combinations Yet?

1. **Snapshot Ingestion**: The existing database was populated from `data/market_price_history.json`, which was a curated 5-day snapshot file created during initial system development.
2. **Government API Unavailability**:
   - `data.gov.in` often times out (>15s) under high traffic or rate-limits requests without a paid enterprise quota.
   - `api.agmarknet.gov.in` currently rejects programmatic window queries with HTTP 400 Bad Request.
3. **Zero-Fabrication Policy**: In strict compliance with `AGENTS.md` Rule §2, synthetic or mock numbers are never silently inserted into `mandi_prices`.

---

## 5. How to Obtain 10–30+ Reports for Demos & Mentors

To give judges/mentors rich 30-day graphs with 10–30 reports per market, consider these options:

1. **Dedicated Demo Seed Script (Recommended for Hackathons)**:  
   We can write and run `backend/jobs/seed_demo_trends.py` to generate 30 daily reports for the top 10 priority mandis (e.g., Lasalgaon Onion, Malegaon Wheat, Rajkot Wheat, Khanna Wheat, Indore Wheat) using realistic daily price variations anchored to official government benchmark prices. All records will be transparently labeled with `source: "demo_benchmark_seed"`.
2. **Importing an Agmarknet Historical CSV**:  
   If you have a multi-month CSV from Agmarknet or Kaggle, run `python -m backend.jobs.load_kaggle_seed --csv <path>` to upsert it directly into Supabase.
