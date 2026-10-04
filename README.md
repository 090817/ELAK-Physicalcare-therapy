# **StepHeal-Loop(ELAK-Physicalcare-therapy)**

> A **data-driven closed-loop rehabilitation system** for adolescent sports rehabilitation, connecting patients, therapists, and objective health data. Through gamified incentives and clinical decision support, it improves adherence and outcomes in home-based rehabilitation training.

---

## **📖 Project Introduction**

**StepHeal-Loop** (repository name: `ELAK-Physicalcare-therapy`) is an open-source rehabilitation management platform. It aims to solve common problems in traditional rehabilitation, such as low adherence to home-based training, lack of objective data for physicians, and difficulty in quantifying rehabilitation progress.

The system collects objective data such as **gait, plantar pressure, activity energy, and heart rate variability** to generate trend reports that assist therapists in creating personalized rehabilitation plans. At the same time, it uses **gamified pose tracking** to motivate patients to complete daily training, forming a closed loop of "assessment – training – feedback – adjustment."

---

## **✨ Core Features**

### **1. Patient Side**

- **Daily rehabilitation plan**: View home training exercises, target repetitions, and sets assigned by the therapist.
- **Gamified training**: Complete exercises via pose tracking or timers, earning points, badges, and progress feedback.
- **Symptom and status tracking**: Record pain scores (VAS), fatigue, sleep, and medication intake.
- **Data synchronization**: Automatically upload activity energy, exercise minutes, heart rate, and other data from Apple Watch and similar devices.
- **Timeline view**: Display a daily timeline including wake-up, school, training, meals, and sleep, with training completion marked.

### **2. Therapist Side**

- **Patient dashboard**: View rehabilitation trajectories, adherence, pain trends, gait symmetry, etc., for all patients.
- **Trend reports**: Generate visual charts based on gait asymmetry, plantar pressure, and activity data.
- **Prescription management**: Issue medication prescriptions for each patient and record consultation notes.
- **Scheduling and appointments**: View daily consultation schedules, with a prescription field available for each time slot.
- **Risk alerts**: Identify patients with declining adherence, worsening pain, or deteriorating gait.

### **3. Gamified Rehabilitation (Physio-Quest)**

- **Pose tracking training**: Use cameras or sensors to recognize exercise completion and provide real-time feedback.
- **Tasks and rewards**: Earn experience points, badges, unlock new levels, and humorous storylines to encourage continued training.
- **Shared visits**: Patients and therapists can view training records and progress synchronously.
- **Device calendar**: Integrate wearable device data to display daily activity rings, sleep, etc.

### **4. Data Generation and Simulation (Data)**

- **Synthetic patient dataset**: Generate 30 days of rehabilitation data for 40 adolescent patients, including gait, plantar pressure, cardiac, sleep, nutrition, symptoms, and medication.
- **Chinese SOAP medical records**: Generate the most recent medical record for each patient (Subjective, Objective, Assessment, Plan).
- **Dynamic exercise metrics**: Generate clinical quantitative metrics for each rehabilitation exercise (e.g., ankle range of motion, EMG, balance time).
- **Timeline simulation**: Generate daily timelines for patients, including energy and pain levels.
- **Doctor scheduling simulation**: Generate hourly doctor schedules from September 1–30, with a prescription slot embedded in each consultation period.

---

## **🏗️ System Architecture**

text

text

```
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                            │
│  - Synthetic patient dataset (JSON)                          │
│  - Gait / plantar pressure / cardiac / sleep / nutrition /   │
│    symptoms / medication                                     │
│  - SOAP records and prescribed exercises                     │
│  - Doctor scheduling and timeline simulation                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Patient Side                             │
│  - Daily rehabilitation plan and gamified training           │
│  - Symptom tracking and device data sync                     │
│  - Timeline view                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Therapist Side                            │
│  - Patient dashboard and trend reports                       │
│  - Prescription management and consultation notes            │
│  - Scheduling and appointments                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Gamified Rehabilitation (Physio-Quest)          │
│  - Pose tracking training                                    │
│  - Tasks, rewards, shared visits                             │
│  - Device calendar                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## **📁 Directory Structure and File Descriptions**

> The following is an inferred structure based on project functionality. **Please refer to the actual repository files.**

text

text

```
ELAK-Physicalcare-therapy/
├── README.md                          # Project documentation
├── data/                              # Data generation and simulation
│   ├── deepseek_python_*.py           # Synthetic patient dataset generator (Chinese version)
│   ├── stepheal_youth_v10_zh.json     # 30-day data for 40 adolescent patients
│   ├── 青少年时间表.json               # Patient daily timeline simulation
│   └── doctor_schedule_september.json # Doctor schedule for September with prescription slots
├── patient/                           # Patient-side application
│   ├── index.html                     # Patient home page
│   ├── clinic.js                      # Rehabilitation training and data recording logic
│   ├── style.css                      # Styles
│   └── assets/                        # Images, icons, etc.
├── therapist/                         # Therapist-side application
│   ├── dashboard.html                 # Dashboard page
│   ├── dashboard.js                   # Data visualization and interaction
│   ├── dashboard.css                  # Styles
│   └── assets/
├── physio-quest/                      # Gamified rehabilitation module
│   ├── index.html                     # Game main interface
│   ├── app.js                         # Pose tracking and task logic
│   ├── quest.css                      # Styles
│   ├── shared-visit/                  # Shared visit feature
│   └── device-calendar/               # Device calendar
└── docs/                              # Documentation and design drafts
    ├── architecture.md
    └── data-dictionary.md
```

### **Detailed File Descriptions**


| **File/Directory**                    | **Description**                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data/deepseek_python_*.py`           | Generates 30 days of rehabilitation data for 40 adolescent patients, including gait, plantar pressure, cardiac, sleep, nutrition, symptoms, medication, and exercise metrics; generates Chinese SOAP records; supports missing Apple Watch data. |
| `data/stepheal_youth_v10_zh.json`     | The generated synthetic dataset. Each patient contains fields such as `patient_id`, `condition`, `daily_records`, and `latest_medical_record`.                                                                                                   |
| `data/青少年时间表.json`                    | Simulates patient daily timelines, including energy levels, pain levels, planned vs. actual training completion, and attributions (e.g., fatigue, social conflicts).                                                                             |
| `data/doctor_schedule_september.json` | Doctor schedule for September, one slot per hour. Appointment slots contain a `prescription: null` field for writing prescriptions; non-appointment slots are marked with `prescription_slot: true`.                                             |
| `patient/index.html`                  | Patient-side entry point, displaying daily rehabilitation plans, training buttons, and symptom tracking forms.                                                                                                                                   |
| `patient/clinic.js`                   | Handles training completion logic, data upload, interaction with backend APIs, and local storage.                                                                                                                                                |
| `therapist/dashboard.html`            | Therapist dashboard, displaying patient lists, trend charts, and prescription management.                                                                                                                                                        |
| `therapist/dashboard.js`              | Data visualization (Chart.js or D3), filtering, sorting, and prescription saving.                                                                                                                                                                |
| `physio-quest/index.html`             | Gamified rehabilitation main interface, including pose tracking canvas, task list, and reward display.                                                                                                                                           |
| `physio-quest/app.js`                 | Calls camera or sensors, recognizes exercises, calculates completion, and updates points and badges.                                                                                                                                             |
| `physio-quest/shared-visit/`          | Shared visit records between patient and therapist, synchronizing training data in real time.                                                                                                                                                    |
| `physio-quest/device-calendar/`       | Displays wearable device data (activity rings, sleep, heart rate) and links them to training tasks.                                                                                                                                              |


---

## **🧪 Data Format Examples**

### **Patient Daily Record (**`daily_records` **excerpt)**

json

text

```
{
  "date": "2026-09-01",
  "device_info": { "has_apple_watch": true },
  "activity_rings": {
    "move_kcal": 450,
    "exercise_minutes": 35,
    "stand_hours": 10,
    "step_count": 7500
  },
  "cardiac": {
    "hrv_ms": 55.2,
    "resting_hr_bpm": 62,
    "walking_hr_bpm": 95
  },
  "gait": {
    "walking_asymmetry_pct": 5.2,
    "walking_speed_mps": 0.65,
    "cadence_steps_per_min": 88
  },
  "plantar_pressure": {
    "left_foot": { "hallux": 120.5, "midfoot": 50.2 },
    "right_foot": { "hallux": 110.3, "midfoot": 48.7 }
  },
  "rehab": {
    "exercise_completed": true,
    "exercise_accuracy_pct": 82.0,
    "pain_vas": 3.5
  }
}
```

### **Doctor Schedule Excerpt (with prescription slot)**

json

text

```
{
  "hour": "09:00-10:00",
  "type": "appointment",
  "patient_id": "Y017",
  "appointment_type": "复诊",
  "prescription": null,
  "prescription_slot": false,
  "notes": "复诊 - 患者 Y017"
}
```

---

## **🚀 Quick Start**

### **Requirements**

- Python 3.8+
- Node.js 14+ (if running the frontend)
- Modern browser (Chrome / Edge / Safari)

### **Generate Dataset**

bash

text

```
cd data
python deepseek_python_20261003_b763d9.py
# Generate stepheal_youth_v10_zh.json
```

### **Run Patient Side**

bash

text

```
cd patient
# Use any static server, for example:
python -m http.server 8000
# Open http://localhost:8000 in your browser
```

### **Run Therapist Side**

bash

text

```
cd therapist
python -m http.server 8001
# Open http://localhost:8001/dashboard.html in your browser
```

### **Run Gamified Rehabilitation**

bash

text

```
cd physio-quest
python -m http.server 8002
# Open http://localhost:8002 in your browser
```

---

## **🛠️ Tech Stack**

- **Data generation**: Python, NumPy, JSON
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Visualization**: Chart.js / D3.js (inferred)
- **Pose tracking**: MediaPipe / TensorFlow.js (inferred)
- **Data storage**: JSON files / local storage / optional backend API
- **Wearable devices**: Apple Watch data simulation

---

## **🤝 Contributing**

Issues and Pull Requests are welcome. Please ensure:

1. Consistent code style.
2. New features come with test data or documentation.
3. Update the corresponding file descriptions in the README.

---

## **📬 Contact**

- Repository maintainer: 090817
- Project link: [https://github.com/090817/ELAK-Physicalcare-therapy](https://github.com/090817/ELAK-Physicalcare-therapy)

