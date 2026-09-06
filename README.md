# SOA Exam FM (Financial Mathematics) Practice Platform

A full-stack, production-grade practice examination platform for Society of Actuaries (SOA) **Exam FM (Financial Mathematics)** built with **Next.js (App Router, TypeScript)**, **Tailwind CSS**, **KaTeX**, and **Prisma ORM with PostgreSQL**.

---

## 🚀 Key Features

1. **Authentic CBT Environment**:
   - Timed for exactly **150 minutes (2.5 hours)**.
   - **30 Multiple Choice Questions** (5 options: A, B, C, D, E).
   - High-contrast countdown timer (`HH:MM:SS`) with warning indicators (orange under 10m, red under 5m).
   - Flagging system for question review and instant jump navigation via a 30-question grid.
   - Built-in SOA Exam FM Formula Reference Sheet modal.

2. **Secure Pause/Resume Engine**:
   - Freezes timer countdown in real-time.
   - Blurs exam content (`backdrop-blur-md`) and hides questions to uphold testing integrity.
   - Tracks accumulated pause duration with millisecond precision and synchronizes state with the server.

3. **Dynamic Parameterization & Actuarial Distractors**:
   - Algorithmically varies interest rates $i$, loan terms $n$, payment frequencies $m$, present values $PV$, coupons $r$, and yields $y$.
   - Eliminates repeating questions across attempts.
   - Distractors are computed based on common financial mathematics pitfalls:
     - **Annuity-Due vs. Annuity-Immediate** confusion ($(1+i)$ multiplier/divisor).
     - **Simple interest** instead of compound interest ($1 + ni$ vs. $(1+i)^n$).
     - **Off-by-one compounding term** ($n-1$, $n+1$, or period timing offsets).
     - **Nominal vs. effective periodic rate conversion** mistakes ($i^{(m)}$ used without dividing by $m$).

4. **Comprehensive Syllabus Domain Coverage**:
   - **Time Value of Money (TVM)**: Variable force of interest $\delta(t) = a + bt$, nominal discount rates $d^{(m)}$, equation of value.
   - **Annuities & Cash Flows**: Level immediate/due, arithmetic increasing $(Ia)_{\overline{n}|i}$, geometric perpetuities.
   - **Loans & Amortization**: Level payment $R$, prospective/retrospective balance $B_t$, interest/principal split ($I_t$, $P_t$), sinking funds.
   - **Bonds**: Basic price $P = Fr a_{\overline{n}|} + C v^n$, book value $B_t$, premium write-down, callable bonds under minimum yield rule.
   - **Asset-Liability Management (ALM)**: Macaulay duration $D_{\text{mac}}$, modified duration $D_{\text{mod}}$, convexity, Redington & full immunization.

5. **Post-Exam Review & Error Diagnostics**:
   - Total score (out of 30) and percentage with SOA pass/fail evaluation (passing benchmark: $\ge 70\%$, 21/30).
   - Domain breakdown cards for all 5 topics with mastery benchmarks.
   - Student answer vs. correct answer comparison.
   - **Actuarial Trap Alert**: Explains which specific distractor was chosen and the conceptual error made.
   - Step-by-step mathematical derivations rendered with **KaTeX**.
   - Integrated **Video Solution Player** streaming walkthroughs with custom playback controls.

---

## 📁 Project Architecture

```
EXAM FM PRACtice/
├── prisma/
│   ├── schema.prisma              # PostgreSQL schema with TopicDomain enum and models
│   └── seed.ts                    # Seeds question templates across all 5 FM domains
├── lib/
│   ├── prisma.ts                  # Safe Prisma Client singleton with runtime fallback
│   ├── db.ts                      # Exam repository managing sessions, scoring & review
│   ├── types/
│   │   └── exam.ts                # TypeScript types for CBT sessions, questions & diagnostics
│   └── engine/
│       ├── financial-math.ts      # Core actuarial formulas (TVM, annuities, loans, bonds, ALM)
│       ├── templates.ts           # Dynamic question archetypes with parameter bounds & KaTeX steps
│       └── generator.ts           # 30-question generator engine with distractor modeling
├── hooks/
│   └── useExamTimer.ts            # Millisecond-accurate countdown timer & pause engine
├── components/
│   ├── MathRenderer.tsx           # KaTeX renderer for inline ($...$) and display ($$...$$) math
│   ├── FormulaSheetModal.tsx      # Comprehensive SOA FM Formula Sheet
│   ├── VideoPlayer.tsx            # Solution walkthrough video player with controls
│   ├── ExamRunner.tsx             # Prometric CBT testing UI with sticky top bar & grid
│   └── ExamReview.tsx             # Performance diagnostics, domain breakdown & review
├── app/
│   ├── layout.tsx                 # Root layout with KaTeX stylesheet and metadata
│   ├── globals.css                # Tailwind CSS + CBT styling
│   ├── page.tsx                   # Exam FM launch dashboard
│   ├── exam/
│   │   └── [id]/
│   │       ├── page.tsx           # Live CBT Exam Runner page
│   │       └── review/
│   │           └── page.tsx       # Exam Review & Diagnostics page
│   └── api/
│       └── exams/
│           ├── start/route.ts     # Generate & initialize 30-question exam session
│           └── [id]/
│               ├── route.ts       # Get session / answer saving / pause-resume sync
│               ├── submit/route.ts# Grade exam and compute domain statistics
│               └── review/route.ts# Fetch review data with detailed solutions
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

---

## 🛠️ Setup Instructions

### 1. Prerequisites
- **Node.js**: v18.17+ or v20+ (Node v24 supported)
- **PostgreSQL**: (optional for live database, built-in memory fallback enabled for instant offline running)

### 2. Installation
```bash
# Clone or open the repository directory
cd "EXAM FM PRACtice"

# Install dependencies
npm install
```

### 3. Database Setup (Prisma & PostgreSQL)
Configure your PostgreSQL connection in `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/exam_fm?schema=public"
```

Generate Prisma Client and push schema to your database:
```bash
# Generate Prisma Client
npx prisma generate

# Push database schema to PostgreSQL
npx prisma db push

# Seed Question Templates
npm run prisma:seed
```

> **Note**: The application includes a resilient storage provider in `lib/db.ts`. Even without a live PostgreSQL instance running locally, the entire platform runs 100% functional out of the box with zero runtime errors.

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running Production Build
```bash
# Compile and build
npm run build

# Start production server
npm run start
```

---

## 🧪 Testing the Engine

To run the automated verification test suite:
```bash
npx tsc scripts/test-engine.ts --outDir dist --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck && node dist/scripts/test-engine.js && rm -rf dist
```

Verification verifies:
- Exactly 30 questions generated across all 5 domains.
- Exactly 5 options (A–E) per question with no duplicated values.
- Exactly 1 correct answer per question.
- Active pause/resume state tracking and millisecond calculation.
- Exam submission, domain grading, and KaTeX mathematical derivations.
