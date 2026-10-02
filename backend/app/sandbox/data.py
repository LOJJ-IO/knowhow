"""Acme, as fixtures. The seed (`seed.py`) writes these into the database and
the sandbox Drive (`drive.py`) serves the files that never become company
records (the owner's unsorted Drive, proposals, suggested shares).

Times are "days ago" relative to the moment of seeding, so the sandbox always
looks current."""

from dataclasses import dataclass

DOC = "application/vnd.google-apps.document"
SHEET = "application/vnd.google-apps.spreadsheet"
SLIDES = "application/vnd.google-apps.presentation"
PDF = "application/pdf"

ORG_NAME = "Acme"


@dataclass(frozen=True)
class Person:
    key: str
    name: str
    email: str
    # Team key, or None for the owner (org-wide).
    team: str | None
    lead: bool = False
    # A contractor on a personal Google account.
    personal: bool = False
    joined_days_ago: int = 120


# The account the sandbox signs you in as.
OWNER_KEY = "alex"

PEOPLE: list[Person] = [
    Person("alex", "Alex Morgan", "alex@acme.com", None, joined_days_ago=400),
    # Engineering
    Person("marcus", "Marcus Chen", "marcus@acme.com", "eng", lead=True, joined_days_ago=380),
    Person("sofia", "Sofia Rossi", "sofia@acme.com", "eng", joined_days_ago=300),
    Person("ethan", "Ethan Brooks", "ethan@acme.com", "eng", joined_days_ago=260),
    Person("aisha", "Aisha Bello", "aisha@acme.com", "eng", joined_days_ago=200),
    Person("lucas", "Lucas Martin", "lucas@acme.com", "eng", joined_days_ago=90),
    Person("nora", "Nora Lindqvist", "nora@acme.com", "eng", joined_days_ago=2),
    # Design
    Person("maya", "Maya Patel", "maya@acme.com", "design", lead=True, joined_days_ago=350),
    Person("leo", "Leo Tanaka", "leo@acme.com", "design", joined_days_ago=240),
    Person("grace", "Grace Okafor", "grace@acme.com", "design", joined_days_ago=150),
    Person("riley", "Riley Quinn", "riley.quinn.design@gmail.com", "design", personal=True, joined_days_ago=60),
    # Marketing
    Person("olivia", "Olivia Turner", "olivia@acme.com", "marketing", lead=True, joined_days_ago=330),
    Person("jamal", "Jamal Wright", "jamal@acme.com", "marketing", joined_days_ago=210),
    Person("hannah", "Hannah Becker", "hannah@acme.com", "marketing", joined_days_ago=120),
    Person("chloe", "Chloe Dubois", "chloe@acme.com", "marketing", joined_days_ago=5),
    # Sales
    Person("ben", "Ben Carter", "ben@acme.com", "sales", lead=True, joined_days_ago=360),
    Person("isabella", "Isabella Garcia", "isabella@acme.com", "sales", joined_days_ago=280),
    Person("noah", "Noah Williams", "noah@acme.com", "sales", joined_days_ago=190),
    Person("zoe", "Zoe Adams", "zoe@acme.com", "sales", joined_days_ago=100),
    # Customer Success
    Person("priya", "Priya Shah", "priya@acme.com", "cs", lead=True, joined_days_ago=340),
    Person("owen", "Owen Hughes", "owen@acme.com", "cs", joined_days_ago=230),
    Person("mia", "Mia Johansson", "mia@acme.com", "cs", joined_days_ago=0),
    # Finance
    Person("daniel", "Daniel Kim", "daniel@acme.com", "finance", lead=True, joined_days_ago=370),
    Person("tom", "Tom Nguyen", "tom@acme.com", "finance", joined_days_ago=250),
    Person("elena", "Elena Petrova", "elena@acme.com", "finance", joined_days_ago=140),
]

# Left the company; already offboarded (files went to Ben). Kept as a member
# row so history can name them, but on no team.
FORMER = [Person("sam", "Sam Patel", "sam@acme.com", None, joined_days_ago=420)]

# Signed in and asked to join a team; waiting on its lead.
JOINERS = [
    (Person("ava", "Ava Thompson", "ava@acme.com", None, joined_days_ago=1), "marketing"),
    (Person("kai", "Kai Nakamura", "kai@acme.com", None, joined_days_ago=0), "eng"),
]

TEAMS: list[tuple[str, str]] = [
    ("eng", "Engineering"),
    ("design", "Design"),
    ("marketing", "Marketing"),
    ("sales", "Sales"),
    ("cs", "Customer Success"),
    ("finance", "Finance"),
]


@dataclass(frozen=True)
class FileSpec:
    title: str
    mime: str
    owner: str
    modified_days_ago: float
    # Team folder it's filed in; None = the owner's org-wide work.
    team: str | None
    private: bool = False
    # Words Drive's full-text search would find inside it.
    content: str = ""
    # Extra custom folders (by name) it also sits in.
    folders: tuple[str, ...] = ()


# Company files: indexed, foldered, searchable.
FILES: list[FileSpec] = [
    # Owner
    FileSpec("Company OKRs Q4", SLIDES, "alex", 3, None, content="objectives key results revenue retention", folders=("Board meetings",)),
    FileSpec("All-hands deck October", SLIDES, "alex", 6, None, content="all hands roadmap hiring wins"),
    FileSpec("Investor update September", DOC, "alex", 21, None, content="investors arr burn runway", folders=("Board meetings",)),
    FileSpec("Org design 2026", DOC, "alex", 12, None, private=True, content="org chart reporting lines hiring plan"),
    # Engineering
    FileSpec("Platform architecture 2026", DOC, "marcus", 4, "eng", content="services kubernetes postgres queue api gateway"),
    FileSpec("API v3 migration plan", DOC, "sofia", 1.5, "eng", content="api versioning deprecation customers timeline"),
    FileSpec("Incident postmortem: Sept 14 outage", DOC, "ethan", 15, "eng", content="outage database failover root cause action items"),
    FileSpec("On-call rotation Q4", SHEET, "aisha", 8, "eng", content="on call pager schedule"),
    FileSpec("Sprint 42 planning", DOC, "lucas", 0.3, "eng", content="sprint backlog estimates"),
    FileSpec("Security review checklist", DOC, "ethan", 30, "eng", content="security soc2 access review encryption"),
    FileSpec("Hiring rubric: Senior backend engineer", DOC, "marcus", 25, "eng", private=True, content="interview rubric hiring"),
    FileSpec("Engineering roadmap H2", SLIDES, "marcus", 9, "eng", content="roadmap platform mobile reliability"),
    FileSpec("Load test results (Oct)", SHEET, "aisha", 5, "eng", content="latency throughput p99"),
    FileSpec("Mobile app release notes 4.2", DOC, "sofia", 2, "eng", content="release notes mobile ios android", folders=("Q4 launch",)),
    FileSpec("Tech debt register", SHEET, "ethan", 40, "eng", content="tech debt refactor"),
    # Design
    FileSpec("Brand guidelines 2026", SLIDES, "maya", 10, "design", content="brand logo colour typography voice"),
    FileSpec("Design system tokens", SHEET, "leo", 3, "design", content="tokens colour spacing radius"),
    FileSpec("Homepage redesign brief", DOC, "maya", 7, "design", content="homepage redesign hero conversion"),
    FileSpec("Onboarding flow audit", SLIDES, "grace", 14, "design", content="onboarding friction drop off"),
    FileSpec("User research synthesis: SMB owners", DOC, "grace", 18, "design", content="interviews research smb pain points"),
    FileSpec("Icon set v2 spec", DOC, "riley", 6, "design", content="icons spec"),
    FileSpec("Pricing page wireframes", PDF, "riley", 4, "design", content="pricing wireframes plans", folders=("Q4 launch",)),
    FileSpec("Accessibility audit Q3", DOC, "leo", 22, "design", content="accessibility wcag contrast"),
    FileSpec("Q4 campaign moodboard", SLIDES, "maya", 2, "design", content="campaign moodboard photography", folders=("Q4 launch",)),
    # Marketing
    FileSpec("Q4 launch plan", DOC, "olivia", 1, "marketing", content="launch plan channels timeline budget", folders=("Q4 launch",)),
    FileSpec("Content calendar October", SHEET, "hannah", 2, "marketing", content="blog posts newsletter schedule"),
    FileSpec("Brand campaign budget", SHEET, "olivia", 11, "marketing", content="budget paid media spend"),
    FileSpec("Website traffic report Sept", SHEET, "jamal", 16, "marketing", content="traffic sessions conversion seo"),
    FileSpec("Webinar run of show", DOC, "hannah", 5, "marketing", content="webinar speakers agenda", folders=("Q4 launch",)),
    FileSpec("Press release: Series B", DOC, "olivia", 20, "marketing", content="press release funding series b investors", folders=("Q4 launch",)),
    FileSpec("Competitor messaging map", SLIDES, "jamal", 27, "marketing", content="competitors positioning messaging"),
    FileSpec("Customer story: Northwind", DOC, "chloe", 3, "marketing", content="case study northwind results"),
    FileSpec("Social media guidelines", DOC, "jamal", 45, "marketing", content="social linkedin tone"),
    # Sales
    FileSpec("Q4 pipeline review", SHEET, "ben", 0.5, "sales", content="pipeline forecast deals stage"),
    FileSpec("Enterprise pricing sheet", SHEET, "ben", 13, "sales", content="pricing enterprise seats discount"),
    FileSpec("Sales playbook 2026", DOC, "ben", 19, "sales", content="playbook discovery objections"),
    FileSpec("Northwind proposal", DOC, "isabella", 2, "sales", content="proposal northwind enterprise contract"),
    FileSpec("Contoso renewal deck", SLIDES, "noah", 6, "sales", content="contoso renewal expansion"),
    FileSpec("Territory plan West", SHEET, "zoe", 17, "sales", content="territory accounts west"),
    FileSpec("Discount approval matrix", SHEET, "ben", 33, "sales", content="discount approval"),
    FileSpec("Win-loss analysis Q3", SLIDES, "isabella", 9, "sales", content="win loss competitors reasons"),
    FileSpec("Demo script v5", DOC, "noah", 4, "sales", content="demo script talk track"),
    FileSpec("Commission plan FY26", SHEET, "ben", 24, "sales", private=True, content="commission quota accelerators"),
    # Customer Success
    FileSpec("Onboarding checklist for new accounts", DOC, "priya", 8, "cs", content="onboarding kickoff checklist"),
    FileSpec("Churn risk tracker", SHEET, "owen", 1, "cs", content="churn risk accounts health"),
    FileSpec("QBR template", SLIDES, "priya", 29, "cs", content="quarterly business review template"),
    FileSpec("Support macros", DOC, "owen", 36, "cs", content="support replies macros"),
    FileSpec("Customer health scores", SHEET, "priya", 3, "cs", content="health score usage nps"),
    FileSpec("Escalation runbook", DOC, "owen", 12, "cs", content="escalation severity runbook"),
    FileSpec("NPS survey results Q3", SLIDES, "priya", 18, "cs", content="nps survey promoters detractors"),
    # Finance
    FileSpec("FY26 budget", SHEET, "daniel", 2, "finance", content="budget headcount opex"),
    FileSpec("Board deck October", SLIDES, "daniel", 4, "finance", content="board metrics arr burn", folders=("Board meetings",)),
    FileSpec("Cash flow forecast", SHEET, "tom", 6, "finance", content="cash flow forecast runway"),
    FileSpec("Vendor contracts tracker", SHEET, "elena", 15, "finance", content="vendors contracts renewals"),
    FileSpec("Expense policy", DOC, "elena", 60, "finance", content="expenses travel reimbursement policy"),
    FileSpec("Q3 financial statements", PDF, "tom", 26, "finance", content="income statement balance sheet", folders=("Board meetings",)),
    FileSpec("Headcount plan 2026", SHEET, "daniel", 10, "finance", private=True, content="headcount hiring plan"),
    FileSpec("Audit prep checklist", DOC, "tom", 31, "finance", content="audit prep controls"),
]

CUSTOM_FOLDERS = ["Q4 launch", "Board meetings"]

# Files the previous sales rep owned; moved to Ben when they were offboarded.
FORMER_FILES = [
    FileSpec("Fabrikam account plan", DOC, "ben", 9, "sales", content="fabrikam account plan"),
    FileSpec("Q3 forecast (Sam)", SHEET, "ben", 9, "sales", content="forecast q3"),
]


@dataclass(frozen=True)
class DriveFile:
    """A file that lives only in someone's Drive (not a company record yet)."""

    key: str
    title: str
    mime: str
    owner: str
    modified_days_ago: float
    # Who it's shared with, by person key.
    shared_with: tuple[str, ...] = ()
    content: str = ""


# Alex's own Drive, waiting for the librarian ("Sort 6").
OWNER_UNSORTED: list[DriveFile] = [
    DriveFile("lisbon", "Offsite planning: Lisbon", DOC, "alex", 1, ("priya", "daniel", "marcus"), "offsite agenda travel"),
    DriveFile("northwind-dinner", "Notes from Northwind exec dinner", DOC, "alex", 2, ("ben",), "northwind notes"),
    DriveFile("ceo-letter", "Draft: CEO letter 2026", DOC, "alex", 4, (), "letter strategy"),
    DriveFile("vp-marketing", "Recruiting pipeline: VP Marketing", SHEET, "alex", 5, ("olivia", "priya"), "recruiting candidates"),
    DriveFile("partnerships", "Partnership ideas", DOC, "alex", 8, ("ben", "olivia"), "partners channel"),
    DriveFile("pricing-experiments", "Pricing experiments 2026", SHEET, "alex", 11, ("ben", "daniel"), "pricing experiments"),
]

# Put forward as company work by people on Alex's teams; Alex confirms.
PROPOSALS: list[DriveFile] = [
    DriveFile("eng-offsite", "Engineering offsite agenda", DOC, "marcus", 1, ("sofia", "ethan"), "offsite agenda"),
    DriveFile("influencers", "Influencer shortlist", SHEET, "olivia", 2, ("jamal", "hannah"), "influencers"),
    DriveFile("contoso-notes", "Contoso negotiation notes", DOC, "ben", 3, ("noah",), "contoso negotiation"),
]

# Made outside Knohow by Alex; Knohow suggests sharing them.
SUGGESTED: list[tuple[DriveFile, tuple[str, ...]]] = [
    (DriveFile("hiring-plan-q4", "Q4 hiring plan", SHEET, "alex", 1, (), "hiring plan"), ("priya", "daniel", "marcus")),
    (DriveFile("pricing-memo", "Pricing change memo", DOC, "alex", 2, (), "pricing memo"), ("ben", "daniel")),
    (DriveFile("roadmap-notes", "Roadmap review notes", DOC, "alex", 4, (), "roadmap"), ("marcus", "maya")),
]

ALL_DRIVE_FILES: list[DriveFile] = OWNER_UNSORTED + PROPOSALS + [f for f, _ in SUGGESTED]


def drive_file_id(key: str) -> str:
    return f"acme-drive-{key}"

