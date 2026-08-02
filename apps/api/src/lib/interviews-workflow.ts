// apps/api/src/lib/interviews-workflow.ts
export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'time'
  | 'yes_no'
  | 'multiple_choice'
  | 'multi_select'
  | 'file_upload'
  | 'photo_upload';

export type InterviewStatus = 'draft' | 'in_progress' | 'completed' | 'archived';

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  description?: string;
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    customValidation?: string;
  };
  options?: string[]; // For multiple choice
  conditional?: {
    dependsOn: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  };
  metadata?: Record<string, any>;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  order: number;
}

export interface InterviewTemplate {
  templateId: string;
  name: string;
  description?: string;
  version: string;
  sections: Section[];
  settings: {
    autosave: boolean;
    autosaveInterval: number; // seconds
    allowResume: boolean;
    allowEditAfterComplete: boolean;
    showProgress: boolean;
    showSectionNavigation: boolean;
  };
}

export interface InterviewResponse {
  questionId: string;
  value: any;
  timestamp: string;
}

export interface ConversationEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class InterviewWorkflowService {
  /**
   * Validate a question response
   */
  static validateResponse(question: Question, value: any): { valid: boolean; error?: string } {
    if (question.required && (value === null || value === undefined || value === '')) {
      return { valid: false, error: 'This field is required' };
    }

    if (value === null || value === undefined || value === '') {
      return { valid: true };
    }

    const validation = question.validation;
    if (!validation) return { valid: true };

    switch (question.type) {
      case 'number':
      case 'currency': {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) {
          return { valid: false, error: 'Must be a valid number' };
        }
        if (validation.min !== undefined && numValue < validation.min) {
          return { valid: false, error: `Must be at least ${validation.min}` };
        }
        if (validation.max !== undefined && numValue > validation.max) {
          return { valid: false, error: `Must be at most ${validation.max}` };
        }
        break;
      }

      case 'short_text':
      case 'long_text':
        if (validation.min !== undefined && value.length < validation.min) {
          return { valid: false, error: `Must be at least ${validation.min} characters` };
        }
        if (validation.max !== undefined && value.length > validation.max) {
          return { valid: false, error: `Must be at most ${validation.max} characters` };
        }
        if (validation.pattern) {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(value)) {
            return { valid: false, error: 'Invalid format' };
          }
        }
        break;

      case 'multiple_choice':
        if (!question.options?.includes(value)) {
          return { valid: false, error: 'Invalid selection' };
        }
        break;

      case 'multi_select': {
        if (!Array.isArray(value)) {
          return { valid: false, error: 'Must be an array' };
        }
        const invalidOptions = value.filter((v: string) => !question.options?.includes(v));
        if (invalidOptions.length > 0) {
          return { valid: false, error: 'Invalid selections' };
        }
        break;
      }

      case 'yes_no':
        if (typeof value !== 'boolean') {
          return { valid: false, error: 'Must be yes or no' };
        }
        break;

      case 'date': {
        const dateValue = new Date(value);
        if (isNaN(dateValue.getTime())) {
          return { valid: false, error: 'Invalid date' };
        }
        break;
      }

      case 'time': {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(value)) {
          return { valid: false, error: 'Invalid time format (HH:MM)' };
        }
        break;
      }
    }

    return { valid: true };
  }

  /**
   * Check if a question should be displayed based on conditional logic
   */
  static shouldDisplayQuestion(question: Question, responses: Record<string, any>): boolean {
    if (!question.conditional) return true;

    const { dependsOn, operator, value } = question.conditional;
    const dependentValue = responses[dependsOn];

    switch (operator) {
      case 'equals':
        return dependentValue === value;
      case 'not_equals':
        return dependentValue !== value;
      case 'contains':
        return Array.isArray(dependentValue) ? dependentValue.includes(value) : String(dependentValue).includes(value);
      case 'greater_than':
        return Number(dependentValue) > Number(value);
      case 'less_than':
        return Number(dependentValue) < Number(value);
      default:
        return true;
    }
  }

  /**
   * Get visible questions for a section based on responses
   */
  static getVisibleQuestions(section: Section, responses: Record<string, any>): Question[] {
    return section.questions.filter(question => this.shouldDisplayQuestion(question, responses));
  }

  /**
   * Calculate interview progress
   */
  static calculateProgress(template: InterviewTemplate, responses: Record<string, any>): number {
    let totalQuestions = 0;
    let answeredQuestions = 0;

    template.sections.forEach(section => {
      section.questions.forEach(question => {
        if (this.shouldDisplayQuestion(question, responses)) {
          totalQuestions++;
          if (responses[question.id] !== undefined && responses[question.id] !== null && responses[question.id] !== '') {
            answeredQuestions++;
          }
        }
      });
    });

    if (totalQuestions === 0) return 0;
    return (answeredQuestions / totalQuestions) * 100;
  }

  /**
   * Get next question in the interview
   */
  static getNextQuestion(template: InterviewTemplate, currentSectionId: string, currentQuestionId: string, responses: Record<string, any>): { section: Section; question: Question } | null {
    let foundCurrent = false;

    for (const section of template.sections) {
      const visibleQuestions = this.getVisibleQuestions(section, responses);
      
      for (const question of visibleQuestions) {
        if (foundCurrent) {
          return { section, question };
        }
        
        if (section.id === currentSectionId && question.id === currentQuestionId) {
          foundCurrent = true;
        }
      }
    }

    return null;
  }

  /**
   * Get previous question in the interview
   */
  static getPreviousQuestion(template: InterviewTemplate, currentSectionId: string, currentQuestionId: string, responses: Record<string, any>): { section: Section; question: Question } | null {
    let previousSection: Section | null = null;
    let previousQuestion: Question | null = null;

    for (const section of template.sections) {
      const visibleQuestions = this.getVisibleQuestions(section, responses);
      
      for (const question of visibleQuestions) {
        if (section.id === currentSectionId && question.id === currentQuestionId) {
          if (previousSection && previousQuestion) {
            return { section: previousSection, question: previousQuestion };
          }
          return null;
        }
        
        previousSection = section;
        previousQuestion = question;
      }
    }

    return null;
  }

  /**
   * Get first question of the interview
   */
  static getFirstQuestion(template: InterviewTemplate, responses: Record<string, any>): { section: Section; question: Question } | null {
    for (const section of template.sections) {
      const visibleQuestions = this.getVisibleQuestions(section, responses);
      if (visibleQuestions.length > 0) {
        return { section, question: visibleQuestions[0] };
      }
    }
    return null;
  }

  /**
   * Check if interview is complete
   */
  static isInterviewComplete(template: InterviewTemplate, responses: Record<string, any>): boolean {
    for (const section of template.sections) {
      const visibleQuestions = this.getVisibleQuestions(section, responses);
      
      for (const question of visibleQuestions) {
        if (question.required) {
          const value = responses[question.id];
          if (value === undefined || value === null || value === '') {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Get required fields that are still missing
   */
  static getMissingRequiredFields(template: InterviewTemplate, responses: Record<string, any>): Question[] {
    const missing: Question[] = [];

    for (const section of template.sections) {
      const visibleQuestions = this.getVisibleQuestions(section, responses);
      
      for (const question of visibleQuestions) {
        if (question.required) {
          const value = responses[question.id];
          if (value === undefined || value === null || value === '') {
            missing.push(question);
          }
        }
      }
    }

    return missing;
  }

  /**
   * Add conversation entry
   */
  static addConversationEntry(
    history: ConversationEntry[],
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): ConversationEntry[] {
    const entry: ConversationEntry = {
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    };

    return [...history, entry];
  }

  /**
   * Generate interview number
   */
  static generateInterviewNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `INT-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Extract structured data from responses for claim generation
   */
  static extractClaimData(responses: Record<string, any>, template: InterviewTemplate): any {
    const data: any = {
      customer: {},
      property: {},
      claim: {},
      adjuster: {},
      documents: [],
    };

    // Map response keys to claim data based on question metadata
    template.sections.forEach(section => {
      section.questions.forEach(question => {
        const value = responses[question.id];
        if (value === undefined || value === null || value === '') return;

        const mapping = question.metadata?.mapping;
        if (!mapping) return;

        const [entity, field] = mapping.split('.');
        if (data[entity]) {
          data[entity][field] = value;
        }
      });
    });

    return data;
  }
}
