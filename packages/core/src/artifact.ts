/**
 * Types of artifacts produced and consumed between pipeline phases.
 */
export enum ArtifactType {
  RESEARCH_PLAN      = 'research_plan',
  STUDY_PROTOCOL     = 'study_protocol',
  QUESTIONNAIRE      = 'questionnaire',
  VARIABLES          = 'variables',
  PERSONA_PROFILE    = 'persona_profile',
  PERSONA_CONTEXT    = 'persona_context',
  PERSONA_EXPERIENCE = 'persona_experience',
  PERSONA_RESPONSE   = 'persona_response',
  RAW_DATA           = 'raw_data',
  DATA_PROFILE       = 'data_profile',
  RECONSTRUCTED_STUDY = 'reconstructed_study',
  ANALYSIS_PLAN      = 'analysis_plan',
  ANALYSIS_SCRIPT    = 'analysis_script',
  RESULTS            = 'results',
  RESULTS_APA        = 'results_apa',
  FIGURE             = 'figure',
  PAPER_SECTION      = 'paper_section',
  PAPER_DRAFT        = 'paper_draft',
  REVIEW_REPORT      = 'review_report',
  FINAL_PACKAGE      = 'final_package',
}

/**
 * File formats for artifacts.
 */
export enum ArtifactFormat {
  JSON = 'json',
  CSV  = 'csv',
  MD   = 'md',
  PDF  = 'pdf',
  PNG  = 'png',
  R    = 'r',
  PY   = 'py',
  TEX  = 'tex',
  TXT  = 'txt',
}

/**
 * An artifact is a typed intermediate output that flows between phases
 * via the filesystem.
 */
export interface Artifact {
  /** Unique ID, e.g. "scope/research_plan" */
  id: string;

  type: ArtifactType;
  format: ArtifactFormat;

  /**
   * Relative path within the workspace,
   * e.g. "phases/scope/output/research_plan.json"
   */
  path: string;

  /** ID of the PhaseNode that produced this artifact */
  producedBy: string;

  /** Timestamp when artifact was written */
  createdAt?: number;
}

/**
 * Manifest tracking all artifacts in a workspace.
 */
export interface ArtifactManifest {
  projectId: string;
  artifacts: Artifact[];
  updatedAt: number;
}
