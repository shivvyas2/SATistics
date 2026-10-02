/**
 * Concept lessons for every course topic: the core ideas, one worked example,
 * the traps that cost points, and a quick check question.
 */

import type { ExamId, SectionId } from '@/lib/exam'
import { COURSES } from '@/lib/courses'

export interface Lesson {
  exam: ExamId
  section: SectionId
  topic: string
  summary: string
  ideas: { title: string; body: string }[]
  example: { prompt: string; steps: string[]; answer: string }
  traps: string[]
  check: { question: string; options: string[]; correctAnswer: number; explanation: string }
}

type LessonContent = Omit<Lesson, 'exam' | 'section'>

const SAT_MATH: LessonContent[] = [
  {
    topic: 'Algebra',
    summary: 'Linear equations, inequalities, systems and linear functions. About a third of SAT Math.',
    ideas: [
      { title: 'Read y = mx + b as a story', body: 'm is the rate of change (per month, per mile), b is the starting value. In word problems, the fixed fee is b and the per-unit cost is m.' },
      { title: 'Systems are about intersections', body: 'The solution is where the lines cross. Same slope and different intercepts means no solution; equivalent equations mean infinitely many.' },
      { title: 'Solve for what is asked', body: 'If the question wants 6x, find 3x and double it. Often you never need x itself.' },
      { title: 'Flip the inequality', body: 'Multiplying or dividing both sides by a negative number reverses the inequality sign.' },
    ],
    example: {
      prompt: 'A gym charges a $40 sign-up fee plus $25 per month. Write the total cost C after m months, and find the cost for 6 months.',
      steps: ['The one-time fee is the starting value: b = 40.', 'The monthly charge is the rate: m = 25.', 'So C = 25m + 40.', 'For 6 months: C = 25(6) + 40 = 150 + 40 = 190.'],
      answer: 'C = 25m + 40, which is $190 after 6 months.',
    },
    traps: ['Swapping the rate and the starting value in word problems.', 'Forgetting to flip an inequality after dividing by a negative.', 'Solving for x when the question asks for an expression like 2x + 1.'],
    check: {
      question: 'The system 2x + 3y = 6 and 4x + ky = 10 has no solution. What is the value of k?',
      options: ['3', '6', '12', '−6'],
      correctAnswer: 1,
      explanation: 'No solution means parallel lines: the x and y coefficients are proportional but the constants aren’t. 4/2 = k/3 gives k = 6, and 10 is not 2 × 6, so the lines never meet.',
    },
  },
  {
    topic: 'Advanced Math',
    summary: 'Quadratics, exponentials, polynomials and equivalent expressions.',
    ideas: [
      { title: 'Each quadratic form shows something', body: 'Standard ax² + bx + c shows the y-intercept c. Factored a(x − r)(x − s) shows the zeros r and s. Vertex a(x − h)² + k shows the vertex (h, k).' },
      { title: 'The discriminant counts solutions', body: 'b² − 4ac > 0 gives two real solutions, = 0 gives one, < 0 gives none.' },
      { title: 'Exponential models', body: 'In a·bᵗ, a is the starting amount. Growth of r% uses b = 1 + r; decay of r% uses b = 1 − r.' },
      { title: 'Use Desmos', body: 'The built-in graphing calculator finds intersections, vertices and zeros faster than algebra on most of these.' },
    ],
    example: {
      prompt: 'What is the minimum value of f(x) = x² − 6x + 5?',
      steps: ['Complete the square: take half of −6, which is −3, and square it to get 9.', 'x² − 6x + 5 = (x² − 6x + 9) − 9 + 5 = (x − 3)² − 4.', 'In vertex form the vertex is (3, −4), and a = 1 > 0 so the parabola opens up.'],
      answer: 'The minimum value is −4, at x = 3.',
    },
    traps: ['Reading (x − 3)² as h = −3. The vertex is at x = +3.', 'Using 1 + r for a percent decrease.', 'Reporting one root when the question asks for the sum or product of both.'],
    check: {
      question: 'For what value of c does x² + 8x + c = 0 have exactly one real solution?',
      options: ['4', '8', '16', '64'],
      correctAnswer: 2,
      explanation: 'Exactly one solution means the discriminant is zero: 8² − 4(1)(c) = 0, so 64 = 4c and c = 16.',
    },
  },
  {
    topic: 'Problem-Solving and Data Analysis',
    summary: 'Ratios, rates, percentages, statistics, probability and reading data.',
    ideas: [
      { title: 'Let units cancel', body: 'Write rates as fractions with units (miles/hour) and multiply so the units you don’t want cancel out.' },
      { title: 'Percent change has a base', body: 'Percent change = (new − old) / old. Successive changes multiply: up 25% then down 20% is 1.25 × 0.8 = 1.' },
      { title: 'Mean versus median', body: 'Outliers drag the mean; the median barely moves. Range and standard deviation describe spread.' },
      { title: 'Watch the denominator', body: 'In a two-way table, “given that” restricts you to one row or column. Use that group’s total, not the grand total.' },
    ],
    example: {
      prompt: 'A jacket’s price rises from $80 to $100, then is discounted 20%. What is the final price, and what is the overall percent change?',
      steps: ['The rise is (100 − 80) / 80 = 25%.', 'The discount is taken from $100: 100 × 0.8 = 80.', 'Final price $80 equals the original, so the overall change is 0%.'],
      answer: '$80, a 0% overall change. The 25% rise and 20% drop use different bases.',
    },
    traps: ['Computing percent change against the new value.', 'Using the grand total for a conditional probability.', 'Claiming cause and effect from an observational study. Only random assignment supports that.'],
    check: {
      question: 'The data set is 2, 3, 3, 4, 18. If 18 is removed, what happens?',
      options: ['The mean decreases more than the median', 'The median decreases more than the mean', 'Both decrease by the same amount', 'Neither changes'],
      correctAnswer: 0,
      explanation: 'The mean goes from 30/5 = 6 to 12/4 = 3. The median goes from 3 to (3 + 3)/2 = 3, so it doesn’t change at all.',
    },
  },
  {
    topic: 'Geometry and Trigonometry',
    summary: 'Area and volume, triangles, circles and right-triangle trigonometry.',
    ideas: [
      { title: 'Special right triangles', body: '45-45-90 sides are x, x, x√2. 30-60-90 sides are x, x√3, 2x. Both are on the reference sheet.' },
      { title: 'SOH-CAH-TOA and complements', body: 'sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent. For the two acute angles of a right triangle, sin A = cos B.' },
      { title: 'Circle equations', body: '(x − h)² + (y − k)² = r² has center (h, k) and radius r. If the equation is expanded, complete the square for x and y.' },
      { title: 'Similar figures scale', body: 'If side lengths scale by k, areas scale by k² and volumes by k³.' },
    ],
    example: {
      prompt: 'Find the center and radius of the circle x² + y² − 6x + 4y − 12 = 0.',
      steps: ['Group terms: (x² − 6x) + (y² + 4y) = 12.', 'Complete each square: add 9 and 4 to both sides.', '(x − 3)² + (y + 2)² = 25.'],
      answer: 'Center (3, −2), radius 5.',
    },
    traps: ['Getting the sign of the center wrong: (y + 2)² means k = −2.', 'Reporting r² as the radius.', 'Mixing degrees and radians: 180° = π radians.'],
    check: {
      question: 'In right triangle ABC, angle C is 90° and sin A = 3/5. What is cos B?',
      options: ['3/5', '4/5', '3/4', '5/3'],
      correctAnswer: 0,
      explanation: 'A and B are complementary, so cos B = sin A = 3/5. The side opposite A is the side adjacent to B.',
    },
  },
]

const SAT_RW: LessonContent[] = [
  {
    topic: 'Information and Ideas',
    summary: 'Central ideas, details, inferences and using textual or data evidence.',
    ideas: [
      { title: 'Only the text counts', body: 'The right answer is supported by the passage. A choice can be true in real life and still be wrong.' },
      { title: 'Central idea versus detail', body: 'The main idea is what the whole text supports. A choice that matches one sentence is usually a detail.' },
      { title: 'Evidence must hit the claim', body: 'For “which finding would support…”, restate the exact claim first, then pick the choice that proves that claim, not a related one.' },
      { title: 'Read graphs against the claim', body: 'Quantitative evidence answers must be true according to the data and relevant to the claim. Check every part of the choice.' },
    ],
    example: {
      prompt: 'Bees exposed to a common pesticide visited 30% fewer flowers, yet their colonies made as much honey over a season as unexposed colonies. Which choice most logically completes: “This suggests that ___”?',
      steps: ['Spot the tension: less foraging per bee, but the same honey.', 'Rule out choices that overreach, like “the pesticide is harmless to bees.”', 'Pick the modest explanation that resolves the tension.'],
      answer: '“Colonies may make up for reduced foraging by individual bees.”',
    },
    traps: ['Choosing an answer that is true but not stated or implied.', 'Extreme wording like “proves” or “always.”', 'A data choice that is accurate but doesn’t address the claim.'],
    check: {
      question: 'Claim: students who slept at least 8 hours scored higher on the exam. Which finding most directly supports it?',
      options: ['The average score of students who slept 8+ hours was higher than that of students who slept less', 'Most students slept fewer than 8 hours', 'Students who studied more scored higher', 'Average scores rose over the school year'],
      correctAnswer: 0,
      explanation: 'Only the first choice compares the two sleep groups’ scores, which is exactly what the claim is about.',
    },
  },
  {
    topic: 'Craft and Structure',
    summary: 'Words in context, the purpose and structure of a text, and connecting two texts.',
    ideas: [
      { title: 'Predict the word first', body: 'Cover the choices, use the clues around the blank to pick your own word, then find the closest match.' },
      { title: 'Purpose is a verb', body: 'Ask what the text does: argues, contrasts, illustrates, challenges. Answers that only describe part of the text are wrong.' },
      { title: 'Structure means relationships', body: 'Describe how the parts connect, for example “presents a view, then offers evidence against it.”' },
      { title: 'Cross-text questions', body: 'Find the specific point both texts discuss, then decide whether the second author agrees, disagrees or qualifies it.' },
    ],
    example: {
      prompt: 'The critic found the novel’s ending ___: after 300 pages of careful build-up, the final chapter resolves every conflict in two hurried paragraphs. (abrupt / inevitable / ambiguous / elaborate)',
      steps: ['The clue is “two hurried paragraphs” after a long build-up.', 'Predict a word like “sudden.”', 'Only “abrupt” matches.'],
      answer: 'abrupt',
    },
    traps: ['Picking a familiar word in its everyday meaning instead of the meaning the context needs.', 'A purpose answer that fits one sentence but not the whole text.', 'Cross-text choices that misstate one author’s view.'],
    check: {
      question: 'Though the city’s new transit plan was ___ on paper, its rollout was plagued by delays and cost overruns.',
      options: ['promising', 'chaotic', 'costly', 'outdated'],
      correctAnswer: 0,
      explanation: '“Though” signals a contrast with the delays and overruns, so the blank needs a positive word: promising.',
    },
  },
  {
    topic: 'Expression of Ideas',
    summary: 'Transitions and rhetorical synthesis from student notes.',
    ideas: [
      { title: 'Name the relationship', body: 'Before choosing a transition, decide how the sentences relate: contrast (however), cause (therefore), addition (moreover), example (for instance) or sequence (subsequently).' },
      { title: 'Read both sides', body: 'Read the sentence before and the sentence with the blank. The transition describes how the second relates to the first.' },
      { title: 'Synthesis questions: goal first', body: 'Read the goal in the question before the notes. Every choice is accurate; only one does exactly what the goal says.' },
    ],
    example: {
      prompt: 'The bridge was designed to last 100 years. ___, corrosion forced engineers to close it after just 40.',
      steps: ['First sentence: the expectation. Second: what actually happened.', 'Expectation versus reality is a contrast.', 'Choose a contrast transition.'],
      answer: 'However',
    },
    traps: ['Choosing a transition because it sounds formal.', 'Synthesis answers that are true but serve a different goal, like stressing a similarity when the goal is a difference.'],
    check: {
      question: 'Octopuses can change color in milliseconds. ___, some species can also change the texture of their skin to mimic rocks or coral.',
      options: ['However', 'Moreover', 'Therefore', 'In contrast'],
      correctAnswer: 1,
      explanation: 'The second sentence adds another camouflage ability (“also”), so the relationship is addition: Moreover.',
    },
  },
  {
    topic: 'Standard English Conventions',
    summary: 'Sentence boundaries, punctuation, agreement, verb forms and modifiers.',
    ideas: [
      { title: 'Joining two complete sentences', body: 'Use a period, a semicolon, or a comma plus and/but/so. A comma alone is a comma splice.' },
      { title: 'Colons follow a complete clause', body: 'A colon introduces an explanation or list, and what comes before it must be able to stand alone.' },
      { title: 'Find the true subject', body: 'Ignore phrases between the subject and verb. “The box of crayons is” agrees with box, not crayons.' },
      { title: 'Don’t split the core', body: 'No punctuation between a subject and its verb, or a verb and its object.' },
    ],
    example: {
      prompt: 'The committee of teachers ___ voted to extend the school day. (have / has)',
      steps: ['Strip the phrase “of teachers.”', 'The subject is “committee,” which is singular.', 'Singular subject takes “has.”'],
      answer: 'has',
    },
    traps: ['Comma splices between two complete sentences.', 'A semicolon before a phrase that can’t stand alone.', 'Making the verb agree with the nearest noun.'],
    check: {
      question: 'Which choice completes the text correctly? “Marie Curie won two Nobel Prizes___ one in physics and one in chemistry.”',
      options: ['Prizes: one', 'Prizes; one', 'Prizes, and one', 'Prizes one'],
      correctAnswer: 0,
      explanation: 'The first part is a complete sentence and the second part explains it, so a colon fits. “one in physics…” can’t stand alone, which rules out the semicolon.',
    },
  },
]

const GRE_QUANT: LessonContent[] = [
  {
    topic: 'Arithmetic',
    summary: 'Number properties, exponents, remainders, percents and Quantitative Comparison strategy.',
    ideas: [
      { title: 'Know your number properties', body: 'Even ± even and odd ± odd are even. 2 is the only even prime, and 1 is not prime. Squaring a fraction between 0 and 1 makes it smaller.' },
      { title: 'Exponent rules', body: 'aᵐ · aⁿ = aᵐ⁺ⁿ, (aᵐ)ⁿ = aᵐⁿ, a⁻ⁿ = 1/aⁿ. A negative base to an even power is positive.' },
      { title: 'Remainders cycle', body: 'Powers repeat their remainders. Find the cycle with small powers, then jump ahead.' },
      { title: 'Quantitative Comparison', body: 'Test easy cases, then strange ones: 0, negatives, fractions. If two cases give different answers, the answer is D.' },
    ],
    example: {
      prompt: 'x is an integer and x² = 9. Quantity A: x. Quantity B: 2.',
      steps: ['x can be 3 or −3.', 'If x = 3, A is greater.', 'If x = −3, B is greater.'],
      answer: 'D: the relationship cannot be determined.',
    },
    traps: ['Assuming variables are positive integers.', 'Counting 1 as a prime.', 'Picking C in Quantitative Comparison after testing only one case.'],
    check: {
      question: 'What is the remainder when 2¹⁰ is divided by 7?',
      options: ['0', '1', '2', '4', '6'],
      correctAnswer: 2,
      explanation: '2³ = 8 leaves remainder 1. 2¹⁰ = (2³)³ · 2, which leaves 1 · 1 · 1 · 2 = 2.',
    },
  },
  {
    topic: 'Algebra',
    summary: 'Equations, inequalities, absolute value, functions and special products.',
    ideas: [
      { title: 'Special products save time', body: '(a + b)² = a² + 2ab + b², and a² − b² = (a + b)(a − b). The GRE builds questions around them.' },
      { title: 'Absolute value has two cases', body: '|x − a| < b means a − b < x < a + b. |x − a| > b means x is outside that interval.' },
      { title: 'Careful with inequalities', body: 'Don’t multiply or divide by a variable unless you know its sign.' },
      { title: 'Symbol functions', body: 'For a made-up operation like a ◆ b = 2a − b, just substitute carefully in order.' },
    ],
    example: {
      prompt: 'If x + y = 7 and x − y = 3, what is x² − y²?',
      steps: ['Recognize x² − y² = (x + y)(x − y).', 'Substitute: 7 × 3.'],
      answer: '21. You never need x and y themselves.',
    },
    traps: ['Solving for each variable when an identity is faster.', 'Forgetting the negative case of an absolute value.', 'Dividing an inequality by a variable of unknown sign.'],
    check: {
      question: 'Which describes all solutions of |2x − 4| < 6?',
      options: ['−2 < x < 5', '−1 < x < 5', 'x < 5', '−5 < x < 2', 'x > −2'],
      correctAnswer: 1,
      explanation: 'Rewrite as −6 < 2x − 4 < 6. Add 4 to every part: −2 < 2x < 10. Divide by 2: −1 < x < 5.',
    },
  },
  {
    topic: 'Geometry',
    summary: 'Triangles, polygons, circles and coordinate geometry.',
    ideas: [
      { title: 'Triangle rules', body: 'Angles sum to 180°. Any side is less than the sum and more than the difference of the other two.' },
      { title: 'Polygons', body: 'Interior angles of an n-sided polygon sum to (n − 2) × 180°.' },
      { title: 'Circles', body: 'Area πr², circumference 2πr. An inscribed angle is half the central angle on the same arc.' },
      { title: 'Not drawn to scale', body: 'Trust only the given information. A figure that looks like a right angle might not be one.' },
    ],
    example: {
      prompt: 'What is each interior angle of a regular hexagon?',
      steps: ['A hexagon has 6 sides: (6 − 2) × 180° = 720°.', 'Regular means all angles are equal: 720° ÷ 6.'],
      answer: '120°',
    },
    traps: ['Trusting how the figure looks.', 'Mixing up radius and diameter.', 'Forgetting the triangle inequality.'],
    check: {
      question: 'Two sides of a triangle are 5 and 9. Which could be the third side?',
      options: ['3', '4', '10', '14', '15'],
      correctAnswer: 2,
      explanation: 'The third side must be between 9 − 5 = 4 and 9 + 5 = 14, not including either. Only 10 fits.',
    },
  },
  {
    topic: 'Data Analysis',
    summary: 'Statistics, probability, counting and reading data graphics.',
    ideas: [
      { title: 'Spread', body: 'Adding a constant to every value doesn’t change the standard deviation. Multiplying every value by k multiplies it by |k|.' },
      { title: 'Probability', body: 'Independent events: P(A and B) = P(A) × P(B). Either event: P(A or B) = P(A) + P(B) − P(A and B).' },
      { title: 'Counting', body: 'Order matters: permutations n!/(n − k)!. Order doesn’t matter: combinations n!/(k!(n − k)!).' },
      { title: 'Data interpretation', body: 'Read titles, units and scales before the numbers, and estimate when the choices are far apart.' },
    ],
    example: {
      prompt: 'How many different 3-person committees can be chosen from 6 students?',
      steps: ['A committee has no order, so use combinations.', 'C(6, 3) = 6! / (3! × 3!) = 720 / 36.'],
      answer: '20',
    },
    traps: ['Using permutations when order doesn’t matter.', 'Adding probabilities of events that can happen together without subtracting the overlap.', 'Missing a scale break or unit on a graph.'],
    check: {
      question: 'A data set has a standard deviation of 4. Each value is increased by 10 and then doubled. What is the new standard deviation?',
      options: ['4', '8', '14', '18', '28'],
      correctAnswer: 1,
      explanation: 'Adding 10 doesn’t change the spread. Doubling every value doubles it: 4 × 2 = 8.',
    },
  },
]

const GRE_VERBAL: LessonContent[] = [
  {
    topic: 'Text Completion',
    summary: 'One to three blanks in a short passage, each with its own set of choices.',
    ideas: [
      { title: 'Cover the choices', body: 'Read the sentence, find the clue, and predict your own word before looking.' },
      { title: 'Signal words steer you', body: 'Although, but and despite flip direction. Because, thus and in fact continue it.' },
      { title: 'Start with the easiest blank', body: 'In multi-blank items, fill the blank with the strongest clue first, then use it to solve the others.' },
      { title: 'Reread the whole thing', body: 'With your choices in place, the passage should read logically from start to finish.' },
    ],
    example: {
      prompt: 'Although the scientist’s early papers were largely ___, her later work was celebrated for its originality.',
      steps: ['“Although” sets up a contrast.', 'The later work is original, so the early papers were the opposite.', 'Predict “unoriginal” and look for a match.'],
      answer: 'derivative',
    },
    traps: ['Picking a word that fits the blank alone but not the whole sentence.', 'Missing a reversal word like “although.”', 'Solving blanks strictly in order when a later one has the clearer clue.'],
    check: {
      question: 'The senator’s speech was so ___ that even her supporters struggled to stay awake.',
      options: ['soporific', 'incendiary', 'laconic', 'inspiring', 'controversial'],
      correctAnswer: 0,
      explanation: 'Supporters struggling to stay awake points to a dull, sleep-inducing speech: soporific.',
    },
  },
  {
    topic: 'Sentence Equivalence',
    summary: 'Pick two words that both fit the sentence and give it the same meaning.',
    ideas: [
      { title: 'Predict, then pair', body: 'Predict a word from the clues, then find the two choices that match your prediction.' },
      { title: 'Both must fit', body: 'You need both correct answers for credit. Each word must work on its own in the sentence.' },
      { title: 'Beware lone synonym pairs', body: 'Test writers include synonym pairs that don’t fit the sentence. Meaning in context comes first.' },
    ],
    example: {
      prompt: 'The manager’s ___ approach to spending, questioning every purchase, kept the company afloat. (frugal, lavish, parsimonious, careless, generous, impulsive)',
      steps: ['The clue “questioning every purchase” means careful with money.', 'Predict “thrifty.”', 'Frugal and parsimonious both mean sparing with money.'],
      answer: 'frugal and parsimonious',
    },
    traps: ['Choosing a synonym pair that doesn’t fit the clue.', 'Choosing one right word and one near miss.'],
    check: {
      question: 'Despite his ___ reputation, the critic praised the debut novel warmly. Which pair completes the sentence?',
      options: ['harsh, severe', 'kind, generous', 'harsh, lenient', 'famous, obscure', 'severe, generous'],
      correctAnswer: 0,
      explanation: '“Despite” contrasts the reputation with warm praise, so the reputation is negative. Harsh and severe both fit and mean the same.',
    },
  },
  {
    topic: 'Reading Comprehension',
    summary: 'Dense academic passages with questions on purpose, inference and argument.',
    ideas: [
      { title: 'Read for the argument', body: 'Track the main point, the author’s attitude and how each paragraph serves the argument.' },
      { title: 'Map as you go', body: 'Sum up each paragraph in a few words so you can find details fast.' },
      { title: 'Stay inside the passage', body: 'Inference answers must be strongly supported by the text, not by outside knowledge.' },
      { title: 'Know the formats', body: 'Some questions say “select all that apply,” and some ask you to select a sentence in the passage.' },
    ],
    example: {
      prompt: 'Many historians attribute the trade city’s decline to the silting of its harbor. Yet records show ship traffic fell sharply a decade before the silting began, suggesting that shifting trade routes, not geography, set the decline in motion. What is the author’s main purpose?',
      steps: ['Paragraph map: common view, then counter-evidence, then alternative cause.', 'The author is disputing the standard explanation.', 'The tool is timing: the decline came before the supposed cause.'],
      answer: 'To challenge a common explanation using chronological evidence.',
    },
    traps: ['Answers that are true but only describe one sentence.', 'Inferences that need outside knowledge.', 'Extreme language the author never uses.'],
    check: {
      question: 'Using the passage above, which finding would most strengthen the author’s argument?',
      options: ['A rival port’s traffic rose in the same decade the city’s traffic fell', 'The harbor silted faster than historians estimated', 'Historians agree the silting happened', 'The city’s population grew during the decline', 'Ships of the period were larger than earlier ones'],
      correctAnswer: 0,
      explanation: 'Traffic moving to a rival port at the same time supports the idea that trade routes shifted, which is the author’s alternative cause.',
    },
  },
]

const BY_COURSE: Record<string, LessonContent[]> = {
  'sat:quant': SAT_MATH,
  'sat:verbal': SAT_RW,
  'gre:quant': GRE_QUANT,
  'gre:verbal': GRE_VERBAL,
}

export const LESSONS: Lesson[] = COURSES.flatMap((course) =>
  (BY_COURSE[`${course.exam}:${course.section}`] ?? []).map((content) => ({ ...content, exam: course.exam, section: course.section }))
)

export function topicSlug(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function lessonHref(exam: ExamId, topic: string): string {
  return `/learn/${exam}/${topicSlug(topic)}`
}

export function findLesson(exam: string, slug: string): Lesson | undefined {
  return LESSONS.find((l) => l.exam === exam && topicSlug(l.topic) === slug)
}
