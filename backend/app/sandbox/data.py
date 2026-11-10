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
OWNER_KEY = "david"

PEOPLE: list[Person] = [
    Person("david", "David Bradshaw", "david@acme.com", None, joined_days_ago=400),
    # Leadership
    Person("bongani", "Bongani Makoni", "bongani@acme.com", "leadership", lead=True, joined_days_ago=380),
    Person("wunmi", "Wunmi Idowu", "wunmi@acme.com", "leadership", joined_days_ago=300),
    Person("dennis", "Dennis Agbegha", "dennis@acme.com", "leadership", joined_days_ago=260),
    Person("morakinyo", "Morakinyo Okusami", "morakinyo@acme.com", "leadership", joined_days_ago=200),
    Person("annette", "Annette Massiah", "annette@acme.com", "leadership", joined_days_ago=90),
    Person("charmaine", "Charmaine Shorrock", "charmaine@acme.com", "leadership", joined_days_ago=2),
    # Board
    Person("sandra", "Sandra Ryan-Robinson", "sandra@acme.com", "board", lead=True, joined_days_ago=360),
    Person("seyi", "Seyi Ballam", "seyi@acme.com", "board", joined_days_ago=280),
    Person("pat", "Pat White", "pat@acme.com", "board", joined_days_ago=190),
    Person("kene", "Kene Ilochonwu", "kene@acme.com", "board", joined_days_ago=100),
    Person("michael", "Michael Lee Hing", "michael@acme.com", "board", joined_days_ago=330),
    Person("clarence", "Clarence Wynter", "clarence@acme.com", "board", joined_days_ago=210),
    Person("taiwo", "Taiwo Ogunsina", "taiwo@acme.com", "board", joined_days_ago=120),
    Person("moussa", "Dr. Moussa Magassa", "moussa@acme.com", "board", joined_days_ago=5),
    Person("omar", "Omar Rehman", "omar@acme.com", "board", joined_days_ago=370),
    Person("akins", "Michael Akins", "akins@acme.com", "board", joined_days_ago=250),
    # Guidance
    Person("jon", "Jon Cornish", "jon@acme.com", "guidance", lead=True, joined_days_ago=350),
    Person("kiran", "Kiran Seetal", "kiran@acme.com", "guidance", joined_days_ago=240),
    Person("chi", "Chi Iliya-Ndule", "chi@acme.com", "guidance", joined_days_ago=150),
    Person("charles", "Charles Buchanan", "charles.buchanan@gmail.com", "guidance", personal=True, joined_days_ago=60),
    Person("akwasi", "Akwasi Antwi", "akwasi@acme.com", "guidance", joined_days_ago=340),
    Person("chucks", "Chucks Okafor", "chucks@acme.com", "guidance", joined_days_ago=230),
    Person("brian", "Brian Lanier", "brian@acme.com", "guidance", joined_days_ago=0),
]

# Left the company; already offboarded (files went to Sandra). Kept as a member
# row so history can name them, but on no team.
FORMER = [Person("sam", "Sam Patel", "sam@acme.com", None, joined_days_ago=420)]

# Signed in and asked to join a team; waiting on its lead.
JOINERS = [
    (Person("ava", "Ava Thompson", "ava@acme.com", None, joined_days_ago=1), "board"),
    (Person("kai", "Kai Nakamura", "kai@acme.com", None, joined_days_ago=0), "leadership"),
]

TEAMS: list[tuple[str, str]] = [
    ("leadership", "Leadership"),
    ("board", "Board"),
    ("guidance", "Guidance"),
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
    FileSpec("Company OKRs Q4", SLIDES, "david", 3, None, content="objectives key results revenue retention", folders=("Impact",)),
    FileSpec("All-hands deck October", SLIDES, "david", 6, None, content="all hands roadmap hiring wins"),
    FileSpec("Investor update September", DOC, "david", 21, None, content="investors arr burn runway", folders=("Impact",)),
    FileSpec("Org design 2026", DOC, "david", 12, None, private=True, content="org chart reporting lines hiring plan"),
    # Engineering
    FileSpec("Platform architecture 2026", DOC, "bongani", 4, "leadership", content="services kubernetes postgres queue api gateway"),
    FileSpec("API v3 migration plan", DOC, "wunmi", 1.5, "leadership", content="api versioning deprecation customers timeline"),
    FileSpec("Incident postmortem: Sept 14 outage", DOC, "dennis", 15, "leadership", content="outage database failover root cause action items"),
    FileSpec("On-call rotation Q4", SHEET, "morakinyo", 8, "leadership", content="on call pager schedule", folders=("Fellowship",)),
    FileSpec("Sprint 42 planning", DOC, "annette", 0.3, "leadership", content="sprint backlog estimates", folders=("Mentorship",)),
    FileSpec("Security review checklist", DOC, "dennis", 30, "leadership", content="security soc2 access review encryption"),
    FileSpec("Hiring rubric: Senior backend engineer", DOC, "bongani", 25, "leadership", private=True, content="interview rubric hiring", folders=("Fellowship",)),
    FileSpec("Engineering roadmap H2", SLIDES, "bongani", 9, "leadership", content="roadmap platform mobile reliability", folders=("Fellowship",)),
    FileSpec("Load test results (Oct)", SHEET, "morakinyo", 5, "leadership", content="latency throughput p99"),
    FileSpec("Mobile app release notes 4.2", DOC, "wunmi", 2, "leadership", content="release notes mobile ios android"),
    FileSpec("Tech debt register", SHEET, "dennis", 40, "leadership", content="tech debt refactor"),
    # Design
    FileSpec("Brand guidelines 2026", SLIDES, "jon", 10, "guidance", content="brand logo colour typography voice"),
    FileSpec("Design system tokens", SHEET, "kiran", 3, "guidance", content="tokens colour spacing radius"),
    FileSpec("Homepage redesign brief", DOC, "jon", 7, "guidance", content="homepage redesign hero conversion"),
    FileSpec("Onboarding flow audit", SLIDES, "chi", 14, "guidance", content="onboarding friction drop off"),
    FileSpec("User research synthesis: SMB owners", DOC, "chi", 18, "guidance", content="interviews research smb pain points"),
    FileSpec("Icon set v2 spec", DOC, "charles", 6, "guidance", content="icons spec"),
    FileSpec("Pricing page wireframes", PDF, "charles", 4, "guidance", content="pricing wireframes plans"),
    FileSpec("Accessibility audit Q3", DOC, "kiran", 22, "guidance", content="accessibility wcag contrast"),
    FileSpec("Q4 campaign moodboard", SLIDES, "jon", 2, "guidance", content="campaign moodboard photography", folders=("BHM dinner",)),
    # Marketing
    FileSpec("Q4 launch plan", DOC, "michael", 1, "board", content="launch plan channels timeline budget", folders=("BHM dinner",)),
    FileSpec("Content calendar October", SHEET, "taiwo", 2, "board", content="blog posts newsletter schedule"),
    FileSpec("Brand campaign budget", SHEET, "michael", 11, "board", content="budget paid media spend"),
    FileSpec("Website traffic report Sept", SHEET, "clarence", 16, "board", content="traffic sessions conversion seo"),
    FileSpec("Webinar run of show", DOC, "taiwo", 5, "board", content="webinar speakers agenda", folders=("BHM dinner",)),
    FileSpec("Press release: Series B", DOC, "michael", 20, "board", content="press release funding series b investors", folders=("BHM dinner",)),
    FileSpec("Competitor messaging map", SLIDES, "clarence", 27, "board", content="competitors positioning messaging"),
    FileSpec("Customer story: Northwind", DOC, "moussa", 3, "board", content="case study northwind results"),
    FileSpec("Social media guidelines", DOC, "clarence", 45, "board", content="social linkedin tone"),
    # Sales
    FileSpec("Q4 pipeline review", SHEET, "sandra", 0.5, "board", content="pipeline forecast deals stage"),
    FileSpec("Enterprise pricing sheet", SHEET, "sandra", 13, "board", content="pricing enterprise seats discount"),
    FileSpec("Sales playbook 2026", DOC, "sandra", 19, "board", content="playbook discovery objections"),
    FileSpec("Northwind proposal", DOC, "seyi", 2, "board", content="proposal northwind enterprise contract"),
    FileSpec("Contoso renewal deck", SLIDES, "pat", 6, "board", content="contoso renewal expansion"),
    FileSpec("Territory plan West", SHEET, "kene", 17, "board", content="territory accounts west"),
    FileSpec("Discount approval matrix", SHEET, "sandra", 33, "board", content="discount approval"),
    FileSpec("Win-loss analysis Q3", SLIDES, "seyi", 9, "board", content="win loss competitors reasons"),
    FileSpec("Demo script v5", DOC, "pat", 4, "board", content="demo script talk track"),
    FileSpec("Commission plan FY26", SHEET, "sandra", 24, "board", private=True, content="commission quota accelerators"),
    # Customer Success
    FileSpec("Onboarding checklist for new accounts", DOC, "akwasi", 8, "guidance", content="onboarding kickoff checklist", folders=("Mentorship",)),
    FileSpec("Churn risk tracker", SHEET, "chucks", 1, "guidance", content="churn risk accounts health"),
    FileSpec("QBR template", SLIDES, "akwasi", 29, "guidance", content="quarterly business review template"),
    FileSpec("Support macros", DOC, "chucks", 36, "guidance", content="support replies macros"),
    FileSpec("Customer health scores", SHEET, "akwasi", 3, "guidance", content="health score usage nps"),
    FileSpec("Escalation runbook", DOC, "chucks", 12, "guidance", content="escalation severity runbook", folders=("Mentorship",)),
    FileSpec("NPS survey results Q3", SLIDES, "akwasi", 18, "guidance", content="nps survey promoters detractors", folders=("Impact",)),
    # Finance
    FileSpec("FY26 budget", SHEET, "omar", 2, "board", content="budget headcount opex", folders=("Scholarship",)),
    FileSpec("Board deck October", SLIDES, "omar", 4, "board", content="board metrics arr burn", folders=("Impact",)),
    FileSpec("Cash flow forecast", SHEET, "akins", 6, "board", content="cash flow forecast runway"),
    FileSpec("Vendor contracts tracker", SHEET, "seyi", 15, "board", content="vendors contracts renewals"),
    FileSpec("Expense policy", DOC, "seyi", 60, "board", content="expenses travel reimbursement policy", folders=("Scholarship",)),
    FileSpec("Q3 financial statements", PDF, "akins", 26, "board", content="income statement balance sheet", folders=("Impact",)),
    FileSpec("Headcount plan 2026", SHEET, "omar", 10, "board", private=True, content="headcount hiring plan"),
    FileSpec("Audit prep checklist", DOC, "akins", 31, "board", content="audit prep controls", folders=("Scholarship",)),
]

CUSTOM_FOLDERS = ["BHM dinner", "Mentorship", "Scholarship", "Fellowship", "Impact"]

# Files the previous member owned; moved to Sandra when they were offboarded.
FORMER_FILES = [
    FileSpec("Fabrikam account plan", DOC, "sandra", 9, "board", content="fabrikam account plan"),
    FileSpec("Q3 forecast (Sam)", SHEET, "sandra", 9, "board", content="forecast q3"),
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


# David's own Drive, waiting for the librarian ("Sort 6").
OWNER_UNSORTED: list[DriveFile] = [
    DriveFile("lisbon", "Offsite planning: Lisbon", DOC, "david", 1, ("akwasi", "omar", "bongani"), "offsite agenda travel"),
    DriveFile("northwind-dinner", "Notes from Northwind exec dinner", DOC, "david", 2, ("sandra",), "northwind notes"),
    DriveFile("ceo-letter", "Draft: CEO letter 2026", DOC, "david", 4, (), "letter strategy"),
    DriveFile("vp-marketing", "Recruiting pipeline: VP Marketing", SHEET, "david", 5, ("michael", "akwasi"), "recruiting candidates"),
    DriveFile("partnerships", "Partnership ideas", DOC, "david", 8, ("sandra", "michael"), "partners channel"),
    DriveFile("pricing-experiments", "Pricing experiments 2026", SHEET, "david", 11, ("sandra", "omar"), "pricing experiments"),
]

# Put forward as company work by people on David's teams; David confirms.
PROPOSALS: list[DriveFile] = [
    DriveFile("eng-offsite", "Engineering offsite agenda", DOC, "bongani", 1, ("wunmi", "dennis"), "offsite agenda"),
    DriveFile("influencers", "Influencer shortlist", SHEET, "michael", 2, ("clarence", "taiwo"), "influencers"),
    DriveFile("contoso-notes", "Contoso negotiation notes", DOC, "sandra", 3, ("pat",), "contoso negotiation"),
]

# Made outside Knohow by David; Knohow suggests sharing them.
SUGGESTED: list[tuple[DriveFile, tuple[str, ...]]] = [
    (DriveFile("hiring-plan-q4", "Q4 hiring plan", SHEET, "david", 1, (), "hiring plan"), ("akwasi", "omar", "bongani")),
    (DriveFile("pricing-memo", "Pricing change memo", DOC, "david", 2, (), "pricing memo"), ("sandra", "omar")),
    (DriveFile("roadmap-notes", "Roadmap review notes", DOC, "david", 4, (), "roadmap"), ("bongani", "jon")),
]

ALL_DRIVE_FILES: list[DriveFile] = OWNER_UNSORTED + PROPOSALS + [f for f, _ in SUGGESTED]


def drive_file_id(key: str) -> str:
    return f"acme-drive-{key}"

