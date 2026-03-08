/**
 * Intake Question Definitions
 * Dynamic question sets for alcohol assessment
 * 
 * @module lib/intake/questions
 */

import { Question, QuestionSection } from '@/types/intake';

// ============================================================================
// AUDIT-C Questions (Alcohol Use Disorders Identification Test - Consumption)
// Validated screening tool for alcohol use disorders
// Score range: 0-12 (higher = more severe)
// ============================================================================

export const AUDIT_C_QUESTIONS: Question[] = [
  {
    id: 'audit_1',
    type: 'select',
    label: 'How often do you have a drink containing alcohol?',
    helpText: 'A "drink" is a can or bottle of beer, a glass of wine, or a shot of liquor.',
    required: true,
    options: [
      { value: '0', label: 'Never', score: 0 },
      { value: '1', label: 'Monthly or less', score: 1 },
      { value: '2', label: '2-4 times a month', score: 2 },
      { value: '3', label: '2-3 times a week', score: 3 },
      { value: '4', label: '4 or more times a week', score: 4 },
    ],
  },
  {
    id: 'audit_2',
    type: 'select',
    label: 'How many drinks containing alcohol do you have on a typical day when you are drinking?',
    helpText: 'Count each drink separately. One standard drink = 12 oz beer, 5 oz wine, or 1.5 oz liquor.',
    required: true,
    options: [
      { value: '0', label: '1 or 2', score: 0 },
      { value: '1', label: '3 or 4', score: 1 },
      { value: '2', label: '5 or 6', score: 2 },
      { value: '3', label: '7 to 9', score: 3 },
      { value: '4', label: '10 or more', score: 4 },
    ],
  },
  {
    id: 'audit_3',
    type: 'select',
    label: 'How often do you have 6 or more drinks on one occasion?',
    helpText: 'This refers to any single occasion where you consume 6 or more standard drinks.',
    required: true,
    options: [
      { value: '0', label: 'Never', score: 0 },
      { value: '1', label: 'Less than monthly', score: 1 },
      { value: '2', label: 'Monthly', score: 2 },
      { value: '3', label: 'Weekly', score: 3 },
      { value: '4', label: 'Daily or almost daily', score: 4 },
    ],
  },
];

// ============================================================================
// Medical History Questions
// ============================================================================

export const MEDICAL_HISTORY_QUESTIONS: Question[] = [
  {
    id: 'isPregnant',
    type: 'radio',
    label: 'Are you currently pregnant or planning to become pregnant?',
    required: true,
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  {
    id: 'isPregnantDetails',
    type: 'textarea',
    label: 'Please provide details about your pregnancy',
    placeholder: 'How far along are you? Any complications?',
    dependsOn: { field: 'isPregnant', value: 'true' },
    required: false,
  },
  {
    id: 'hasSeizureHistory',
    type: 'radio',
    label: 'Have you ever been diagnosed with a seizure disorder or epilepsy?',
    helpText: 'This is important for medication safety.',
    required: true,
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  {
    id: 'seizureDetails',
    type: 'textarea',
    label: 'Please provide details about your seizure history',
    placeholder: 'When was your last seizure? What medications are you on?',
    dependsOn: { field: 'hasSeizureHistory', value: 'true' },
    required: false,
  },
  {
    id: 'hasPsychiatricHistory',
    type: 'radio',
    label: 'Have you ever been diagnosed with depression, anxiety, bipolar disorder, or other mental health conditions?',
    required: true,
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  {
    id: 'psychiatricDetails',
    type: 'textarea',
    label: 'Please provide details about your mental health history',
    placeholder: 'What conditions have you been diagnosed with? Are you currently receiving treatment?',
    dependsOn: { field: 'hasPsychiatricHistory', value: 'true' },
    required: false,
  },
  {
    id: 'hasLiverDisease',
    type: 'radio',
    label: 'Have you ever been diagnosed with liver disease or liver problems?',
    helpText: 'This is particularly important for alcohol use disorder treatment.',
    required: true,
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  {
    id: 'liverDiseaseDetails',
    type: 'textarea',
    label: 'Please provide details about your liver condition',
    dependsOn: { field: 'hasLiverDisease', value: 'true' },
    required: false,
  },
  {
    id: 'hasKidneyDisease',
    type: 'radio',
    label: 'Have you ever been diagnosed with kidney disease?',
    required: true,
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  {
    id: 'kidneyDiseaseDetails',
    type: 'textarea',
    label: 'Please provide details about your kidney condition',
    dependsOn: { field: 'hasKidneyDisease', value: 'true' },
    required: false,
  },
  {
    id: 'hasHeartCondition',
    type: 'radio',
    label: 'Do you have any heart conditions or cardiovascular disease?',
    required: true,
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  {
    id: 'heartConditionDetails',
    type: 'textarea',
    label: 'Please provide details about your heart condition',
    dependsOn: { field: 'hasHeartCondition', value: 'true' },
    required: false,
  },
  {
    id: 'otherConditions',
    type: 'textarea',
    label: 'Any other medical conditions we should know about?',
    placeholder: 'List any other conditions, surgeries, or health concerns',
    required: false,
  },
];

// ============================================================================
// Medications Questions
// ============================================================================

export const MEDICATIONS_QUESTIONS: Question[] = [
  {
    id: 'takingMedications',
    type: 'radio',
    label: 'Are you currently taking any medications?',
    helpText: 'Include prescription medications, over-the-counter drugs, vitamins, and supplements.',
    required: true,
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  {
    id: 'medicationList',
    type: 'textarea',
    label: 'Please list all current medications',
    placeholder: 'Include medication name, dosage, and how often you take it',
    dependsOn: { field: 'takingMedications', value: 'true' },
    required: true,
    helpText: 'Your physician needs this to avoid drug interactions.',
  },
  {
    id: 'medicationAllergies',
    type: 'textarea',
    label: 'Do you have any medication allergies?',
    placeholder: 'List any medications you are allergic to and the reaction you had',
    required: false,
  },
];

// ============================================================================
// Previous Treatment Questions
// ============================================================================

export const PREVIOUS_TREATMENT_QUESTIONS: Question[] = [
  {
    id: 'previousTreatment',
    type: 'radio',
    label: 'Have you previously tried to quit or cut down on drinking?',
    required: true,
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
  },
  {
    id: 'previousTreatmentDetails',
    type: 'textarea',
    label: 'Tell us about your previous quit attempts',
    placeholder: 'What methods did you try? What worked or didn\'t work? Why did you start again?',
    dependsOn: { field: 'previousTreatment', value: 'true' },
    required: false,
  },
  {
    id: 'previousMedications',
    type: 'textarea',
    label: 'Have you tried any medications for quitting in the past?',
    placeholder: 'Examples: Naltrexone, Antabuse, etc.',
    dependsOn: { field: 'previousTreatment', value: 'true' },
    required: false,
  },
];

// ============================================================================
// Alcohol-Specific Questions (Beyond AUDIT-C)
// ============================================================================

export const ALCOHOL_SPECIFIC_QUESTIONS: Question[] = [
  {
    id: 'alcoholQuitAttempts',
    type: 'select',
    label: 'How many times in the past year have you tried to quit or cut down on drinking?',
    required: true,
    options: [
      { value: '0', label: 'Never' },
      { value: '1', label: 'Once' },
      { value: '2', label: '2-3 times' },
      { value: '3', label: '4 or more times' },
    ],
  },
  {
    id: 'alcoholQuitDetails',
    type: 'textarea',
    label: 'Tell us about your previous attempts to quit or reduce drinking',
    placeholder: 'What triggered you to try? What made it difficult?',
    required: false,
  },
  {
    id: 'alcoholConcernLevel',
    type: 'select',
    label: 'How concerned are you about your drinking?',
    required: true,
    options: [
      { value: 'not', label: 'Not concerned' },
      { value: 'slightly', label: 'Slightly concerned' },
      { value: 'moderately', label: 'Moderately concerned' },
      { value: 'very', label: 'Very concerned' },
      { value: 'extremely', label: 'Extremely concerned' },
    ],
  },
];

// ============================================================================
// Section Definitions
// ============================================================================

export function getQuestionSections(): QuestionSection[] {
  return [
    {
      id: 'medical',
      title: 'Medical History',
      description: 'Important health information for safe treatment',
      questions: MEDICAL_HISTORY_QUESTIONS,
    },
    {
      id: 'medications',
      title: 'Current Medications',
      description: 'Medications and allergies',
      questions: MEDICATIONS_QUESTIONS,
    },
    {
      id: 'alcohol',
      title: 'Alcohol Assessment',
      description: 'Questions to understand your alcohol use',
      questions: [...AUDIT_C_QUESTIONS, ...ALCOHOL_SPECIFIC_QUESTIONS],
    },
    {
      id: 'previous',
      title: 'Previous Treatment',
      description: 'Have you tried to quit before?',
      questions: PREVIOUS_TREATMENT_QUESTIONS,
    },
  ];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all questions (flattened)
 */
export function getAllQuestions(): Question[] {
  const sections = getQuestionSections();
  return sections.flatMap(section => section.questions);
}

/**
 * Get a specific question by ID
 */
export function getQuestionById(id: string): Question | undefined {
  const questions = getAllQuestions();
  return questions.find(q => q.id === id);
}

/**
 * Get questions that have dependencies
 */
export function getConditionalQuestions(): Question[] {
  const questions = getAllQuestions();
  return questions.filter(q => q.dependsOn !== undefined);
}

/**
 * Check if a question should be shown based on form data
 */
export function shouldShowQuestion(question: Question, formData: Record<string, unknown>): boolean {
  if (!question.dependsOn) {
    return true;
  }

  const dependentValue = formData[question.dependsOn.field];
  return dependentValue === question.dependsOn.value;
}

/**
 * Get the score for a selected option
 */
export function getOptionScore(question: Question, selectedValue: string): number {
  if (!question.options) {
    return 0;
  }
  
  const option = question.options.find(opt => opt.value === selectedValue);
  return option?.score ?? 0;
}
