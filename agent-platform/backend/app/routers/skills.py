"""Skill catalog and recommendation endpoints (pure logic, no LLM)."""
from fastapi import APIRouter

router = APIRouter()

# Curated catalog: department -> recommended skills.
SKILL_CATALOG: dict[str, list[str]] = {
    "Research": [
        "Literature Review", "Data Analysis", "Web Research", "Summarization",
        "Citation Management", "Hypothesis Testing", "Report Writing",
        "Competitive Analysis", "Survey Design", "Fact Checking",
    ],
    "Sales": [
        "Lead Qualification", "Cold Outreach", "CRM Management", "Negotiation",
        "Pipeline Management", "Objection Handling", "Account Management",
        "Proposal Writing", "Closing", "Upselling",
    ],
    "Marketing": [
        "Content Writing", "SEO", "Social Media", "Email Campaigns",
        "Brand Strategy", "Copywriting", "Analytics", "Ad Management",
        "Market Research", "Growth Hacking",
    ],
    "Engineering": [
        "Python", "System Design", "Code Review", "Debugging", "Testing",
        "API Design", "Database Design", "DevOps", "Refactoring",
        "Documentation",
    ],
    "Operations": [
        "Process Optimization", "Project Management", "Vendor Management",
        "Supply Chain", "Scheduling", "Quality Assurance", "Resource Planning",
        "Workflow Automation", "Risk Management", "Reporting",
    ],
    "Finance": [
        "Financial Modeling", "Budgeting", "Forecasting", "Accounting",
        "Financial Analysis", "Auditing", "Cash Flow Management",
        "Investment Analysis", "Tax Planning", "Compliance",
    ],
    "Support": [
        "Customer Service", "Ticket Triage", "Troubleshooting",
        "Knowledge Base Management", "Live Chat", "Escalation Handling",
        "Product Knowledge", "Empathy", "Documentation", "SLA Management",
    ],
    "Design": [
        "UI Design", "UX Research", "Prototyping", "Visual Design",
        "Design Systems", "Wireframing", "Typography", "Interaction Design",
        "Branding", "Accessibility",
    ],
    "Legal": [
        "Contract Review", "Compliance", "Legal Research", "Risk Assessment",
        "Policy Drafting", "Intellectual Property", "Negotiation",
        "Regulatory Analysis", "Due Diligence", "Dispute Resolution",
    ],
    "Data": [
        "SQL", "Data Visualization", "Machine Learning", "ETL",
        "Statistical Analysis", "Data Cleaning", "Python", "Dashboarding",
        "Predictive Modeling", "Big Data",
    ],
}

# Fallback set for unmatched departments.
GENERAL_SKILLS: list[str] = [
    "Communication", "Problem Solving", "Research", "Writing",
    "Analysis", "Project Management", "Collaboration", "Time Management",
]


def _match_department(department: str | None) -> str | None:
    if not department:
        return None
    dept_lower = department.strip().lower()
    for key in SKILL_CATALOG:
        if key.lower() == dept_lower:
            return key
    # partial contains match
    for key in SKILL_CATALOG:
        if dept_lower in key.lower() or key.lower() in dept_lower:
            return key
    return None


@router.get("/skills/catalog")
async def skills_catalog():
    return {
        "departments": [
            {"department": dept, "skills": skills}
            for dept, skills in SKILL_CATALOG.items()
        ]
    }


@router.get("/skills/recommend")
async def skills_recommend(department: str | None = None, title: str | None = None):
    matched = _match_department(department)
    if matched:
        recommended = list(SKILL_CATALOG[matched])
    else:
        recommended = list(GENERAL_SKILLS)

    # Lightly augment based on title keywords.
    if title:
        title_lower = title.lower()
        for dept, skills in SKILL_CATALOG.items():
            if dept.lower() in title_lower:
                for s in skills:
                    if s not in recommended:
                        recommended.append(s)
        # keyword -> skill augmentation
        keyword_map = {
            "engineer": "Python", "developer": "Debugging", "data": "SQL",
            "design": "UI Design", "market": "SEO", "sales": "Negotiation",
            "finance": "Financial Modeling", "legal": "Contract Review",
            "support": "Customer Service", "research": "Web Research",
        }
        for kw, skill in keyword_map.items():
            if kw in title_lower and skill not in recommended:
                recommended.append(skill)

    return {"recommended": recommended}
