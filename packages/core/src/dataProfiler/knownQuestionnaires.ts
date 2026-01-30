import type { QuestionnaireSignature } from './types';

/**
 * Built-in questionnaire signatures for auto-detection.
 * Matched against column names in the dataset.
 */
export const KNOWN_QUESTIONNAIRES: QuestionnaireSignature[] = [
  {
    name: 'System Usability Scale (SUS)',
    columnPatterns: [/sus[_\s.-]?\d{1,2}/i, /usability[_\s.-]?\d{1,2}/i],
    expectedItemCount: 10,
    scaleRange: [1, 5],
    scoringMethod: 'sus_standard',
    reference: 'Brooke, J. (1996). SUS: A "quick and dirty" usability scale.',
  },
  {
    name: 'NASA Task Load Index (NASA-TLX)',
    columnPatterns: [
      /tlx/i, /mental[_\s.-]?demand/i, /physical[_\s.-]?demand/i,
      /temporal[_\s.-]?demand/i, /performance/i, /effort/i, /frustration/i,
    ],
    expectedItemCount: 6,
    scaleRange: [0, 100],
    scoringMethod: 'nasa_tlx_raw',
    reference: 'Hart, S. G., & Staveland, L. E. (1988). Development of NASA-TLX.',
  },
  {
    name: 'User Experience Questionnaire (UEQ)',
    columnPatterns: [
      /ueq/i, /attractiveness/i, /perspicuity/i,
      /efficiency/i, /dependability/i, /stimulation/i, /novelty/i,
    ],
    expectedItemCount: 26,
    scaleRange: [-3, 3],
    scoringMethod: 'ueq_standard',
    reference: 'Laugwitz, B., Held, T., & Schrepp, M. (2008). Construction and evaluation of UEQ.',
  },
  {
    name: 'AttrakDiff',
    columnPatterns: [/attrakdiff/i, /pragmatic[_\s.-]?quality/i, /hedonic[_\s.-]?quality/i],
    expectedItemCount: 28,
    scaleRange: [-3, 3],
    scoringMethod: 'attrakdiff_standard',
    reference: 'Hassenzahl, M., Burmester, M., & Koller, F. (2003). AttrakDiff.',
  },
  {
    name: 'Post-Study System Usability Questionnaire (PSSUQ)',
    columnPatterns: [/pssuq/i],
    expectedItemCount: 16,
    scaleRange: [1, 7],
    scoringMethod: 'pssuq_standard',
    reference: 'Lewis, J. R. (1992). Psychometric evaluation of PSSUQ.',
  },
  {
    name: 'UMUX-LITE',
    columnPatterns: [/umux/i],
    expectedItemCount: 2,
    scaleRange: [1, 7],
    scoringMethod: 'umux_lite',
    reference: 'Lewis, J. R., Utesch, B. S., & Maher, D. E. (2013). UMUX-LITE.',
  },
  {
    name: 'Creativity Support Index (CSI)',
    columnPatterns: [/csi/i, /creativity[_\s.-]?support/i],
    expectedItemCount: 12,
    scaleRange: [1, 10],
    scoringMethod: 'csi_standard',
    reference: 'Cherry, E., & Latulipe, C. (2014). Quantifying the Creativity Support Index.',
  },
];
