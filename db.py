import requests
import sqlite3
import time
import os

api_key = os.environ.get("FLUVIEW_API_KEY")

if not api_key:
    raise ValueError("Please set the FLUVIEW_API_KEY environment variable")


# All states + DC + Territories
states = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
    "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
    "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
    "TX","UT","VT","VA","WA","WV","WI","WY","DC","X", "AS", "MP", "GU", "PR",
    "VI"
]

conn = sqlite3.connect("ili_data.db")
cur = conn.cursor()

cur.execute('''
CREATE TABLE IF NOT EXISTS ili_data (
    release_date TEXT,
    region TEXT,
    issue INTEGER,
    epiweek INTEGER,
    lag INTEGER,
    num_ili INTEGER,
    num_patients INTEGER,
    num_providers INTEGER,
    num_age_0 INTEGER,
    num_age_1 INTEGER,
    num_age_2 INTEGER,
    num_age_3 INTEGER,
    num_age_4 INTEGER,
    num_age_5 INTEGER,
    wili REAL,
    ili REAL,
    PRIMARY KEY (region, epiweek)
)
''')

start_year = 1997
end_year = 2025

for year in range(start_year, end_year + 1):
    start_epi = int(f"{year}01")
    end_epi = int(f"{year}53")

    print(f"Fetching data for {year} ({start_epi}-{end_epi})...")

    url = (
        "https://delphi.cmu.edu/epidata/api.php"
        f"?api_key={api_key}"
        f"&source=fluview"
        f"&regions={','.join(states)}"
        f"&metrics=ili"
        f"&epiweeks={start_epi}-{end_epi}"
        "&format=json"
    )

    try:
        resp = requests.get(url, timeout=30)
        data = resp.json()
    except Exception as e:
        print(f"Error fetching data for {year}: {e}")
        continue

    if not isinstance(data, list) or len(data) == 0:
        print(f"No data returned for {year}. URL: {url}")
        continue

    # Insert rows
    for entry in data:
        cur.execute('''
            INSERT OR REPLACE INTO ili_data (
                release_date, region, issue, epiweek, lag, num_ili, num_patients,
                num_providers, num_age_0, num_age_1, num_age_2, num_age_3,
                num_age_4, num_age_5, wili, ili
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            entry.get('release_date'),
            entry.get('region'),
            entry.get('issue'),
            entry.get('epiweek'),
            entry.get('lag'),
            entry.get('num_ili'),
            entry.get('num_patients'),
            entry.get('num_providers'),
            entry.get('num_age_0'),
            entry.get('num_age_1'),
            entry.get('num_age_2'),
            entry.get('num_age_3'),
            entry.get('num_age_4'),
            entry.get('num_age_5'),
            entry.get('wili'),
            entry.get('ili')
        ))

    print(f"Year {year} done, {len(data)} rows inserted.")

    time.sleep(1)

conn.commit()
conn.close()

print("SQLite database 'ili_data.db' updated successfully!")
