// Six fictional postings (2 per track) so the app has data on first run.
// Raw descriptions are realistic so the extractor and match analysis have something to work on.

export type SampleJob = { trackSlug: string; description: string; sourceUrl: string; status: "Saved" | "Applied" | "Interviewing"; daysAgo: number; appliedDaysAgo?: number; deadlineInDays?: number };

export const SAMPLE_JOBS: SampleJob[] = [
  {
    trackSlug: "ux-ui",
    sourceUrl: "https://careers.example.com/brightpath/junior-product-designer",
    status: "Applied",
    daysAgo: 12,
    appliedDaysAgo: 10,
    description: `Junior Product Designer
Company: BrightPath Learning
Location: Austin, TX (Hybrid, 2 days in office)
$62,000 - $74,000 per year

BrightPath builds study tools used by 2 million high-school students. We're hiring an entry-level product designer to join our 6-person design team.

What you'll do
- Design flows and screens for our mobile and web apps in Figma
- Run usability tests with students and turn findings into design changes
- Work with engineers to ship features every two weeks
- Contribute components to our design system

Requirements
- 0-1 years of professional design experience (internships and bootcamps count)
- A portfolio with at least 2 case studies showing your process
- Working knowledge of Figma, including auto layout and prototyping
- Understanding of user research and usability testing methods
- Clear written and verbal communication

Nice to have
- Experience designing for accessibility (WCAG 2.1)
- Basic HTML and CSS
- Interest in education technology

Apply by Dec 15, 2026.`,
  },
  {
    trackSlug: "ux-ui",
    sourceUrl: "https://careers.example.com/harborhealth/associate-ux-designer",
    status: "Saved",
    daysAgo: 3,
    deadlineInDays: 9,
    description: `Associate UX Designer
Company: Harbor Health Partners
Location: Remote (US)
$30 - $36 per hour

Harbor Health is redesigning the patient portal that 400,000 patients use to book visits and see results. Join us as an Associate UX Designer.

Responsibilities
- Create wireframes, user flows and high-fidelity prototypes
- Help plan and run moderated usability sessions
- Document design decisions for developers

Qualifications
- 1-2 years of experience in UX or UI design, including internships
- Portfolio showing user-centered design process
- Proficiency in Figma
- Experience with user research, personas and journey mapping
- Strong collaboration skills

Preferred
- Google UX Design Certificate or similar
- Experience in healthcare or other regulated industries
- Familiarity with Miro or FigJam for workshops`,
  },
  {
    trackSlug: "cybersecurity",
    sourceUrl: "https://careers.example.com/northwind/soc-analyst-1",
    status: "Interviewing",
    daysAgo: 20,
    appliedDaysAgo: 18,
    description: `SOC Analyst I
Company: Northwind Managed Security
Location: Sacramento, CA (On-site)
$68,000 - $80,000 per year

Northwind monitors networks for 150 mid-sized companies. Our Tier 1 analysts are the first to see and triage security alerts.

What you'll do
- Monitor SIEM alerts in Splunk and triage them using our playbooks
- Investigate phishing emails reported by customers
- Escalate confirmed incidents to Tier 2 with clear notes
- Document findings in ServiceNow

Requirements
- 0-2 years of experience in IT or security (labs, internships and home labs count)
- CompTIA Security+ or ability to obtain within 90 days of hire
- Understanding of TCP/IP, DNS and common ports and protocols
- Familiarity with Windows and Linux command line
- Ability to work rotating shifts, including one weekend day

Nice to have
- Hands-on experience with Splunk or another SIEM
- TryHackMe, Hack The Box or CTF experience
- Python or PowerShell scripting
- Wireshark packet analysis`,
  },
  {
    trackSlug: "cybersecurity",
    sourceUrl: "https://careers.example.com/vantagecorp/entry-level-security-analyst",
    status: "Saved",
    daysAgo: 5,
    description: `Entry-Level Security Analyst
Company: Vantage Financial Corp
Location: Hybrid - San Francisco, CA
$95,000 - $115,000 per year

Great opportunity for an entry-level analyst to join our Information Security team!

Responsibilities
- Lead vulnerability management program across 3,000 endpoints
- Perform threat hunting and incident response
- Own the firewall rule review process
- Mentor junior analysts

Requirements
- 3-5 years of experience in information security
- CISSP required
- Bachelor's degree in Computer Science, Cybersecurity or related field
- Hands-on experience with CrowdStrike, Palo Alto firewalls and Nessus
- Experience leading incident response for a financial institution
- Knowledge of PCI-DSS, SOX and NIST CSF

Preferred
- OSCP
- Python scripting for automation`,
  },
  {
    trackSlug: "tech-support",
    sourceUrl: "https://careers.example.com/cedarvalley/help-desk-technician-1",
    status: "Applied",
    daysAgo: 16,
    appliedDaysAgo: 9,
    description: `Help Desk Technician I
Company: Cedar Valley Unified School District
Location: Elk Grove, CA (On-site)
$24.50 - $28.00 per hour

Support 4,000 students and 600 staff across 8 schools. You'll be the first person teachers call when something breaks.

What you'll do
- Answer phone, email and walk-in requests and log them in our ticketing system
- Reset passwords and manage accounts in Active Directory and Google Workspace
- Set up and repair Chromebooks, Windows laptops, printers and projectors
- Escalate network issues to Tier 2

Requirements
- 0-1 years of help desk or customer service experience
- High school diploma or GED
- Basic troubleshooting of Windows and Chrome OS
- Friendly, patient communication with non-technical users
- Valid driver's license to travel between school sites

Nice to have
- CompTIA A+
- Experience with ServiceNow or another ticketing system
- Spanish language skills`,
  },
  {
    trackSlug: "tech-support",
    sourceUrl: "https://careers.example.com/lumen-dental/it-support-specialist",
    status: "Saved",
    daysAgo: 1,
    description: `IT Support Specialist
Company: Lumen Dental Group
Location: Roseville, CA (Hybrid)
$52,000 - $60,000 per year

Lumen runs 14 dental offices. Our 3-person IT team keeps the practice software, phones and devices running.

Responsibilities
- Provide Tier 1 and Tier 2 support for 250 users by phone, remote session and on-site visits
- Image and deploy Windows 11 workstations with Intune
- Manage Microsoft 365 accounts, licenses and MFA
- Maintain asset inventory and document fixes in the knowledge base

Requirements
- 2 years of experience in IT support or help desk
- CompTIA A+ certification
- Experience with Active Directory and Microsoft 365 administration
- Strong troubleshooting skills for hardware, software and network issues
- Excellent customer service

Preferred
- Experience with Intune or SCCM
- Network+
- Healthcare IT experience`,
  },
];
