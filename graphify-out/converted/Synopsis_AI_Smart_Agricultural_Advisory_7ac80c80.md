<!-- converted from Synopsis_AI_Smart_Agricultural_Advisory.docx -->


DEPARTMENT OF INFORMATION TECHNOLOGY


Synopsis of Community Engagement PBL –Minor Project (Internet Programming)
On

TITLE
AI-Driven Smart Agricultural Advisory System

Prepared By:
Parshva Doshi (Roll No. 09)
Parth Shah (Roll No. 33)
Yash Rana (Roll No. 76)
Jinay Shah (Roll No. 77)


Under the guidance of:
Prof. Trupti Patil


Department of Information Technology
Academic Year: 2026-2027
Autonomy Syllabus Scheme-III (2026-27) - SEMESTER V (TY - IT)
CERTIFICATE
## This is to certify that following students:
Roll No. / Seat No.
Parshva Doshi                                                         09
Parth Shah                                                               33
Yash Rana	                                                        76
Jinay Shah                                                               77
have submitted Community Engagement PBL –Minor Project (Internet Programming) Report on “AI-Driven Smart Agricultural Advisory System” as the partial fulfillment for the requirement of Third Year of Engineering (5th  Semester) in T.Y. - Information Technology under my guidance during the academic year 2026-2027.


| Prof. Trupti Patil | Dr. Radhika Kotecha |
| --- | --- |
| Project Guide | Head of Department |
| Assistant Professor | Professor |
| Department of Information Technology | Department of Information Technology |



Date of Examination: _________________


Signature of Internal Examiner                                        Signature of External Examiner



Table of Contents

| Acknowledgement | 4 |
| --- | --- |
| Abstract | 5 |
| Introduction | 6 |
| Literature Review | 9 |
| Proposed System | 12 |
| Implementation Details and Results | 16 |
| Sustainability Analysis and Testing | 18 |
| Conclusion and Future Scope | 19 |
| References | 20 |



Acknowledgement
Project Guide – Prof. Trupti Patil
Minor-Project coordinator – Mrs. Sarita Rathod
Head of Department – Dr. Radhika Kotecha
Principal – Dr. Vivek Sunnapwar
We express our deepest gratitude and sincere appreciation to our esteemed Project Guide, Prof. Trupti Patil, for her invaluable guidance, continuous encouragement, constructive critiques, and insightful technical advice throughout the duration of this project. Her consistent support and mentorship played a pivotal role in shaping our technical approach and successfully completing the AI-Driven Smart Agricultural Advisory System.
We would like to convey our heartfelt thanks to Mrs. Sarita Rathod, Minor-Project Coordinator, for her meticulous organization, timely scheduling of reviews, constant monitoring, and administrative support, which kept our project on track through every phase of development.
We also extend our sincere gratitude to Dr. Radhika Kotecha, Head of the Department of Information Technology, for providing access to the necessary academic and computing infrastructure, as well as fostering an encouraging departmental environment that inspires innovation and research.
We express our profound respect and indebtedness to our Principal, Dr. Vivek Sunnapwar, for providing state-of-the-art institutional facilities, continuous institutional encouragement, and an atmosphere conducive to academic excellence at K J Somaiya Institute of Technology.
Lastly, we express our heartfelt appreciation to the faculty members, laboratory staff of the Department of Information Technology, our peers, and our families, whose direct and indirect support, patience, and encouragement made the successful fruition of this project possible.


Abstract
Agriculture supports a large share of India's rural households, yet most farmers are small and marginal landholders who make daily decisions about irrigation, crop protection and selling with little reliable, local information. Existing digital tools are fragmented: weather apps give raw forecasts, price portals list figures without context, and general AI chatbots can produce confident but ungrounded advice.
To bridge this gap, this project presents the AI-Driven Smart Agricultural Advisory System, a web application that gives farmers advice grounded in their own field. It consists of three modules:
Farm Intelligence Engine: Computes the crop's growth stage from heat units (Growing Degree Days), tracks daily water need with the FAO-56 water-balance method, and shows which crops suit the farm in each season using 15-year ERA5-Land climate normals, soil properties and irrigation.
Grounded Advisor: Answers farmer questions in natural language using retrieved guidance from ICAR packages of practice, IMD district agromet bulletins and Kisan Call Centre records; every number in an AI answer is checked against the farm's data and sources.
Prices and Weather: Shows mandi price trends from Agmarknet and a fused 7-day weather view for the farm's location.
The system is built with React and Vite on the frontend, an Express gateway, a FastAPI backend and a Supabase PostgreSQL database with vector search, in six Indian languages. When data is missing, the application states so instead of guessing. Of 178 automated backend tests, 171 pass offline; the remaining 7 need a live database connection.
Keywords: Precision Agriculture, Retrieval-Augmented Generation, Growing Degree Days, FAO-56 Water Balance, Crop Suitability, Agmarknet, Decision Support System.


Chapter 1
Introduction
Agriculture is central to India's economy and food security, and most Indian farmers operate small or marginal holdings. Their decisions on when to irrigate, how to protect the crop and when to sell are made under uncertain weather and volatile market prices.
Reliable, local advice is scarce: extension services cannot visit every farm, and much digital information is generic rather than specific to a farmer's field and crop.
The AI-Driven Smart Agricultural Advisory System brings together the information a farmer needs in one web application and grounds every piece of advice in the farmer's own data: location, soil, crop, sowing date, local weather and nearby mandi prices.

Motivation
Small and marginal farmers face several gaps that this project addresses:
Generic Advice: District bulletins and general apps do not account for a particular farm's crop stage, soil or irrigation.
Water Use: Irrigation without knowing the crop's actual water need leads to over- or under-watering.
Price Information Gap: Farmers often sell at harvest without seeing price trends in nearby mandis.
Unsafe AI Answers: General chatbots can invent doses and schedules; advice must be grounded in verified sources and checked.
Choosing the Right Crop: Farmers need to know which crops suit their soil, climate and season before sowing.

Problem Analysis
Small and marginal farmers lack a single, trustworthy tool that turns their own farm details, local weather, official agricultural guidance and market prices into specific, actionable advice, while clearly stating when information is unavailable. The main problems are:
Fragmented Information: Weather, prices and advisories are spread across separate portals and apps.
Advice Not Tied to the Field: Recommendations ignore the farm's crop stage, soil, irrigation and season.
Ungrounded AI Answers: Chatbot answers are not checked against verified sources or the farm's data.

Objectives
The primary objective of this project is to build a web-based advisory system that gives farmers accurate, farm-specific and verifiable advice. The specific objectives are:
Objective 1: Compute the crop's growth stage from heat units (Growing Degree Days) and the daily water need using the FAO-56 water-balance method.
Objective 2: Recommend which crops suit a farm's location, soil, irrigation and season, with the reason for each verdict.
Objective 3: Build an Advisor that answers questions from verified ICAR, IMD and Kisan Call Centre guidance and checks every number in its answers.
Objective 4: Show mandi price trends from Agmarknet and a fused 7-day weather view for the farm's location.
Objective 5: Provide a simple, mobile-friendly web interface in six Indian languages with honest messages when data is missing.
Objective 6: Verify the system with automated tests for every calculation engine and data service.

Scope
In-Scope Specifications:
Crops and Regions: Six crops (wheat, rice, cotton, soybean, maize, tomato) across seven Indian states.
Farm Setup: Location by village search, GPS or district; soil, irrigation, crop and sowing date.
Agronomy: Crop stage, water advice and crop suitability by season.
Advisor: Grounded answers with sources, leaf-photo checks and government scheme information.
Market and Weather: Mandi price trends, market comparison, calculators and a 7-day weather view.
Out-of-Scope Specifications (Explicit Boundary Conditions):
Hardware Sensors: The system does not use on-farm soil sensors or IoT devices.
Automatic Control: The system does not operate irrigation pumps or valves.
Trading: The system does not buy or sell produce or handle payments.
Other Crops: Crops other than the six listed are planned as future work.

Chapter 2
Literature Review
Related Work
- The following studies, published from 2020 onwards and listed from the most recent, shaped the design of this system.
- N. Singh et al. (2024) [4]: Generative-AI chatbot using retrieval-augmented generation over research papers, crop tables and videos; deployed in Kenya, India, Ethiopia and Nigeria with over 15,000 farmers and 300,000 queries. Answers are knowledge-based but not tied to the farmer's own computed crop stage, water balance or local prices.
- B. Silva et al. (2023) [6]: GPT-4 answered 93% of agronomist certification exam questions correctly; retrieval and ensemble prompting improved results on exams from Brazil, India and the USA. Exam knowledge is general; numbers in answers are not checked against farm data, so field use still risks unsafe advice.
- Y. Gao et al. (2023) [5]: Reviews retrieval-augmented generation (RAG) methods and shows that grounding answers in retrieved documents reduces hallucination. General survey; does not address agricultural sources, regional languages or farm-specific context.
- R. K. Paul et al. (2022) [7]: Compared GRNN, SVR, Random Forest and Gradient Boosting with ARIMA on wholesale prices in 17 markets; GRNN performed best. Forecasting only; prices are not linked to the farmer's crop, location or decisions.
- J. Muñoz-Sabater et al. (2021) [8]: Hourly land-surface reanalysis at 9 km resolution from 1981 to the present. Data source only; used in this project for 15-year climate normals behind crop-suitability checks.
- L. Poggio et al. (2021) [9]: Global 250 m maps of soil pH, texture, organic carbon and more at six depths, with uncertainty estimates. Modelled estimates; used here as a soil fallback when a farmer has no Soil Health Card.
- D. Singh et al. (2020) [12]: Field-condition image dataset of plant diseases, created because models trained on laboratory images perform poorly in real fields. Motivates calibrated confidence and an honest 'not analysed' result instead of forced diagnoses.
- P. Lewis et al. (2020) [11]: Introduced RAG, combining a retriever with a generator so answers are grounded in retrieved passages. Foundation of the advisor's grounding approach; does not cover domain safety checks.

- Existing System
A review of currently available agricultural advisory platforms shows the following limitations:
Government Portals (Agmarknet, Kisan Suvidha, Meghdoot): Provide authentic prices, weather and advisories, but as separate services that are not personalised to a farmer's field.
Commercial Crop Apps: Offer photo-based disease identification but are often closed and may favour particular products.
General AI Chatbots: Answer fluently but are not tied to the farmer's data and can give ungrounded advice.
IoT Irrigation Prototypes: Use soil sensors that are costly to install and maintain for smallholders.
### 2.3 Comparative Analysis Table
| Parameter / Feature | Government Portals | Commercial Apps | General AI Chatbots | Proposed Smart Advisory System |
| --- | --- | --- | --- | --- |
| Personalised to Farm | No | Partly | No | Yes (location, soil, crop, sowing date) |
| Crop Stage and Water Need | No | No | No | Yes (GDD and FAO-56) |
| Crop Suitability by Season | No | No | No | Yes, with reasons |
| Grounded, Checked Answers | Not applicable | No | No | Yes (retrieval and number check) |
| Mandi Price Trends | Tables only | Rarely | No | Yes, with trend chart |
| Hardware Needed | None | Smartphone | None | None (web browser) |
| Cost to Farmer | Free | Free / paid | Free / paid | Free web application |



Chapter 3
Proposed System

3.1 Proposed Approach and System Architecture
The system follows a layered client-server design with four layers:
Frontend: React web application (Today, Advisor, Prices, Weather, Farm screens) in six languages.
Gateway: Express server that handles login and forwards requests to the backend.
Backend: FastAPI services for crop stage, water balance, crop suitability, the advisor, prices and weather.
Data and External Sources: Supabase PostgreSQL database; Agmarknet, Open-Meteo, IMD, SoilGrids and Groq AI.

Figure 3.1: System Architecture

3.2 System Functionalities (Module-Wise)

Figure 3.2: Block Diagram
Module 1: Farm Intelligence – Crop Stage, Water and Suitability
Farm setup with village search, GPS or district, soil, irrigation, crop and sowing date.
Crop growth stage from accumulated heat units (GDD), shown on a season timeline.
Daily water advice from the FAO-56 water balance: irrigate now, wait for rain or check soil.
Crop suitability for each season, marked suitable, possible with care, not recommended or not enough data, with reasons.
Soil estimate from ISRIC SoilGrids when no Soil Health Card is available.
Module 2: Grounded Advisor and Leaf-Photo Check
One chat that knows the farm: crop, stage, weather and soil are added to every question.
Answers use retrieved ICAR, IMD and Kisan Call Centre guidance, with sources shown.
Every number in an AI answer is checked against the farm data and sources.
Leaf photos can be checked in the same chat; uncertain results are clearly labelled.
Government schemes (PM-KISAN, PMFBY, KCC and more) in a Schemes view.

Figure 3.3: Advisor Answer Flow
Module 3: Mandi Prices and Weather
Mandi prices from Agmarknet / data.gov.in, updated twice daily by scheduled jobs.
Price trend shown as a rolling average, with each mandi report as a point.
Market comparison, crop margin and hold-vs-sell calculators.
7-day past and 7-day forecast weather (Open-Meteo, cross-checked with NASA POWER and OpenWeather).
This week's IMD agromet bulletin for the farm's district.
Stale or missing data is labelled and never filled with made-up values.

3.3 Innovation in Idea
Advice Grounded in the Farmer's Own Data: Crop stage, water balance and suitability are calculated with established formulas; the AI only explains them.
Number Checking: Every number in an AI answer is checked against the farm data and sources before it is shown.
Honest About Gaps: When data is missing, the system says so instead of guessing.
Crop Suitability Before Sowing: Location, soil, irrigation and season are combined into a clear verdict with reasons.

3.4 Project Timeline

Figure 3.4: Project Timeline (Gantt Chart)

### 3.5 Roles and Responsibilities
Parth Shah (Frontend and User Interface):
Built the React screens: Today, Advisor, Prices, Weather and Farm.
Designed the mobile-friendly layout and the six-language interface.
Built the price trend and weather charts using Recharts.
Jinay Shah (Backend and Agronomy Engines):
Built the FastAPI backend and the Supabase database schema.
Implemented the crop stage (GDD), FAO-56 water balance and crop suitability engines.
Integrated soil, climate and weather data services.
Parshva Doshi (AI Advisor):
Built the advisor's retrieval over ICAR, IMD and Kisan Call Centre guidance.
Connected Groq and Gemini AI models and the answer number check.
Built the leaf-photo check and the model training pipeline.
Yash Rana (Data Pipelines and Testing):
Built the mandi price, weather and IMD bulletin ingestion jobs.
Scheduled the jobs with GitHub Actions.
Wrote the automated backend tests.

Chapter 4
Implementation Details and Results

4.1 Technology Stack
Frontend: React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Recharts 3, i18next (6 languages)
Gateway: Node.js with Express 4 (login, rate limiting, API proxy)
Backend: Python, FastAPI, Pydantic v2, HTTPX, Pandas
Database: Supabase PostgreSQL with pgvector and full-text search
AI: Groq-hosted open models (primary), Google Gemini (fallback), MobileNetV2 training pipeline
Data sources: Agmarknet / data.gov.in, Open-Meteo (ERA5-Land), NASA POWER, OpenWeather, IMD bulletins, ISRIC SoilGrids, Kisan Call Centre Q&A
Automation: GitHub Actions scheduled jobs (prices, weather, IMD bulletins, pruning)

4.2 Implementation and Algorithmic Parameters
1. Growing Degree Days (GDD):
Daily heat units are GDD = max(0, (Tmax + Tmin) / 2 − Tbase), summed from the sowing date with crop-specific base temperatures. The total gives the crop's growth stage; a calendar estimate is used, and labelled, when weather history is missing.
2. FAO-56 Water Balance:
Crop water use is ETc = Kc × ET0, with the crop coefficient Kc set by growth stage. A daily root-zone balance tracks rain, irrigation and depletion to advise whether to irrigate now, wait for rain or check soil moisture.
3. Crop Suitability:
For each crop and season, average temperature and rainfall from 15-year ERA5-Land normals are compared with the crop's temperature range and seasonal water need (FAO), and the farm's soil type and pH are checked.
4. Grounded Advisor:
The question and farm context are used to retrieve relevant passages using vector and keyword search. The AI writes the answer from this material only, and an audit checks that every number in the answer appears in the farm data or sources.

4.3 Preliminary Results and System validation
Backend Automated Tests: 171 of 178 tests pass in an offline environment; the remaining 7 need a live database connection.
Frontend Type Check: tsc --noEmit reports 0 errors and the production build succeeds.
Data: More than 92,000 mandi price records for six crops across seven states, updated by scheduled jobs.
Working Features: Farm setup with crop suitability, Today dashboard, grounded advisor, prices and weather, in six languages.
Leaf-Photo Diagnosis: The training pipeline is ready; until a trained model is installed, photos are checked by an AI vision model and results are clearly labelled.
Next Step: Accuracy of answers and recommendations will be evaluated with agricultural experts and a farmer pilot.
Chapter 5
Sustainability Analysis and Testing
### 5.1 Sustainability Analysis
1. Environmental Sustainability:
Water Conservation: Stage-aware water advice from the FAO-56 water balance discourages over-irrigation.
Fewer Unnecessary Sprays: Grounded guidance from verified sources avoids unsafe or excess chemical use.
2. Economic Sustainability:
No Capital Investment: No hardware or subscription is needed; the system runs in a web browser.
Better Selling Decisions: Price trends and margin calculators help farmers decide when and where to sell.
3. Social Sustainability and Inclusivity:
A simple, mobile-friendly interface in six Indian languages and honest messages about missing data make the tool usable and trustworthy for farmers with varied digital literacy.
### 5.2 Testing Methodology and Verification
The system was verified at several levels:
Unit Testing: Crop stage, water balance, crop suitability, price series, weather fusion and answer checking are tested with known inputs.
Integration Testing: API endpoints are tested with simulated outages to confirm errors are reported instead of wrong data.
Interface Testing: Screens were checked on phone, tablet and desktop widths in a real browser.
Edge Cases: Missing weather, missing soil data, unsupported crops and unreachable AI services each produce a clear, labelled message.
Chapter 6
Conclusion and Future Scope
### 6.1 Conclusion
The AI-Driven Smart Agricultural Advisory System brings crop stage, water need, crop suitability, local weather, mandi prices and official guidance together in one web application:
It replaces guesswork in irrigation with the FAO-56 water balance and stage tracking from heat units.
It tells farmers which crops suit their field before sowing, with clear reasons.
It answers questions from verified ICAR, IMD and Kisan Call Centre guidance, with every number checked.
With 171 of 178 automated tests passing offline and all main features working end to end, the system is ready for expert review of its answers and a one-season farmer pilot.
### 6.2 Future Scope
Future enhancements planned for the system are:
WhatsApp and Voice: Questions and answers by voice in Indian languages over WhatsApp.
Satellite Crop Health: NDVI alerts for each field from Sentinel-2 imagery.
Groundwater Data: Groundwater and reservoir levels in irrigation advice.
Leaf-Disease Model: A model trained on Indian field images, and support for more crops.
Field Evaluation: Expert review of answers and a one-season farmer pilot.
References
[1] Directorate of Marketing and Inspection, "AGMARKNET: Agricultural Marketing Information Network," Ministry of Agriculture & Farmers Welfare, Govt. of India, 2026. [Online]. Available: https://agmarknet.gov.in/
[2] India Meteorological Department, "Gramin Krishi Mausam Sewa: District Agromet Advisory Bulletins," Ministry of Earth Sciences, Govt. of India, 2026. [Online]. Available: https://imdagrimet.gov.in/
[3] Indian Council of Agricultural Research, "Kharif Agro-Advisories for Farmers 2025," ICAR, New Delhi, India, 2025.
[4] N. Singh et al., "Farmer.Chat: Scaling AI-Powered Agricultural Services for Smallholder Farmers," arXiv:2409.08916, 2024.
[5] Y. Gao et al., "Retrieval-Augmented Generation for Large Language Models: A Survey," arXiv:2312.10997, 2023.
[6] B. Silva, L. Nunes, R. Estevão, V. Aski, and R. Chandra, "GPT-4 as an Agronomist Assistant? Answering Agriculture Exams Using Large Language Models," arXiv:2310.06225, 2023.
[7] R. K. Paul et al., "Machine learning techniques for forecasting agricultural prices: A case of brinjal in Odisha, India," PLOS ONE, vol. 17, no. 7, p. e0270553, 2022, doi: 10.1371/journal.pone.0270553.
[8] J. Muñoz-Sabater et al., "ERA5-Land: a state-of-the-art global reanalysis dataset for land applications," Earth System Science Data, vol. 13, pp. 4349–4383, 2021, doi: 10.5194/essd-13-4349-2021.
[9] L. Poggio et al., "SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty," SOIL, vol. 7, pp. 217–240, 2021, doi: 10.5194/soil-7-217-2021.
[10] H. Hersbach et al., "The ERA5 global reanalysis," Quarterly Journal of the Royal Meteorological Society, vol. 146, no. 730, pp. 1999–2049, 2020, doi: 10.1002/qj.3803.
[11] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," in Advances in Neural Information Processing Systems (NeurIPS), vol. 33, pp. 9459–9474, 2020.
[12] D. Singh, N. Jain, P. Jain, P. Kayal, S. Kumawat, and N. Batra, "PlantDoc: A Dataset for Visual Plant Disease Detection," in Proc. 7th ACM IKDD CoDS and 25th COMAD, 2020, pp. 249–253.