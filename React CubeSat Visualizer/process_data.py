from skyfield.api import wgs84
import pandas as pd
import numpy as np
import json
import io
import os
from skyfield.api import load, EarthSatellite, wgs84
from datetime import timedelta

# 1. SETUP PHYSICS (Quetzal-1 TLE)
line1 = "1 45598U 98067RW  20156.50406087  .00018898  00000-0  34651-3 0  9997"
line2 = "2 45598  51.6436 213.9137 0003063 103.7997 256.4003 15.49397960  6248"
ts = load.timescale()
satellite = EarthSatellite(line1, line2, 'QUETZAL-1', ts)
eph = load('de421.bsp') 
epoch = satellite.epoch.utc_datetime()

# 2. LOAD EXCEL FILE
# We look for the file in the current directory
file_name = "telemetry.xlsx"
print(f"Looking for local file: {file_name}...")

if os.path.exists(file_name):
    print("File found. Parsing Excel (this may take a moment)...")
    # Read Excel using openpyxl engine
    df = pd.read_excel(file_name, engine='openpyxl')
    print("Excel Load Successful.")
else:
    print(f"ERROR: Could not find '{file_name}'.")
    print("Please download it from GitHub and place it in this folder.")
    # Fallback to Simulation so script doesn't crash
    df = None

# 3. PROCESS DATA
limit = 5000 
volts = []
solar = []

if df is not None:
    # A. DOWNSAMPLING (Excel is heavy, we must slice)
    step = max(1, len(df) // limit)
    df_slice = df.iloc[::step].copy()
    
    # B. COLUMN MAPPING (Based on typical Quetzal headers)
    # We look for 'Battery Voltage' and 'Solar Current'
    def find_col(keywords):
        for col in df.columns:
            for key in keywords:
                if str(key).lower() in str(col).lower(): return col
        return None

    # Common headers in Quetzal Excel files:
    # 'EPS_Dist_Batt_V' or just 'Battery Voltage'
    v_col = find_col(['batt_v', 'battery', 'voltage'])
    # 'EPS_Dist_Batt_I' or 'Solar' or 'Current'
    s_col = find_col(['solar', 'current', 'batt_i']) 
    
    # Debug print to see what we found
    print(f"Mapped Columns -> Voltage: {v_col} | Solar: {s_col}")
    
    # Clean and Extract
    # We use column index 1 and 2 as fallback if names don't match
    if not v_col: v_col = df.columns[1] 
    if not s_col: s_col = df.columns[2]

    volts = pd.to_numeric(df_slice[v_col], errors='coerce').fillna(3.9).tolist()
    solar = pd.to_numeric(df_slice[s_col], errors='coerce').fillna(0).tolist()

else:
    # SIMULATION MODE
    print("Switching to SIMULATION MODE.")
    t_range = np.linspace(0, limit*30, limit)
    volts = (3.9 + 0.2 * np.sin(t_range/3000)).tolist() 
    solar = [200 if np.sin(t/3000) > 0 else 0 for t in t_range]

# 4. PROPAGATE ORBIT
path = []
timestamps = []
colors = []
anomalies = []
faults = []

print("Propagating Orbit...")

for i in range(len(volts)):
    t_sim = epoch + timedelta(seconds=i*60) 
    t = ts.from_datetime(t_sim)
    
    subpoint = satellite.at(t).subpoint()
    path.append([subpoint.longitude.degrees, subpoint.latitude.degrees, subpoint.elevation.km * 1000])
    timestamps.append(i)
    
    # Logic
    is_sunlit = satellite.at(t).is_sunlit(eph)
    
    # Convert 'solar' to float safely
    curr_solar = float(solar[i])
    
    if is_sunlit and curr_solar < 10:
        faults.append(i)
        colors.append([255, 0, 255]) # Magenta (Fault)
    elif not is_sunlit:
        colors.append([0, 100, 255]) # Blue (Eclipse)
    else:
        colors.append([255, 215, 0]) # Gold (Sun)
        
    if float(volts[i]) < 3.8:
        anomalies.append(i)


# --- CALCULATE WATERLOO PASSES ---
print("Calculating Access Windows for Waterloo...")

# 1. Define Waterloo, Ontario coordinates
# Lat: 43.4643 N, Lon: 80.5204 W (West is negative)
waterloo = wgs84.latlon(43.4643, -80.5204)

# 2. Define the time range (Simulation Start to End)
t0 = ts.from_datetime(epoch)
t1 = ts.from_datetime(epoch + timedelta(seconds=limit*60)) # limit was defined earlier

# 3. Find "Events" (Rise, Culminate, Set)
# altitude_degrees=10.0 means we only care if it's 10 degrees above horizon
t_events, events = satellite.find_events(waterloo, t0, t1, altitude_degrees=10.0)

# 4. Process the events into a clean list
pass_list = []
current_pass = {}

for ti, event in zip(t_events, events):
    # event: 0=Rise, 1=Culminate (Peak), 2=Set
    if event == 0: # AOS (Acquisition of Signal)
        current_pass['aos_time'] = ti.utc_datetime()
        # Find index in our main timeline (approximate)
        time_diff = (ti.utc_datetime() - epoch).total_seconds()
        current_pass['aos_index'] = int(time_diff / 60) # Convert to minutes/index
        
    elif event == 1: # Max Elevation
        # Get the actual elevation angle
        topocentric = (satellite - waterloo).at(ti)
        alt, az, distance = topocentric.altaz()
        current_pass['max_el'] = int(alt.degrees)
        
    elif event == 2 and 'aos_time' in current_pass: # LOS (Loss of Signal)
        duration = (ti.utc_datetime() - current_pass['aos_time']).total_seconds()
        current_pass['duration_mins'] = int(duration / 60)
        pass_list.append(current_pass)
        current_pass = {} # Reset for next pass

print(f"Found {len(pass_list)} passes over Waterloo.")



# 5. EXPORT
output = {
    "meta": { "name": "Quetzal-1 Excel Log", "start_time": epoch.isoformat() },
    "telemetry": {
        "path": path,
        "timestamps": timestamps,
        "colors": colors,
        "anomalies": anomalies,
        "faults": faults,
        "metrics": { "voltage": volts, "solar": solar }
    },
    "passes": pass_list  # <--- CHANGE THIS from [] to pass_list
}

# with open('../public/mission_data.json', 'w') as f:
#     json.dump(output, f)

# Custom converter for datetime objects
def default_converter(o):
    if hasattr(o, 'isoformat'):
        return o.isoformat()
    raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

# Save strictly to the current folder
with open('mission_data.json', 'w') as f:
    json.dump(output, f, default=default_converter) # <--- Added the converter here

print(f"DONE. Generated JSON from Excel data.")