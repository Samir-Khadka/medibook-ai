"""Rule-based symptom triage — fully offline, no API keys.

Hard rules:
1. EVERY response carries the informational disclaimer.
2. The urgent-keyword list forces urgency='urgent', emergency=True and prepends
   'Seek emergency care immediately. ' to the disclaimer.
3. The word 'diagnosis' is never used for the output except inside the
   disclaimer; the engine reports 'possible specialties to consult'.
"""
import json
from pathlib import Path

DATA_PATH = Path(__file__).with_name("symptoms.json")
_ENTRIES = json.loads(DATA_PATH.read_text(encoding="utf-8"))

DISCLAIMER = ("This is informational only and not a medical diagnosis. "
              "Consult a qualified doctor.")
EMERGENCY_PREFIX = "Seek emergency care immediately. "

URGENT_KEYWORDS = [
    "chest pain", "chest tightness", "difficulty breathing", "shortness of breath",
    "can't breathe", "face drooping", "slurred speech", "severe bleeding",
    "unconscious", "seizure", "stroke", "heart attack",
]

_URGENCY_RANK = {"routine": 0, "soon": 1, "urgent": 2}


def triage(symptoms: str, age=None, duration_days=None) -> dict:
    text = symptoms.lower()
    emergency = any(kw in text for kw in URGENT_KEYWORDS)

    # Collect keyword hits per specialty
    by_specialty: dict = {}
    for entry in _ENTRIES:
        matched = [kw for kw in entry["keywords"] if kw in text]
        if not matched:
            continue
        spec = entry["specialty"]
        group = by_specialty.setdefault(
            spec, {"matched": set(), "notes": [], "urgency": "routine"})
        group["matched"].update(matched)
        if entry.get("notes"):
            group["notes"].append(entry["notes"])
        if _URGENCY_RANK[entry["urgency"]] > _URGENCY_RANK[group["urgency"]]:
            group["urgency"] = entry["urgency"]

    ranked = sorted(by_specialty.items(),
                    key=lambda kv: len(kv[1]["matched"]), reverse=True)[:5]
    specialties = []
    for spec, group in ranked:
        matched = sorted(group["matched"])
        confidence = min(0.95, round(0.45 + 0.12 * len(matched), 2))
        reason = (f"Possible specialty to consult: {spec}. "
                  f"Matched symptoms: {', '.join(matched)}.")
        if group["notes"]:
            reason += f" {group['notes'][0]}"
        specialties.append({
            "specialty": spec,
            "confidence": confidence,
            "matched_symptoms": matched,
            "reason": reason,
        })

    if emergency:
        urgency = "urgent"
        is_emergency = True
    elif by_specialty:
        urgency = max((g["urgency"] for g in by_specialty.values()),
                      key=lambda u: _URGENCY_RANK[u])
        is_emergency = urgency == "urgent"
    else:
        urgency = "routine"
        is_emergency = False

    if duration_days is not None and duration_days >= 14 and urgency == "routine":
        urgency = "soon"

    disclaimer = DISCLAIMER
    if emergency:
        disclaimer = EMERGENCY_PREFIX + disclaimer

    questions = []
    if specialties:
        top = specialties[0]["specialty"]
        questions.append(
            f"Besides {', '.join(specialties[0]['matched_symptoms'][:2])}, "
            f"do you notice any other symptoms that might help a {top} doctor?")
    else:
        questions.append("Can you describe the symptoms in more detail?")
    questions.append("How long have you had these symptoms?")
    questions.append("How severe are the symptoms on a scale of 1 to 10?")
    questions.append("Do you have any existing medical conditions or take regular medication?")

    return {
        "specialties": specialties,
        "urgency": urgency,
        "emergency": is_emergency,
        "clarifying_questions": questions,
        "disclaimer": disclaimer,
    }
