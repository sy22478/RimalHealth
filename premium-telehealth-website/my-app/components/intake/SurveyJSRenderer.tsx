'use client';

/**
 * SurveyJS Renderer (Phase 1 dependency spike).
 *
 * Minimal client wrapper that renders a config-driven SurveyJS model from a
 * JSON prop and reports the result via onComplete. This exists to de-risk
 * SurveyJS under React 19 + Next.js standalone/Turbopack; the real GLP-1 form
 * JSON arrives in Phase 2. The hardcoded SAMPLE_SURVEY_JSON only proves the
 * library builds and renders — it is not the production weight-management form.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/survey-core.css';

/** A SurveyJS form definition (the JSON config that drives the rendered form). */
export type SurveyJSON = Record<string, unknown>;

/** Answers collected when the survey is completed, keyed by question name. */
export type SurveyResult = Record<string, unknown>;

export interface SurveyJSRendererProps {
  /** SurveyJS form definition. Falls back to a 2-question sample (spike only). */
  json?: SurveyJSON;
  /** Called with the collected answers when the respondent completes the form. */
  onComplete?: (result: SurveyResult) => void;
}

// Throwaway 2-question survey: proves the dependency renders end to end.
const SAMPLE_SURVEY_JSON: SurveyJSON = {
  title: 'SurveyJS Spike',
  description: 'Phase 1 smoke test — replaced by the real GLP-1 form in Phase 2.',
  elements: [
    {
      type: 'text',
      name: 'sampleName',
      title: 'What is your name?',
      isRequired: true,
    },
    {
      type: 'radiogroup',
      name: 'sampleReady',
      title: 'Ready to continue?',
      choices: ['Yes', 'No'],
    },
  ],
};

export function SurveyJSRenderer({ json, onComplete }: SurveyJSRendererProps) {
  const survey = useMemo(() => new Model(json ?? SAMPLE_SURVEY_JSON), [json]);

  const handleComplete = useCallback(
    (sender: Model) => {
      onComplete?.(sender.data as SurveyResult);
    },
    [onComplete]
  );

  useEffect(() => {
    survey.onComplete.add(handleComplete);
    return () => {
      survey.onComplete.remove(handleComplete);
    };
  }, [survey, handleComplete]);

  return <Survey model={survey} />;
}

export default SurveyJSRenderer;
