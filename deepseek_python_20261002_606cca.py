import json
import random
import numpy as np
from datetime import datetime, timedelta

random.seed(42)
np.random.seed(42)

# 病症配置：基线步态参数、锻炼依从性倾向、疼痛水平
conditions = {
    "Post knee replacement": {
        "asymmetry": (4.5, 7.0),      # 初始不对称百分比
        "double_support": (32, 38),   # 双支撑时间 %
        "speed": (0.55, 0.75),        # 步速 m/s
        "left_peak": (180, 230),      # 左脚踏压力 kPa
        "right_peak": (140, 190),     # 右脚踏压力 kPa（患侧较低）
        "pain": (4, 7),
        "adherence": (0.6, 0.9),
        "improve_rate": 0.08          # 每天改善幅度
    },
    "Stroke hemiparesis": {
        "asymmetry": (5.0, 8.5),
        "double_support": (35, 42),
        "speed": (0.45, 0.65),
        "left_peak": (150, 200),
        "right_peak": (120, 170),
        "pain": (3, 6),
        "adherence": (0.3, 0.7),
        "improve_rate": 0.04
    },
    "Parkinson disease": {
        "asymmetry": (3.0, 5.5),
        "double_support": (30, 36),
        "speed": (0.60, 0.80),
        "left_peak": (170, 210),
        "right_peak": (165, 205),
        "pain": (2, 5),
        "adherence": (0.4, 0.8),
        "improve_rate": 0.03
    },
    "Chronic low back pain": {
        "asymmetry": (2.0, 4.0),
        "double_support": (26, 32),
        "speed": (0.70, 0.90),
        "left_peak": (190, 230),
        "right_peak": (185, 225),
        "pain": (5, 8),
        "adherence": (0.5, 0.85),
        "improve_rate": 0.05
    },
    "Healthy older adult": {
        "asymmetry": (0.8, 2.0),
        "double_support": (28, 34),
        "speed": (0.90, 1.10),
        "left_peak": (200, 240),
        "right_peak": (195, 235),
        "pain": (0, 2),
        "adherence": (0.7, 0.95),
        "improve_rate": 0.01
    }
}

# 随机生成 50 名患者
patients = []
start_date = datetime(2026, 9, 1)  # 30 天数据，从 9 月 1 日到 9 月 30 日

for i in range(1, 51):
    condition = random.choice(list(conditions.keys()))
    cfg = conditions[condition]
    age = random.randint(35, 85) if condition != "Healthy older adult" else random.randint(65, 85)
    gender = random.choice(["male", "female"])
    bmi = round(random.uniform(18.5, 32.0), 1)
    
    # 初始基线
    asym_base = random.uniform(*cfg["asymmetry"])
    ds_base = random.uniform(*cfg["double_support"])
    speed_base = random.uniform(*cfg["speed"])
    left_peak_base = random.uniform(*cfg["left_peak"])
    right_peak_base = random.uniform(*cfg["right_peak"])
    pain_base = random.uniform(*cfg["pain"])
    adherence_base = random.uniform(*cfg["adherence"])
    improve = cfg["improve_rate"]
    
    daily_records = []
    for day in range(30):
        date = start_date + timedelta(days=day)
        # 趋势：改善 + 随机波动 + 周末效应（周末依从性略低）
        trend = 1 - improve * day / 30.0
        noise = np.random.normal(0, 0.03)
        weekend = 0.9 if date.weekday() >= 5 else 1.0
        
        asymmetry = max(0.5, asym_base * trend + noise * asym_base)
        double_support = max(15, ds_base * (1 - improve * day / 60.0) + np.random.normal(0, 1.2))
        speed = max(0.3, speed_base * (1 + improve * day / 25.0) + np.random.normal(0, 0.05))
        left_peak = max(80, left_peak_base * (1 + improve * day / 30.0) + np.random.normal(0, 8))
        right_peak = max(80, right_peak_base * (1 + improve * day / 20.0) + np.random.normal(0, 8))
        pain = max(0, pain_base * (1 - improve * day / 20.0) + np.random.normal(0, 0.8))
        
        # 锻炼完成：依从性 + 周末下降 + 随机
        completed = random.random() < (adherence_base * weekend)
        accuracy = max(40, min(100, 70 + improve * day * 1.5 + np.random.normal(0, 12)))
        
        daily_records.append({
            "date": date.strftime("%Y-%m-%d"),
            "walking_asymmetry_percent": round(asymmetry, 2),
            "double_support_percent": round(double_support, 1),
            "walking_speed_mps": round(speed, 2),
            "left_peak_pressure_kpa": round(left_peak, 1),
            "right_peak_pressure_kpa": round(right_peak, 1),
            "exercise_completed": completed,
            "exercise_accuracy_percent": round(accuracy, 1),
            "pain_vas": round(pain, 1)
        })
    
    patients.append({
        "patient_id": f"P{i:03d}",
        "condition": condition,
        "age": age,
        "gender": gender,
        "bmi": bmi,
        "baseline_asymmetry": round(asym_base, 2),
        "baseline_speed": round(speed_base, 2),
        "daily_records": daily_records
    })

# 保存为 JSON
with open("stepheal_patients.json", "w", encoding="utf-8") as f:
    json.dump(patients, f, ensure_ascii=False, indent=2)

print("已生成 stepheal_patients.json，包含 50 名患者、每人 30 天数据。")