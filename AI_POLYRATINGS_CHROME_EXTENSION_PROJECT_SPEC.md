# AI PolyRatings Chrome Extension

> A living product specification for a Chrome extension that helps college students evaluate course sections and professors using ratings, AI review summaries, personal preferences, and feedback from academically similar students.

## 1. Project overview

AI PolyRatings is a proposed Chrome extension for students selecting classes. While viewing a university course-search or registration page, students can see relevant professor information without repeatedly navigating away from the registration workflow. The extension combines professor/course ratings and reviews with AI-generated summaries, saved classes, individual preferences, and recommendations informed by ratings from students with similar academic backgrounds.

The product is intended to support decisions; it does not guarantee that a professor or class will be a good fit. Ratings and recommendations should be presented with their context, sample size, and limitations.

## 2. Problem statement

Choosing a class can require comparing many course sections, professors, schedules, and scattered student reviews. Reading every review takes time, overall scores can hide important details, and generic ratings may not represent a student's own situation. For example, feedback from students in the same major and academic year may be more useful than feedback from students with very different course experience.

Students need a fast, transparent way to compare their options while registering, understand the recurring themes in reviews, and see recommendations that reflect both their own priorities and the experiences of similar students.

## 3. Target users

### Primary users

- Undergraduate students selecting or planning course sections.
- Students who want to compare professors, workload, difficulty, attendance expectations, and scheduling fit.

### Secondary users

- New or transfer students who have less firsthand knowledge of instructors.
- Students planning future terms who want to save and revisit potential classes.

### Assumptions

- The first version is designed for one supported university/course-registration site.
- Students can access professor/course rating data through an authorized source or a product-managed dataset.
- Students may optionally provide major, academic year, and preferences to receive more tailored recommendations.

## 4. Product goals

1. Reduce the time needed to compare professors and sections during registration.
2. Make long-form reviews easier to understand through accurate, review-grounded AI summaries.
3. Help students make more relevant decisions using preferences and similar-student feedback.
4. Make recommendation reasoning visible instead of presenting unexplained scores.
5. Keep student data minimal, private, and under the student's control.

## 5. Scope

### In scope

- A Chrome extension that augments supported course-search and professor-rating pages.
- Professor/course ratings, review details, and category-level information.
- AI summaries of available reviews.
- Favorites, preferences, and similar-student recommendations.
- Clear recommendation explanations and data-confidence indicators.

### Out of scope for the initial product

- Registering for or dropping classes on a student's behalf.
- Guaranteeing instructor quality, course outcomes, grades, or schedule availability.
- Replacing official university catalog, prerequisite, waitlist, or degree-audit information.
- Using sensitive student attributes beyond the academic context needed for the feature.

## 6. Core workflow

1. A student opens the supported course-search or registration page.
2. The extension detects visible course sections and enriches them with professor ratings and quick facts.
3. The student opens a detail panel/page to read reviews, category ratings, and an AI summary.
4. The student optionally saves classes, enters their major/year, and sets preferences such as schedule, flexibility, attendance, or difficulty.
5. The extension recommends relevant professors or sections using peer ratings from students with the same or similar major and year, plus applicable preferences.
6. The student sees the rationale, peer-group size, and any low-confidence warning before deciding what to investigate or save.

## 7. Features and user stories

### Feature 1: AI Summary

The extension condenses available professor reviews into a readable, evidence-based overview.

1. **Review Summary**  
   As a student, I want to see an AI-generated summary of a professor's reviews so that I can understand the overall student experience without reading every review.
2. **Common Themes**  
   As a student, I want the AI summary to identify common themes across reviews so that I can quickly understand recurring feedback about a professor.
3. **Key Strengths and Concerns**  
   As a student, I want to see commonly mentioned strengths and concerns about a professor so that I can determine whether their teaching style matches what I am looking for.

### Feature 2: Professor Results

The extension adds useful professor context where students compare course sections.

4. **Professor Ratings in Search Results**  
   As a student, I want to see professor ratings alongside available course sections so that I can compare professors while choosing a class.
5. **Quick Professor Information**  
   As a student, I want to see key professor information such as overall rating, difficulty, and number of reviews so that I can evaluate professors without leaving the course results page.
6. **Compare Professors**  
   As a student, I want to compare professors teaching different sections of the same course so that I can choose the section that best fits my preferences.

### Feature 3: Professor Rating Page

The extension provides a fuller view of the information behind a professor's score.

7. **View Professor Details**  
   As a student, I want to open a professor's detailed rating page so that I can learn more about their ratings and student experiences.
8. **View Individual Reviews**  
   As a student, I want to read individual student reviews for a professor so that I can understand the experiences behind their overall rating.
9. **View Rating Categories**  
   As a student, I want to see professor ratings broken down into categories such as difficulty, attendance, and flexibility so that I can evaluate the factors that matter to me.

### Feature 4: Favorited Classes

Students can maintain a short list of options they are considering.

10. **Favorite a Class**  
    As a student, I want to favorite a course or section that I am considering so that I can easily find it again later.
11. **View Favorited Classes**  
    As a student, I want to view all of my favorited classes in one place so that I can compare my potential course options.
12. **Remove a Favorite**  
    As a student, I want to remove a class from my favorites so that my saved list only contains classes I am still considering.

### Feature 5: Adding Preferences

Students express what matters to them; these preferences are distinct from peer similarity.

13. **Set Schedule Preferences**  
    As a student, I want to specify preferred class times so that recommendations can avoid sections that conflict with my scheduling preferences.
14. **Set Professor Preferences**  
    As a student, I want to specify what professor characteristics matter to me, such as flexibility, attendance policies, or difficulty, so that recommendations reflect my priorities.
15. **Prioritize Preferences**  
    As a student, I want to rank the importance of my preferences so that the extension can prioritize the factors I care about most when recommending sections.

### Feature 6: Similar Student Recommendations (Similarity Algorithm)

This user-facing feature uses ratings from students with the same or similar major and academic year. It is not simply a match against the current student's stated preferences. Preferences can refine a recommendation, while similar-student ratings answer: *What did students academically like me experience and recommend?*

16. **Similar Student Ratings**  
    As a student, I want to see professor and course ratings from students who share my major and year so that I can get feedback that is more relevant to my academic experience.
17. **Similarity-Based Recommendation**  
    As a student, I want professors and course sections to be recommended based on ratings from students with a similar major and year so that I can make a more informed enrollment decision.
18. **Recommendation Explanation**  
    As a student, I want to see why a professor or course was recommended to me, including how similar students rated them, so that I can understand how the recommendation was determined.

Example: *Recommended for you: Computer Science students in their fourth year rated this professor 4.6/5, based on 23 ratings from similar students.*

## 8. Suggested epics

| Epic | Objective | Features |
| --- | --- | --- |
| **Course Discovery and Evaluation** | Let students find, compare, and understand professors/sections in context. | AI Summary, Professor Results, Professor Rating Page |
| **Personalized Planning and Recommendations** | Let students save options and receive transparent, relevant guidance. | Favorited Classes, Adding Preferences, Similar Student Recommendations |

## 9. Functional requirements

### Course and professor information

- The extension shall display an overall rating, difficulty indicator, and review count beside a supported course section when an instructor match exists.
- The extension shall let users open a detail view from a search result.
- The detail view shall show available reviews and rating categories with source/context labels.
- The extension shall gracefully indicate missing, unavailable, or ambiguous professor matches.

### AI summaries

- The system shall generate a concise summary from the review corpus associated with the selected professor/course context.
- The summary shall identify recurring themes, strengths, and concerns.
- The interface shall label generated content as AI-generated and link or provide access to underlying reviews when permitted.
- The system shall avoid inventing facts not supported by the reviews and shall state when evidence is limited.

### Favorites and preferences

- The extension shall let a signed-in or local user add and remove a class/section from favorites.
- The extension shall provide a favorites view with enough information to compare saved options.
- The extension shall allow a user to store optional major, academic year, schedule preferences, professor preferences, and importance rankings.
- The extension shall allow users to edit, clear, and opt out of personalization data.

### Recommendations

- The system shall calculate similar-student aggregates using same-major/year ratings when sufficient data exists, with clearly defined similar-group fallbacks.
- The system shall recommend eligible professor/course-section options and display a score or ranking only with an explanation.
- Each recommendation shall display the similarity basis, relevant peer-group rating, sample size, and applicable preference factors.
- The system shall suppress, broaden, or mark results as low confidence when peer-group data is sparse.

## 10. Non-functional requirements

- **Performance:** Course-result enrichment should not materially interrupt page use; target an initial visible response within approximately 2 seconds after relevant data is available.
- **Usability:** Information must be scannable, keyboard accessible, and understandable without technical knowledge of the algorithm.
- **Accessibility:** Extension UI should support keyboard navigation, semantic labels, adequate color contrast, and screen readers.
- **Privacy:** Collect only data necessary for the product; make profile fields optional; provide deletion/clear controls.
- **Security:** Use encrypted transport, least-privilege extension permissions, secure authentication where applicable, and no secrets in the extension bundle.
- **Reliability:** Handle upstream rating-service failures, changed page markup, and missing data without breaking the host site.
- **Transparency:** Clearly distinguish raw ratings, peer aggregates, AI-generated summaries, and recommendation outputs.
- **Maintainability:** Keep the site adapter, data services, recommendation logic, and UI components separable so they can evolve independently.

## 11. Data considerations

### Potential data entities

| Entity | Example fields | Notes |
| --- | --- | --- |
| Course/section | course code, term, section, meeting time, instructor identifier | Official schedule data should remain the source of truth. |
| Professor | name, institution identifier, department | Name matching may be ambiguous and needs safeguards. |
| Review/rating | professor/course context, overall score, category scores, review text, timestamp | Respect source permissions and avoid exposing private identifiers. |
| Student profile | optional major, academic year, preferences, weights | Minimize collection; do not use unnecessary personal data. |
| Peer aggregate | cohort definition, average/median rating, sample size, confidence | Prefer aggregated/de-identified results. |
| Favorite | user/anonymous local identifier, section identifier, saved time | May be stored locally for MVP. |

### Privacy and quality principles

- Ask for major and year only when the user wants peer-based recommendations.
- Do not expose individual peer identities or individual peer ratings as attributable to a student.
- Use aggregation thresholds (for example, do not display a cohort aggregate below a defined minimum count) to reduce re-identification risk.
- Communicate that ratings are subjective, may be incomplete, and can contain bias.
- Validate professor/course identity matches and provide a correction/report path.
- Confirm licensing, terms of use, and authorization before collecting or displaying any third-party rating data.

## 12. Conceptual recommendation logic

The recommendation system should be explainable and start simple. It may calculate a score for each eligible section using a weighted combination of:

1. **Peer rating signal:** aggregated rating from students with the same major and year.
2. **Similar-group fallback:** if the exact cohort is too small, progressively use a defined comparable group, such as same major/nearby year, same department/year, or a general population score. The UI must identify which group was used.
3. **Confidence:** sample size, recency, rating variance, and match quality reduce confidence when evidence is weak.
4. **Preference fit:** schedule compatibility and student-selected instructor attributes can adjust ordering, but should not replace the peer signal.
5. **Eligibility:** exclude sections that fail hard constraints, such as a time the user marked unavailable, when that information is available.

Illustrative—not final—formula:

`recommendation score = peer rating signal × confidence + preference-fit adjustment`

The result should never be shown as an objective truth. A useful explanation might be: “Recommended because 23 fourth-year Computer Science students rated this professor 4.6/5; the section also fits your preferred afternoon schedule.”

## 13. UI and screens

| Screen/surface | Purpose | Key elements |
| --- | --- | --- |
| Course results enhancement | Compare sections during search/registration. | Rating badge, difficulty, review count, recommendation indicator, detail action. |
| Professor detail panel/page | Inspect a professor before deciding. | Overall/category ratings, reviews, AI summary, strengths/concerns, related sections. |
| Compare view | Compare instructors for the same course. | Side-by-side rating, difficulty, themes, schedule, peer signal, and match explanation. |
| Favorites view | Revisit considered options. | Saved course/section list, quick comparison, remove action, link back to course page. |
| Preferences view | Set personalization inputs. | Major, academic year, time availability, instructor priorities, importance ranking, clear-data action. |
| Recommendation explanation | Build trust in a ranked result. | Similarity cohort, peer rating, sample size, confidence/limitations, preference factors. |
| Empty/error states | Prevent misleading silence. | No rating found, insufficient peer data, source unavailable, permissions/sign-in guidance. |

## 14. Technical architecture assumptions

This is a conceptual architecture; the implementation can change with project constraints.

- **Chrome extension:** Manifest V3 extension with a content script to recognize supported pages, a service worker for orchestration, and a popup/side panel or injected UI for student interactions.
- **Frontend:** TypeScript-based UI components, isolated styles, accessible reusable components, and local extension storage for low-risk MVP preferences/favorites.
- **Backend/API:** A small API layer for authorized rating data, AI-summary requests, cohort aggregates, account-backed storage, and recommendation calculations.
- **Data layer:** A database for normalized professor/course identities, reviews/ratings when authorized, de-identified aggregates, and optional user data. Cached aggregates improve responsiveness.
- **AI layer:** A server-side LLM integration that receives only the minimum review text/context needed, produces structured summaries, and applies moderation/validation and caching.
- **Recommendation service:** A deterministic, versioned scoring module or service that produces a score plus explanation fields; it should be testable without the UI.
- **Observability:** Privacy-conscious event logging for latency, errors, and aggregate feature adoption; do not log raw sensitive profile fields unnecessarily.

## 15. MVP and future ideas

### MVP

- Support one course-search site and a limited set of pages.
- Show basic professor ratings, difficulty, and review counts in results.
- Provide a professor detail view with individual reviews and category ratings.
- Generate a concise AI review summary with strengths, concerns, and a limited-evidence notice.
- Save and remove favorites locally.
- Collect optional major/year and show simple, aggregated same-major/year ratings when sufficient data exists.
- Display transparent recommendation explanations and no-result/low-confidence states.

### Future ideas

- Account sync across browsers/devices and shareable planning lists.
- Better course/section matching, multi-term trends, and recency weighting.
- More refined peer similarity (for example, course level or program track) with fairness/privacy review.
- Student feedback on recommendation usefulness to calibrate the model.
- Schedule conflict visualization and calendar planning.
- Comparison filters, notification of section/instructor changes, and support for additional institutions.
- Human review/admin workflows for incorrect professor matches or harmful review content.

## 16. Success metrics

| Area | Example metric |
| --- | --- |
| Adoption | Weekly active extension users; percentage of eligible students who open results enrichment. |
| Engagement | Detail-panel open rate, summary-view rate, comparison use, and favorites created per active user. |
| Recommendation value | Percentage of users who view an explanation; post-use helpfulness rating; saves/clicks following recommendations. |
| Decision efficiency | Self-reported time saved or reduction in page switching while comparing sections. |
| Quality and trust | Summary/recommendation helpfulness, correction reports, and low-confidence-result rate. |
| Reliability | Successful enrichment rate, API error rate, and median page-impact/response latency. |
| Privacy | Percentage of users who opt in to profile data; deletion/clear-data requests completed successfully. |

Metrics should be collected in aggregate and reviewed alongside privacy and fairness concerns, not used to pressure students to disclose data.

## 17. Risks and constraints

| Risk or constraint | Why it matters | Mitigation direction |
| --- | --- | --- |
| Rating data access and licensing | Data may be unavailable or restricted. | Use authorized sources, verify terms, and design graceful empty states. |
| Sparse peer cohorts | Exact major/year groups may be too small or identifying. | Use minimum thresholds, transparent fallbacks, confidence labels, or no recommendation. |
| Bias in ratings/reviews | Recommendations can reinforce subjective or systemic bias. | Show context, avoid overclaiming, monitor outcomes, and allow feedback/corrections. |
| AI hallucination | Summaries may misstate reviews. | Ground summaries in supplied reviews, use structured output, show evidence/links, and state limitations. |
| Page changes | Host-site markup can break a content script. | Isolate site adapters, monitor failures, and use robust selectors/tests. |
| Professor identity matching | Similar names can attach the wrong rating data. | Use institution/course identifiers where possible; flag ambiguous matches. |
| Privacy and compliance | Major/year and behavior are student data. | Minimize data, obtain clear consent, aggregate peers, and support deletion. |
| Academic calendar pressure | Students need the product most during registration peaks. | Cache results, load progressively, and prioritize reliability/fast fallbacks. |

## 18. Glossary

| Term | Meaning |
| --- | --- |
| **AI summary** | A generated synthesis of available reviews, labeled as AI-produced and grounded in the source review set. |
| **Cohort** | A group of students used for aggregation, such as students in the same major and academic year. |
| **Confidence** | An indicator of how much evidence supports a rating or recommendation, influenced by sample size and data quality. |
| **Course section** | A specific offering of a course, typically defined by meeting time, instructor, term, and section number. |
| **Favorite** | A course or section saved by the student for later comparison. |
| **Peer aggregate** | A de-identified summary statistic—such as an average rating and count—computed for a cohort. |
| **Preference fit** | How well a section or instructor aligns with the current student's stated constraints or priorities. |
| **Recommendation explanation** | The visible reason a result was suggested, including cohort, rating, sample size, confidence, and preference effects. |
| **Similar student recommendation** | A recommendation informed primarily by ratings from students with the same or similar major and year. |

---

## Document status

This document is a planning specification, not a final implementation contract. Update it as data-source permissions, supported university systems, UX research, privacy review, and technical feasibility become clearer.
