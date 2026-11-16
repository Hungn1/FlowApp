// Starter interview questions. Used as-is without an API key, and as examples for the AI.

export const BEHAVIORAL: string[] = [
  "Tell me about yourself.",
  "Why do you want to work here, and why this role?",
  "Tell me about a time you had to learn something new quickly.",
  "Describe a time you made a mistake. What did you do next?",
  "Tell me about a time you worked with someone who was frustrated or upset.",
  "Describe a time you had several things due at once. How did you prioritize?",
  "Tell me about a time you explained something technical to someone non-technical.",
  "Tell me about a project you're proud of. What was your part?",
  "Describe a time you received critical feedback. How did you respond?",
  "Where do you want to be in two or three years?",
];

export const TRACK_QUESTIONS: Record<string, string[]> = {
  "ux-ui": [
    "Walk me through one case study in your portfolio, from problem to final design.",
    "How do you decide which user research method to use?",
    "Tell me about a time usability testing changed your design.",
    "How do you handle feedback from stakeholders that conflicts with user research?",
    "How do you make sure a design is accessible?",
    "How do you hand off designs to developers?",
    "What's a product you think has great UX, and why?",
    "How do you use a design system, and when would you break from it?",
  ],
  cybersecurity: [
    "Walk me through how you'd triage a SIEM alert for repeated failed logins.",
    "A user reports a suspicious email. What do you do, step by step?",
    "Explain the difference between TCP and UDP, and name a few common ports.",
    "What's in your home lab, and what have you practiced with it?",
    "How would you tell a false positive from a real incident?",
    "Explain the CIA triad with an example of each.",
    "What would you include in an escalation note to Tier 2?",
    "How do you keep up with new threats and vulnerabilities?",
  ],
  "tech-support": [
    "A user says 'the internet is down.' How do you troubleshoot it?",
    "Walk me through resetting a password and unlocking an account in Active Directory.",
    "How do you handle a caller who is angry and wants it fixed now?",
    "A printer prints blank pages for one user only. What do you check?",
    "How do you decide when to escalate a ticket?",
    "How do you document a fix so the next technician can use it?",
    "How would you set up a new laptop for a new employee?",
    "Tell me how you prioritize a queue of tickets.",
  ],
  general: [
    "Walk me through a technical project on your resume.",
    "How do you troubleshoot a problem you've never seen before?",
    "What tools do you use day to day, and why?",
    "Tell me about a time you documented a process for others.",
  ],
};

/** STAR reminder shown next to behavioral questions. */
export const STAR_HINT = "Use STAR: the Situation, your Task, the Action you took, and the Result (with a number if you have one).";
