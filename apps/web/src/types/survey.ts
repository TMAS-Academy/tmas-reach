export type SurveyRoleOption =
  | 'Principal'
  | 'Assistant Principal'
  | 'Math Department Chair'
  | 'STEM Curriculum Director'
  | 'High School Math Teacher'
  | 'Middle School Math Teacher'
  | 'District Administrator'
  | 'Academic Dean'
  | 'Other'

export type SurveyAudienceOption =
  | 'high_school'
  | 'middle_school'
  | 'district_admin'
  | 'educators'
  | 'nonprofit'

export type SurveyStatus = 'pending_review' | 'imported_to_contacts' | 'archived'

export interface SurveySubmission {
  id: string
  email: string
  first_name: string
  last_name: string
  organization: string
  job_role: string
  audience_tag: SurveyAudienceOption
  grade_levels: string[]
  programs_of_interest: string[]
  estimated_students?: number
  notes?: string
  consent_outreach: boolean
  status: SurveyStatus
  submitted_at: string
}

export interface SurveyValidationError {
  field: keyof SurveySubmission
  message: string
}
