"""Rule-based FAQ matcher — fully offline, no API keys."""
TOPICS = [
    {
        "topic": "hours",
        "keywords": ["hour", "open", "close", "timing", "when", "working"],
        "answer": ("MediBook AI accepts appointment bookings 24/7 online. "
                   "Doctors see patients during their published schedules, typically "
                   "weekday mornings 09:00-13:00 and afternoons 15:00-18:00. "
                   "Check a doctor's profile for their exact availability."),
        "sample_questions": ["What are the clinic hours?", "When is the clinic open?"],
    },
    {
        "topic": "reschedule",
        "keywords": ["reschedule", "change", "move", "postpone", "new date"],
        "answer": ("You can reschedule your own appointment to another available slot "
                   "while its status is 'requested' or 'confirmed', as long as the new "
                   "slot is free and in the future."),
        "sample_questions": ["Can I reschedule my appointment?", "How do I change my appointment date?"],
    },
    {
        "topic": "booking",
        "keywords": ["book", "appointment", "schedule a visit", "reserve", "slot"],
        "answer": ("To book: create an account, find a doctor by specialty or search, "
                   "pick a date and an available slot, then confirm. Your appointment "
                   "starts with status 'requested' and is finalized once the doctor confirms."),
        "sample_questions": ["How do I book an appointment?", "How can I reserve a slot?"],
    },
    {
        "topic": "cancellation",
        "keywords": ["cancel", "cancellation", "refund"],
        "answer": ("You can cancel your own appointment from the appointments list while "
                   "its status is 'requested' or 'confirmed'. A cancelled slot immediately "
                   "becomes bookable for other patients."),
        "sample_questions": ["How do I cancel my appointment?", "Can I get a refund?"],
    },
    {
        "topic": "fees",
        "keywords": ["fee", "cost", "price", "charge", "how much"],
        "answer": ("Each doctor sets their own consultation fee, shown on their profile "
                   "before you book. Payment is handled at the clinic at the time of visit."),
        "sample_questions": ["What are the consultation fees?", "How much does a visit cost?"],
    },
    {
        "topic": "preparation",
        "keywords": ["prepare", "preparation", "bring", "before the visit", "fasting"],
        "answer": ("Bring your previous medical reports, current prescriptions, and a list "
                   "of medications. Arrive 10 minutes early. Unless the doctor tells you "
                   "otherwise, no fasting is needed for a general consultation."),
        "sample_questions": ["What should I bring to my appointment?", "How do I prepare for a visit?"],
    },
    {
        "topic": "emergency",
        "keywords": ["emergency", "urgent", "ambulance", "critical"],
        "answer": ("For emergencies (chest pain, difficulty breathing, severe bleeding, "
                   "stroke signs), do NOT book online — seek emergency care immediately "
                   "or call your local emergency number."),
        "sample_questions": ["What should I do in an emergency?", "Do you handle urgent cases?"],
    },
    {
        "topic": "prescriptions",
        "keywords": ["prescription", "medicine", "medication", "drug", "dosage"],
        "answer": ("After your consultation the doctor records your prescription in MediBook AI. "
                   "You can view your medicines, dosage, frequency and duration under Visits."),
        "sample_questions": ["Where can I see my prescription?", "Will I get medicine after the visit?"],
    },
    {
        "topic": "reports",
        "keywords": ["report", "test result", "lab", "blood test", "x-ray", "scan"],
        "answer": ("Bring existing lab reports and scans to your visit. The doctor notes "
                   "their review in your visit record, which you can revisit anytime."),
        "sample_questions": ["Should I bring my lab reports?", "Can I upload test results?"],
    },
    {
        "topic": "doctors",
        "keywords": ["doctor", "specialist", "physician"],
        "answer": ("MediBook AI lists verified doctors with their specialty, qualifications, "
                   "experience, fees, patient ratings and weekly schedules."),
        "sample_questions": ["Which doctors are available?", "Are the doctors verified?"],
    },
    {
        "topic": "specialties",
        "keywords": ["specialty", "specialities", "department", "dermatolog", "cardiolog", "neurolog"],
        "answer": ("We cover Cardiology, Dermatology, Neurology, Orthopedics, Pediatrics, "
                   "General Medicine, Ophthalmology and more. Use the triage tool to find "
                   "the right specialty for your symptoms."),
        "sample_questions": ["What specialties do you offer?", "Is there a dermatologist?"],
    },
    {
        "topic": "payment",
        "keywords": ["pay", "payment", "online pay", "upi", "card"],
        "answer": ("Consultation fees are paid at the clinic at the time of your visit. "
                   "Online payment is not required to book."),
        "sample_questions": ["How do I pay?", "Can I pay online?"],
    },
    {
        "topic": "insurance",
        "keywords": ["insurance", "claim", "coverage"],
        "answer": ("Insurance coverage depends on your provider and policy. Ask the clinic "
                   "for an itemized bill after your visit to file a claim."),
        "sample_questions": ["Do you accept insurance?", "Can I claim insurance?"],
    },
    {
        "topic": "follow_up",
        "keywords": ["follow", "follow-up", "followup", "next visit", "review"],
        "answer": ("If the doctor asks for a follow-up, simply book another appointment with "
                   "the same doctor. Your visit history stays on your account for reference."),
        "sample_questions": ["How do I book a follow-up?", "Do I need another appointment?"],
    },
    {
        "topic": "privacy",
        "keywords": ["privacy", "private", "data", "confidential", "secure"],
        "answer": ("Your account, appointments and visit records are visible only to you, "
                   "your doctors, and platform administrators. We never sell your data."),
        "sample_questions": ["Is my data private?", "Who can see my medical records?"],
    },
    {
        "topic": "account",
        "keywords": ["account", "register", "sign up", "login", "password", "profile"],
        "answer": ("Register with your name, email and password, then log in to book. "
                   "Keep your password private; you can view your profile anytime from the account page."),
        "sample_questions": ["How do I create an account?", "I forgot my password."],
    },
]

DEFAULT_TOPIC = {
    "topic": "general",
    "answer": ("I can help with questions about booking, cancellations, fees, "
               "preparation, prescriptions, doctors, and more. Could you rephrase "
               "your question?"),
}


def answer(question: str) -> dict:
    text = question.lower()
    best, best_hits = None, 0
    for topic in TOPICS:
        hits = sum(1 for kw in topic["keywords"] if kw in text)
        if hits > best_hits:
            best, best_hits = topic, hits
    if best is None:
        return {"answer": DEFAULT_TOPIC["answer"], "topic": DEFAULT_TOPIC["topic"]}
    return {"answer": best["answer"], "topic": best["topic"]}


def get_topics() -> list:
    return [{"topic": t["topic"], "sample_questions": t["sample_questions"]}
            for t in TOPICS]
