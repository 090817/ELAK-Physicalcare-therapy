"""
StepHeal Loop — Synthetic Patient Dataset Generator (v5.1)
==========================================================
Adds physiological realism:
  - Random walk (autocorrelation) for vital signs
  - Cross-metric coupling: sleep/pain affect HR, BP, HRV
  - VO2max updated weekly, not daily

All other modules (gait, plantar pressure, medications, sleep, etc.) unchanged.
"""

import json
import random
import numpy as np
from datetime import datetime, timedelta

random.seed(42)
np.random.seed(42)

# ──────────────────────────────────────────────
# 1. Condition profiles (same)
# ──────────────────────────────────────────────
CONDITIONS = {
    "Knee Replacement Post-Op": {
        "asymmetry": (4.5, 7.0), "double_support": (32, 38), "speed": (0.55, 0.75),
        "cadence": (85, 100), "step_length": (45, 58), "stance_pct": (64, 72),
        "swing_pct": (28, 36), "pain_vas": (4, 7), "adherence": (0.6, 0.9),
        "improve_rate": 0.08, "hrv": (18, 35), "resting_hr": (68, 82),
        "walking_hr": (95, 115), "vo2max": (18, 26), "foot_posture": "Pronated",
    },
    "Stroke Hemiparesis": {
        "asymmetry": (5.0, 8.5), "double_support": (35, 42), "speed": (0.45, 0.65),
        "cadence": (70, 90), "step_length": (38, 50), "stance_pct": (66, 76),
        "swing_pct": (24, 34), "pain_vas": (3, 6), "adherence": (0.3, 0.7),
        "improve_rate": 0.04, "hrv": (15, 30), "resting_hr": (72, 88),
        "walking_hr": (100, 125), "vo2max": (14, 22), "foot_posture": "Supinated",
    },
    "Parkinson's Disease": {
        "asymmetry": (3.0, 5.5), "double_support": (30, 36), "speed": (0.60, 0.80),
        "cadence": (95, 112), "step_length": (50, 62), "stance_pct": (60, 68),
        "swing_pct": (32, 40), "pain_vas": (2, 5), "adherence": (0.4, 0.8),
        "improve_rate": 0.03, "hrv": (12, 25), "resting_hr": (65, 78),
        "walking_hr": (88, 108), "vo2max": (16, 24), "foot_posture": "Neutral",
    },
    "Chronic Low Back Pain": {
        "asymmetry": (2.0, 4.0), "double_support": (26, 32), "speed": (0.70, 0.90),
        "cadence": (95, 110), "step_length": (55, 68), "stance_pct": (58, 64),
        "swing_pct": (36, 42), "pain_vas": (5, 8), "adherence": (0.5, 0.85),
        "improve_rate": 0.05, "hrv": (22, 40), "resting_hr": (62, 75),
        "walking_hr": (85, 100), "vo2max": (22, 32), "foot_posture": "Neutral",
    },
    "Healthy Older Adult": {
        "asymmetry": (0.8, 2.0), "double_support": (28, 34), "speed": (0.90, 1.10),
        "cadence": (100, 118), "step_length": (60, 75), "stance_pct": (58, 63),
        "swing_pct": (37, 42), "pain_vas": (0, 2), "adherence": (0.7, 0.95),
        "improve_rate": 0.01, "hrv": (30, 55), "resting_hr": (55, 68),
        "walking_hr": (75, 92), "vo2max": (28, 40), "foot_posture": "Neutral",
    },
}

# ──────────────────────────────────────────────
# 2. Medication library (same)
# ──────────────────────────────────────────────
MEDICATIONS_BY_CONDITION = {
    "Knee Replacement Post-Op": [
        {"name": "Acetaminophen", "dosage": 500, "unit": "mg", "type": "as_needed", "indication": "pain", "frequency": "up to 4x daily"},
        {"name": "Ibuprofen", "dosage": 400, "unit": "mg", "type": "as_needed", "indication": "pain", "frequency": "up to 3x daily"},
        {"name": "Aspirin", "dosage": 100, "unit": "mg", "type": "scheduled", "indication": "anticoagulation", "frequency": "once daily"},
    ],
    "Stroke Hemiparesis": [
        {"name": "Clopidogrel", "dosage": 75, "unit": "mg", "type": "scheduled", "indication": "antiplatelet", "frequency": "once daily"},
        {"name": "Amlodipine", "dosage": 5, "unit": "mg", "type": "scheduled", "indication": "hypertension", "frequency": "once daily"},
        {"name": "Atorvastatin", "dosage": 20, "unit": "mg", "type": "scheduled", "indication": "cholesterol", "frequency": "once daily"},
    ],
    "Parkinson's Disease": [
        {"name": "Levodopa/Carbidopa", "dosage": 100, "unit": "mg", "type": "scheduled", "indication": "motor symptoms", "frequency": "3x daily"},
        {"name": "Pramipexole", "dosage": 0.5, "unit": "mg", "type": "scheduled", "indication": "motor symptoms", "frequency": "3x daily"},
    ],
    "Chronic Low Back Pain": [
        {"name": "Celecoxib", "dosage": 200, "unit": "mg", "type": "as_needed", "indication": "pain", "frequency": "once daily"},
        {"name": "Cyclobenzaprine", "dosage": 10, "unit": "mg", "type": "as_needed", "indication": "muscle spasm", "frequency": "up to 3x daily"},
        {"name": "Acetaminophen", "dosage": 500, "unit": "mg", "type": "as_needed", "indication": "pain", "frequency": "up to 4x daily"},
    ],
    "Healthy Older Adult": [
        {"name": "Vitamin D", "dosage": 1000, "unit": "IU", "type": "scheduled", "indication": "bone health", "frequency": "once daily"},
        {"name": "Calcium", "dosage": 500, "unit": "mg", "type": "scheduled", "indication": "bone health", "frequency": "once daily"},
        {"name": "Amlodipine", "dosage": 5, "unit": "mg", "type": "scheduled", "indication": "hypertension", "frequency": "once daily"},
    ],
}

# ──────────────────────────────────────────────
# 3. Plantar pressure zones (same)
# ──────────────────────────────────────────────
PLANTAR_ZONES = {
    "hallux": (118.6, 34.2), "toes_2_5": (59.0, 20.2),
    "metatarsal_1": (116.8, 17.6), "metatarsal_2": (185.4, 26.6),
    "metatarsal_3": (183.9, 22.4), "metatarsal_4": (153.6, 23.1),
    "metatarsal_5": (102.2, 21.0), "midfoot": (49.7, 13.5),
    "medial_heel": (165.3, 23.2), "lateral_heel": (157.0, 23.3),
}

PRESSURE_MULTIPLIER = {
    "Knee Replacement Post-Op": {"affected": "right", "mult": (0.72, 0.88)},
    "Stroke Hemiparesis":       {"affected": "right", "mult": (0.65, 0.82)},
    "Parkinson's Disease":      {"affected": "left",  "mult": (0.88, 0.96)},
    "Chronic Low Back Pain":    {"affected": "none",  "mult": (0.95, 1.0)},
    "Healthy Older Adult":      {"affected": "none",  "mult": (1.0, 1.0)},
}

# ──────────────────────────────────────────────
# 4. Helpers
# ──────────────────────────────────────────────
def clamp(value, lo, hi):
    return max(lo, min(hi, value))

def generate_plantar_zone(base_mean, base_std, mult, day_improve):
    raw = np.random.normal(base_mean, base_std)
    raw *= mult
    raw *= (1 + day_improve * 0.3)
    return round(clamp(raw, 5, 450), 1)

def stability_classification(asymmetry, double_support, speed):
    score = 0
    if asymmetry > 4.0: score += 2
    elif asymmetry > 2.5: score += 1
    if double_support > 35: score += 2
    elif double_support > 30: score += 1
    if speed < 0.6: score += 2
    elif speed < 0.8: score += 1
    return "Low" if score >= 4 else ("OK" if score >= 2 else "High")

def foot_arch_index(metatarsal_avg, midfoot_avg):
    return round(midfoot_avg / max(metatarsal_avg, 1), 3)

# ──────────────────────────────────────────────
# 5. Generate patients
# ──────────────────────────────────────────────
patients = []
START_DATE = datetime(2026, 9, 1)

for i in range(1, 51):
    condition = random.choice(list(CONDITIONS.keys()))
    cfg = CONDITIONS[condition]
    pressure_cfg = PRESSURE_MULTIPLIER[condition]

    age = random.randint(35, 85) if condition != "Healthy Older Adult" else random.randint(65, 85)
    gender = random.choice(["Male", "Female"])
    bmi = round(random.uniform(18.5, 32.0), 1)

    # Baselines
    asym_base = random.uniform(*cfg["asymmetry"])
    ds_base = random.uniform(*cfg["double_support"])
    speed_base = random.uniform(*cfg["speed"])
    cadence_base = random.uniform(*cfg["cadence"])
    step_len_base = random.uniform(*cfg["step_length"])
    stance_base = random.uniform(*cfg["stance_pct"])
    swing_base = random.uniform(*cfg["swing_pct"])
    pain_base = random.uniform(*cfg["pain_vas"])
    adherence_base = random.uniform(*cfg["adherence"])
    hrv_base = random.uniform(*cfg["hrv"])
    resting_hr_base = random.uniform(*cfg["resting_hr"])
    walking_hr_base = random.uniform(*cfg["walking_hr"])
    vo2max_base = random.uniform(*cfg["vo2max"])
    improve = cfg["improve_rate"]

    bp_sys_base = random.uniform(110, 145) if condition != "Healthy Older Adult" else random.uniform(105, 135)
    bp_dia_base = random.uniform(70, 90) if condition != "Healthy Older Adult" else random.uniform(65, 85)
    body_mass_base = random.uniform(55, 95)
    body_fat_base = random.uniform(18, 38) if gender == "Male" else random.uniform(25, 45)
    resp_rate_base = random.uniform(12, 20)
    spo2_base = random.uniform(94, 99)

    # Medications prescribed
    med_pool = MEDICATIONS_BY_CONDITION.get(condition, [])
    num_meds = random.choices([0, 1, 2], weights=[0.3, 0.5, 0.2])[0] if condition == "Healthy Older Adult" \
               else random.choices([1, 2, 3], weights=[0.3, 0.5, 0.2])[0]
    prescribed = random.sample(med_pool, min(num_meds, len(med_pool))) if med_pool else []
    for med in prescribed:
        med["_adherence"] = random.uniform(0.7, 0.98) if med["type"] == "scheduled" else random.uniform(0.4, 0.9)

    # ── Initialize "previous day" values for random walk ──
    prev_resting_hr = resting_hr_base
    prev_walking_hr = walking_hr_base
    prev_bp_sys = bp_sys_base
    prev_bp_dia = bp_dia_base
    prev_body_mass = body_mass_base
    prev_body_fat = body_fat_base
    prev_hrv = hrv_base
    prev_vo2max = vo2max_base
    prev_resp_rate = resp_rate_base
    prev_spo2 = spo2_base

    daily_records = []

    for day in range(30):
        date = START_DATE + timedelta(days=day)
        trend = 1 - improve * day / 30.0
        weekend_factor = 0.85 if date.weekday() >= 5 else 1.0

        # ── Gait spatiotemporal ──
        asymmetry = clamp(asym_base * trend + np.random.normal(0, 0.25), 0.3, 12.0)
        double_support = clamp(ds_base * (1 - improve * day / 70.0) + np.random.normal(0, 1.0), 14, 48)
        speed = clamp(speed_base * (1 + improve * day / 28.0) + np.random.normal(0, 0.04), 0.25, 1.5)
        cadence = clamp(cadence_base * (1 + improve * day / 50.0) + np.random.normal(0, 3), 55, 140)
        step_length = clamp(step_len_base * (1 + improve * day / 40.0) + np.random.normal(0, 2), 25, 95)
        stance_pct = clamp(stance_base * (1 - improve * day / 90.0) + np.random.normal(0, 1.5), 48, 80)
        swing_pct = clamp(swing_base * (1 + improve * day / 80.0) + np.random.normal(0, 1.5), 20, 48)
        symmetry_index = clamp(100 - asymmetry * 3.5 + np.random.normal(0, 1.5), 55, 99)

        # Enriched gait
        stride_time_sec = 120 / cadence
        step_time_sec = 60 / cadence
        stride_length_cm = step_length * 2
        stance_time_sec = stride_time_sec * (stance_pct / 100)
        swing_time_sec = stride_time_sec * (swing_pct / 100)
        double_support_time_sec = stride_time_sec * (double_support / 100)
        step_length_cv = clamp(random.gauss(8 - improve * day * 0.1, 1.5), 2, 15)
        step_time_cv = clamp(random.gauss(6 - improve * day * 0.08, 1.2), 1.5, 12)
        speed_cv = clamp(random.gauss(7 - improve * day * 0.09, 1.3), 2, 14)
        step_length_symmetry = clamp(100 - asymmetry * 4 + random.gauss(0, 2), 50, 100)
        stance_time_symmetry = clamp(100 - asymmetry * 3.5 + random.gauss(0, 2), 55, 100)

        affected_side = pressure_cfg["affected"]
        if affected_side == "right":
            foot_prog_left = clamp(random.gauss(10, 2), 0, 30)
            foot_prog_right = clamp(random.gauss(10 + asymmetry * 0.8, 2.5), 0, 35)
        elif affected_side == "left":
            foot_prog_left = clamp(random.gauss(10 + asymmetry * 0.8, 2.5), 0, 35)
            foot_prog_right = clamp(random.gauss(10, 2), 0, 30)
        else:
            foot_prog_left = clamp(random.gauss(10 + asymmetry * 0.3, 2), 0, 30)
            foot_prog_right = clamp(random.gauss(10 + asymmetry * 0.3, 2), 0, 30)

        # ── Plantar pressure ──
        day_improve = improve * day / 30.0
        pressure_mult = random.uniform(*pressure_cfg["mult"]) if affected_side != "none" else 1.0
        effective_mult = pressure_mult + (1.0 - pressure_mult) * (day / 30.0)
        left_pressure = {}
        right_pressure = {}
        for zone, (mean, std) in PLANTAR_ZONES.items():
            left_pressure[zone] = generate_plantar_zone(mean, std, 1.0, day_improve)
            right_pressure[zone] = generate_plantar_zone(mean, std, effective_mult, day_improve)
        left_peak_total = round(max(left_pressure.values()), 1)
        right_peak_total = round(max(right_pressure.values()), 1)
        left_avg = round(np.mean(list(left_pressure.values())), 1)
        right_avg = round(np.mean(list(right_pressure.values())), 1)
        zone_asym = {}
        for zone in PLANTAR_ZONES:
            l_val = left_pressure[zone]; r_val = right_pressure[zone]
            denom = max(l_val, r_val, 1)
            zone_asym[zone] = round(abs(l_val - r_val) / denom * 100, 1)
        metatarsal_avg_left = np.mean([left_pressure[f"metatarsal_{j}"] for j in range(1, 6)])
        metatarsal_avg_right = np.mean([right_pressure[f"metatarsal_{j}"] for j in range(1, 6)])
        arch_left = foot_arch_index(metatarsal_avg_left, left_pressure["midfoot"])
        arch_right = foot_arch_index(metatarsal_avg_right, right_pressure["midfoot"])

        # ── Activity rings ──
        move_kcal = round(clamp(random.gauss(280 + speed * 120, 50), 80, 700), 0)
        move_goal = random.choice([350, 400, 450, 500])
        exercise_min = round(clamp(random.gauss(15 + speed * 25 + improve * day * 0.5, 8), 0, 90), 0)
        exercise_goal = 30
        stand_hours = round(clamp(random.gauss(8 + speed * 4, 2), 3, 14), 0)
        stand_goal = 12
        step_count = round(clamp(random.gauss(4000 + speed * 5000, 1500), 500, 20000), 0)
        flights_climbed = round(clamp(random.gauss(5 + speed * 8, 3), 0, 40), 0)

        # ── Sleep ──
        total_sleep = round(clamp(random.gauss(7.0 - improve * day * 0.01, 1.0), 4, 10), 1)
        deep_sleep_pct = round(clamp(random.gauss(18 + improve * day * 0.1, 4), 5, 35), 1)

        # ── Nutrition ──
        protein_g = round(clamp(random.gauss(70 + speed * 20, 15), 30, 160), 0)
        water_ml = round(clamp(random.gauss(1800 + speed * 500, 400), 800, 3500), 0)

        # ── Symptoms ──
        fatigue_level = round(clamp(random.gauss(5 - improve * day * 0.08, 1.5), 0, 10), 1)
        dizziness = random.random() < 0.05

        # ── Rehabilitation (must come before vitals for coupling) ──
        completed = random.random() < (adherence_base * weekend_factor)
        accuracy = round(clamp(random.gauss(65 + improve * day * 1.8, 10), 30, 100), 1)
        pain_vas = round(clamp(pain_base * (1 - improve * day / 25.0) + np.random.normal(0, 0.6), 0, 10), 1)
        patient_rating = round(clamp(random.gauss(3.5 + improve * day * 0.8, 0.8), 1, 5), 1)

        # ── Medications taken (depends on pain) ──
        meds_today = []
        for med in prescribed:
            taken = False
            if med["type"] == "scheduled":
                prob = med["_adherence"] * (0.9 if weekend_factor < 1 else 1.0)
                taken = random.random() < prob
            else:
                if med["indication"] == "pain":
                    prob = 0.1 + (pain_vas / 10.0) * 0.8
                elif med["indication"] == "muscle spasm":
                    prob = 0.05 + (pain_vas / 10.0) * 0.6
                else:
                    prob = med["_adherence"]
                taken = random.random() < prob
            if taken:
                meds_today.append({
                    "name": med["name"], "dosage": med["dosage"], "unit": med["unit"],
                    "indication": med["indication"],
                    "time_of_day": random.choice(["morning", "noon", "evening", "night"]),
                })

        # ── Vitals with random walk + coupling ──
        # Coupling factors
        sleep_penalty = max(0, (7.0 - total_sleep) * 1.2)   # each hour below 7 adds 1.2 bpm
        pain_penalty = max(0, (pain_vas - 3) * 0.8)         # each point above 3 adds 0.8 bpm

        # Resting HR: yesterday + tiny noise - recovery trend + penalties
        resting_hr = clamp(prev_resting_hr + np.random.normal(0, 0.6) - (improve * 0.08) + sleep_penalty * 0.5 + pain_penalty * 0.5, 48, 95)
        prev_resting_hr = resting_hr

        # Walking HR: yesterday + noise + speed influence
        walking_hr = clamp(prev_walking_hr + np.random.normal(0, 1.5) + (speed - speed_base) * 10, 65, 140)
        prev_walking_hr = walking_hr

        # Blood pressure: yesterday + noise + penalties
        bp_sys = clamp(prev_bp_sys + np.random.normal(0, 1.2) + sleep_penalty * 0.8 + pain_penalty * 1.0, 90, 180)
        bp_dia = clamp(prev_bp_dia + np.random.normal(0, 0.8) + sleep_penalty * 0.5 + pain_penalty * 0.6, 55, 110)
        prev_bp_sys = bp_sys
        prev_bp_dia = bp_dia

        # Body mass: yesterday + tiny noise - slow recovery burn
        body_mass = clamp(prev_body_mass + np.random.normal(0, 0.15) - (improve * 0.03), 40, 130)
        prev_body_mass = body_mass

        # Body fat: yesterday + tiny noise - slow trend
        body_fat = clamp(prev_body_fat + np.random.normal(0, 0.1) - (improve * 0.02), 10, 50)
        prev_body_fat = body_fat

        # HRV: yesterday + noise + recovery - penalties
        hrv = clamp(prev_hrv + np.random.normal(0, 0.8) + (improve * 0.15) - sleep_penalty * 0.8 - pain_penalty * 0.6, 8, 80)
        prev_hrv = hrv

        # VO2max: update only weekly (day % 7 == 0), otherwise carry forward with tiny noise
        if day % 7 == 0:
            vo2max = clamp(prev_vo2max + (improve * 0.5) + np.random.normal(0, 0.1), 10, 50)
        else:
            vo2max = clamp(prev_vo2max + np.random.normal(0, 0.03), 10, 50)
        prev_vo2max = vo2max

        # Respiratory rate: yesterday + tiny noise + pain influence
        resp_rate = clamp(prev_resp_rate + np.random.normal(0, 0.4) + pain_penalty * 0.3, 8, 28)
        prev_resp_rate = resp_rate

        # SpO2: yesterday + tiny noise
        spo2 = clamp(prev_spo2 + np.random.normal(0, 0.3), 88, 100)
        prev_spo2 = spo2

        # Heart rate recovery (1 min): related to fitness, slight daily noise
        hrr = round(clamp(random.gauss(18 + improve * day * 0.8, 3), 5, 40), 0)

        # ── Stability ──
        steadiness = stability_classification(asymmetry, double_support, speed)
        six_min_walk = round(clamp(speed * 360 + np.random.normal(0, 15), 100, 600), 0)
        stair_up = round(clamp(0.5 + speed * 0.4 + np.random.normal(0, 0.08), 0.2, 1.5), 2)
        stair_down = round(clamp(0.4 + speed * 0.35 + np.random.normal(0, 0.07), 0.15, 1.3), 2)

        # ── Assemble daily record ──
        daily_records.append({
            "date": date.strftime("%Y-%m-%d"),
            "activity_rings": {
                "move_kcal": move_kcal, "move_goal_kcal": move_goal,
                "exercise_minutes": exercise_min, "exercise_goal_minutes": exercise_goal,
                "stand_hours": stand_hours, "stand_goal_hours": stand_goal,
                "step_count": step_count, "flights_climbed": flights_climbed,
            },
            "cardiac": {
                "hrv_ms": round(hrv, 1),
                "resting_hr_bpm": round(resting_hr, 0),
                "walking_hr_bpm": round(walking_hr, 0),
                "vo2max_ml_kg_min": round(vo2max, 1),
                "heart_rate_recovery_one_minute": hrr,
                "blood_pressure_systolic": round(bp_sys, 0),
                "blood_pressure_diastolic": round(bp_dia, 0),
            },
            "respiratory_metabolic": {
                "respiratory_rate": round(resp_rate, 0),
                "oxygen_saturation_pct": round(spo2, 0),
            },
            "body_measurements": {
                "body_mass_kg": round(body_mass, 1),
                "body_fat_percentage": round(body_fat, 1),
            },
            "gait": {
                "walking_asymmetry_pct": round(asymmetry, 2),
                "symmetry_index": round(symmetry_index, 1),
                "walking_speed_mps": round(speed, 2),
                "cadence_steps_per_min": round(cadence, 1),
                "step_length_cm": round(step_length, 1),
                "double_support_pct": round(double_support, 1),
                "stance_phase_pct": round(stance_pct, 1),
                "swing_phase_pct": round(swing_pct, 1),
                "stride_length_cm": round(stride_length_cm, 1),
                "step_time_sec": round(step_time_sec, 3),
                "stride_time_sec": round(stride_time_sec, 3),
                "stance_time_sec": round(stance_time_sec, 3),
                "swing_time_sec": round(swing_time_sec, 3),
                "double_support_time_sec": round(double_support_time_sec, 3),
                "step_length_variability_cv_pct": round(step_length_cv, 2),
                "step_time_variability_cv_pct": round(step_time_cv, 2),
                "speed_variability_cv_pct": round(speed_cv, 2),
                "step_length_symmetry_pct": round(step_length_symmetry, 1),
                "stance_time_symmetry_pct": round(stance_time_symmetry, 1),
                "foot_progression_angle_left_deg": round(foot_prog_left, 1),
                "foot_progression_angle_right_deg": round(foot_prog_right, 1),
            },
            "plantar_pressure": {
                "left_foot": left_pressure, "right_foot": right_pressure,
                "left_peak_total_kpa": left_peak_total, "right_peak_total_kpa": right_peak_total,
                "left_avg_kpa": left_avg, "right_avg_kpa": right_avg,
                "zone_asymmetry_pct": zone_asym,
                "left_arch_index": arch_left, "right_arch_index": arch_right,
            },
            "stability": {
                "walking_steadiness": steadiness,
                "six_minute_walk_distance_m": six_min_walk,
                "stair_ascent_speed_mps": stair_up,
                "stair_descent_speed_mps": stair_down,
            },
            "sleep": {"total_sleep_hours": total_sleep, "deep_sleep_pct": deep_sleep_pct},
            "nutrition": {"dietary_protein_g": protein_g, "dietary_water_ml": water_ml},
            "symptoms": {"fatigue_level": fatigue_level, "dizziness_reported": dizziness},
            "medications_taken": meds_today,
            "rehab": {
                "exercise_completed": completed,
                "exercise_accuracy_pct": accuracy,
                "pain_vas": pain_vas,
                "patient_self_rating": patient_rating,
            },
        })

    prescribed_clean = []
    for med in prescribed:
        m = {k: v for k, v in med.items() if not k.startswith("_")}
        prescribed_clean.append(m)

    patients.append({
        "patient_id": f"P{i:03d}",
        "condition": condition,
        "age": age,
        "gender": gender,
        "bmi": bmi,
        "foot_posture": cfg["foot_posture"],
        "baseline": {
            "asymmetry_pct": round(asym_base, 2),
            "walking_speed_mps": round(speed_base, 2),
            "cadence_steps_per_min": round(cadence_base, 1),
            "pain_vas": round(pain_base, 1),
        },
        "medications_prescribed": prescribed_clean,
        "daily_records": daily_records,
    })

# ──────────────────────────────────────────────
# 6. Export
# ──────────────────────────────────────────────
OUTPUT = "stepheal_patients_v5_1.json"
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(patients, f, ensure_ascii=False, indent=2)

print(f"Generated {OUTPUT}")
print(f"  Patients: {len(patients)}")
print(f"  Days per patient: {len(patients[0]['daily_records'])}")
print(f"  Total daily records: {len(patients) * len(patients[0]['daily_records'])}")