Target Audience Research 
Engineering managers, Tech leads,CTOs

**Platform:** AI-powered engineering analytics platform

**Date:** March 2026.

**Sources:** *qualitative field research (Reports 1–2), survey (30 respondents).*

### 1. Research Methodology

The research is based on a mixed-methods approach: a survey of engineering leaders, analysis of industry reports (DORA, LeadDev), and analysis of discussions in engineering management communities.

The survey included questions about: the respondent’s role, company size, tools used, key challenges in managing engineering teams, the impact of AI on development, time spent on coordination and status updates, and confidence in understanding the state of development.

### 2. Visualization of survey data

**Chart 1 — Role Distribution**

<img width="989" height="590" alt="Role Distribution" src="https://github.com/user-attachments/assets/9b2695ba-c0f3-4853-a98e-658a8d24654f" />

The primary survey audience consists of Engineering Managers and Tech Leads.

These are mid-level engineering leaders who simultaneously: manage delivery, coordinate team work, and aggregate development status for management.

More senior roles (CTO / VP Engineering) are less common, but they participate in discussions regarding strategic visibility issues.

**Chart 2 — Main Engineering Management Problems**

<img width="1141" height="547" alt="Main Engineering Management Problems" src="https://github.com/user-attachments/assets/b4fb7dc4-a106-4ef3-a96b-7fce93baf766" />

The most frequently mentioned problems: knowledge sharing, delivery predictability, coordination across teams, communication overhead, understanding what teams are actually doing.

Engineering leadership challenges appear to be driven primarily by coordination and visibility issues rather than by the technical aspects of software development itself.

Three categories of problems are most frequently cited:

delivery predictability, coordination between teams, and knowledge sharing.

This points to the challenges of scaling engineering processes.

<img width="568" height="455" alt="Time Spent Understanding Engineering Status" src="https://github.com/user-attachments/assets/30ee9b00-fcdd-4247-8c20-e0fb3bc42d03" />

**Chart 3 — Time Spent Understanding Engineering Status**

Most respondents spend 2–5 hours per week on:

status updates, coordination, and understanding team progress.

Some respondents spend:

5–10 hours or more.

Engineering leaders regularly spend a significant amount of time gathering development context.

This indicates an operational burden associated with: status aggregation, coordination across teams, and interpretation of engineering signals.

**Chart 4 — Engineering Problems by Role**

<img width="1040" height="850" alt="Engineering Problems by Role" src="https://github.com/user-attachments/assets/1f350f65-582d-41cd-93b0-8ede64facd55" />

The heatmap shows which problems are mentioned more frequently by different roles.

Tech Leads most often mention: communication overhead, coordination across teams, and knowledge sharing.

Engineering Managers more often mention: delivery predictability and coordination across teams.

Different roles face different aspects of visibility issues.

Tech Leads tend to focus on operational issues related to communication and coordination.

Engineering Managers more often note the challenges of predicting delivery.

**Chart 5 — Visibility Gap Index by Role**

To assess the visibility issue we are investigating, a preliminary “visibility index” was compiled based on two survey metrics:

- time spent on status alignment
- self-assessment of confidence in understanding technical status.

<img width="819" height="528" alt="Visibility Gap Index by Role" src="https://github.com/user-attachments/assets/4409155b-f86e-49ba-a42b-0967fa24e634" />

The time spent on alignment was rated on a scale from 1 to 4 and multiplied by the confidence rating (from 1 to 5). The resulting index provides a rough estimate of situations where managers spend a lot of time gathering information but rely on subjective interpretations of the project’s status. Here are the results:

The highest index values are observed among **CTOs / VPs of Engineering and Founders**

Visibility challenges intensify at the senior engineering leadership level. This may be due to the fact that higher-level managers work with multiple teams, receive aggregated data, and rely on tools and reporting.

**Chart 6 — Visibility Gap Index by Company Size**

<img width="686" height="531" alt="Visibility Gap Index by Company Size" src="https://github.com/user-attachments/assets/ba9fb548-98b4-4177-ba26-524d1144404f" />

The chart shows differences in the visibility gap depending on company size.

The highest index is observed in companies with 50 to 200 employees.

Visibility challenges can intensify during the scaling phase of engineering organizations.

Companies of this size typically transition from a single team to multiple teams, which increases:

coordination complexity, information fragmentation, and communication overhead.

### 3. Critical Analysis of Pain Points

The data reveals a paradox that serves as a key insight for the target audience research:

- **The AI-Efficiency Paradox:** The survey suggests that while development speed has increased, understanding the system has become more difficult. As a result, engineering leaders are faced with growing complexity in interpreting engineering signals: more code changes, but less clarity about the overall state of the system.
- **The “Visibility vs. Noise” Problem:** Respondents note that they lack “real visibility,” yet qualitative research (expert posts) sounds a warning: “complete transparency creates noise.” This means that the target audience doesn’t need a “monitor for everything,” but rather a tool for filtering and highlighting anomalies.
- **Information fragmentation:** This is a recurring issue. Tools (Jira, Slack, GitLab) are paid for, but the information within them is scattered. The most frustrating part is the “constant quick calls” to clarify what should already be clear from the tools.

### 4. Tools

According to surveys and industry reports, the most commonly used tools are:

Jira, Slack, GitHub / GitLab, dashboards, and meetings.

This indicates that engineering data already exists within the organization, but may be distributed across multiple tools.

### 5. Audience Segmentation

Based on survey data and qualitative signals, several user types can be identified.

***Segment A — Engineering Manager at a growing company***

**Company size:** 50–200 employees

**Context**: The organization is beginning to scale, and several teams are forming.

**Behavior**: They use multiple tools simultaneously and spend several hours a week on coordination.

**Main challenges:** delivery predictability, coordination across teams, visibility of real progress.

***Segment B — Technical Lead***

**Company size:** 50–1,000 employees

Context: Technical leadership of one or more teams.

Key challenges: communication overhead, knowledge sharing, coordination between teams.

***Segment C — Senior Engineering Leadership***

**Roles**: CTO / VP of Engineering.

**Context**: Aggregation of information from multiple teams and systems.

Key challenges: interpretation of engineering status and delivery predictability at the organizational level.

### 6. Observations on the impact of AI

Survey responses show that many respondents note: development has become faster.

However, open-ended responses also mention: an increase in PR review workload, faster iteration cycles, and greater difficulty understanding the system.

AI tools can accelerate individual development, but they can also increase:

the volume of changes, the frequency of iterations, and the load on review processes.

This can create additional complexity in interpreting the system’s state.

### 7. Study Limitations

The results should be interpreted with consideration of the limitation of the small sample size (30 respondents).

The study does not allow for conclusions regarding the exact market size, willingness to pay, or ROI of analytical tools.

### 8. Key Insights

**1. The main challenges for engineering leadership are related to coordination and transparency in development processes**

The most frequently cited issues include coordination across teams, delivery predictability, knowledge sharing, communication overhead, and understanding what teams are actually doing. Most of these problems are related not to code development, but to the management of complex engineering processes and cross-team dependencies. As the number of teams increases, so does the complexity of information exchange and the difficulty of forecasting task deadlines.
**2. Engineering leaders regularly spend several hours a week gathering development status updates**

The majority of respondents report spending between 2 and 5 hours per week on status updates, cross-team coordination, and tracking current development progress. Some participants indicate that this figure can reach 10 hours or more. This points to a persistent operational burden tied to manual information aggregation and the complexities of coordination between teams.

**3. The primary sources of information on development status are a combination of tools and communication**

Respondents indicate that they utilize several information sources concurrently to monitor development status, including Jira, meetings, Slack, and dashboards. Frequently, they explicitly state that they rely on a 'mix of everything' or even 'gut feeling' to assess the current state of progress. This highlights the fact that no single tool provides full context, requiring engineering leaders to manually synthesize data from various disparate sources.

**6. Different roles face different aspects of visibility challenges**

Tech Leads more frequently point to issues like communication overhead, knowledge sharing, and coordination across teams, reflecting their proximity to the teams' operational work. Engineering Managers more often highlight challenges with delivery predictability and understanding overall development progress. Senior leadership (CTO / VP Engineering) is more frequently faced with the task of interpreting aggregated information from multiple teams.

**7. Visibility challenges are particularly noticeable during the scaling phase of companies**

Respondents represent companies of various sizes, ranging from startups to organizations with 500–1,000 employees. A significant portion of the feedback comes from medium- and large-sized companies, where engineering management involves coordinating multiple teams. In these organizations, development information is distributed across various tools and management levels, making it difficult to obtain a comprehensive overview of the processes.

**8. AI tools accelerate development but can complicate understanding of the system**

The majority of respondents note that following the implementation of AI tools, 'development became faster.' At the same time, they mention effects such as an increased workload for PR reviews, faster iteration cycles, and greater difficulty in understanding system architecture. This indicates that the acceleration of development can increase the volume of changes and create additional complexity for managing engineering processes.

**9. Managers’ high confidence does not always mean actual process transparency**

The majority of respondents rate their confidence in understanding the development status at 4–5 out of 5. However, open-ended responses frequently mention issues such as missed deadlines, insufficient cross-team communication, and a lack of up-to-date information in Jira. This suggests a disconnect between managers' subjective confidence and the actual transparency of development processes.

**Conclusion**

The findings suggest that the core challenge in engineering leadership is not the absence of development data, but the difficulty of synthesizing it into a coherent understanding of delivery progress.

Engineering information already exists within organizations, but it is fragmented across multiple tools, teams, and communication channels. As a result, engineering leaders spend significant time aggregating and interpreting signals to understand what is actually happening in their teams. 

This challenge becomes more pronounced as organizations scale and development velocity increases.

### 9. Additional Analysis: Respondents Spending 5+ Hours Understanding Engineering Status

A small subset of respondents reported spending more than 5 hours per week understanding engineering status. Several patterns appear in this group.

First, 2/3 respondents occupy senior engineering leadership roles such as CTO or VP Engineering. These roles require synthesizing information across multiple teams rather than observing development work directly.

Second, respondents rely on fragmented information sources, including Jira, dashboards, meetings, and informal communication. Many explicitly describe their process as "a mix of everything."

Third, the most frequently mentioned problems in this group relate to cross-team coordination, knowledge sharing, and understanding what teams are actually doing.

One respondent described the situation as:

> "Getting the real visibility without constantly pinging folks over Slack and getting on quick calls."
> 

This suggests that a significant portion of time is spent manually synthesizing signals from multiple tools and communication channels.

### 10. Recommendations for Further Research

Further research is needed to move from preliminary conclusions to more robust insights.

**1. Expanding the Sample**

The current survey includes 30 respondents and should be considered exploratory research.

To increase the statistical robustness of the results, it is recommended to expand the sample to:

100–150 respondents.

This will allow for a more accurate assessment of the distribution of engineering leadership issues.

**2. Conducting in-depth interviews**

The survey helps identify patterns but does not always explain the causes of the observed issues.

The next stage of the research may include:

10–15 in-depth interviews with Engineering Managers and Tech Leads.

The goal of the interviews is to understand:

- exactly how managers track development progress
- what metrics they use to assess progress
- where the main points of uncertainty arise.

**3. Analysis of tool fragmentation**

Preliminary data indicates that engineering data is distributed across multiple systems.

For a more accurate analysis, additional data must be collected on:

- the number of tools used
- the frequency of switching between systems
- the types of data that managers use to assess progress.

**4. Research on the Impact of AI on Development Processes**

The survey shows that AI accelerates development but may increase the workload on review and coordination processes.

For further analysis, the following could be examined:

- changes in the number of pull requests
- changes in review time
- changes in iteration frequency.

This will provide a better understanding of AI’s impact on engineering processes.

**5. Studying decision-making processes regarding the purchase of tools**

To assess the market potential of analytical tools, it is necessary to study:

- who makes decisions regarding the purchase of engineering tools
- what budgets are available for such decisions
- what criteria are used when selecting tools.

### 11. Primary Early Adopter Segment

The most promising group for initial hypothesis testing is:

**Engineering Managers at companies with 50–200 employees.**

These organizations are in the process of scaling their engineering processes and are facing increasing complexity in coordination between teams.

Managers in such companies:

- use multiple tools simultaneously
- spend several hours a week gathering development status updates
- struggle to interpret engineering signals.

It is precisely this segment that may be most receptive to solutions aimed at improving the transparency of engineering processes.

### 12. References

Survey results link: https://1drv.ms/x/c/6013ddfd2601f64e/IQDabY0iK4KFRILgl1TGWUTGAbMG3W2C4v6volMJLNq-oIM

[Report 1](https://www.notion.so/Report-1-3155d8e4870180889449f948c3cac5ea?pvs=21)

[Report 2](https://www.notion.so/Report-2-3195d8e4870180df9b2dc9bbbe847040?pvs=21)

[**Research on the pain points of development teams and tech leads, as well as validation of the hypothesis that visibility problems emerge as teams scale.**](https://www.notion.so/Research-on-the-pain-points-of-development-teams-and-tech-leads-as-well-as-validation-of-the-hypoth-30f5d8e4870180acad7ee05f1d78d0d6?pvs=21)

Link of full TAR: https://www.notion.so/Target-Audience-Research-cc45d8e4870182e5971881bb2a74c171?source=copy_link 
