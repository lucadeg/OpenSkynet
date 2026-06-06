import { z } from 'zod';
import { apiGet, apiPost, apiDelete } from './apiClient';
import {
  NetworkError,
  ValidationError,
  isAppError,
} from '@/errors';

export const SkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  version: z.number(),
});

export type Skill = z.infer<typeof SkillSchema>;

export const HubSkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  author: z.string().nullable(),
  version: z.string(),
  trust: z.string(),
});

export type HubSkill = z.infer<typeof HubSkillSchema>;

export const SkillResultSchema = z.object({
  result: z.string(),
});

export interface SkillsService {
  list(): Promise<Skill[]>;
  browse(category?: string): Promise<HubSkill[]>;
  search(query: string): Promise<HubSkill[]>;
  get(name: string): Promise<Skill>;
  install(name: string, force?: boolean): Promise<{ installed: string; message: string }>;
  remove(name: string): Promise<{ removed: string }>;
  run(name: string): Promise<{ result: string }>;
  create(skill: CreateSkillInput): Promise<Skill>;
  delete(name: string): Promise<{ deleted: string }>;
}

export interface CreateSkillInput {
  name: string;
  description: string;
  steps: unknown[];
  category?: string;
  when_to_use?: string;
  pitfalls?: string[];
  verification?: string;
}

class HttpSkillsService implements SkillsService {
  async list(): Promise<Skill[]> {
    try {
      const response = await apiGet<Skill[]>('/api/skills');
      const skills: Skill[] = [];
      for (const skill of response) {
        const validated = SkillSchema.safeParse(skill);
        if (validated.success) {
          skills.push(validated.data);
        }
      }
      return skills;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to list skills');
    }
  }

  async browse(category?: string): Promise<HubSkill[]> {
    try {
      const params: Record<string, string> = {};
      if (category) params.category = category;
      const response = await apiGet<HubSkill[]>('/api/hub/browse', params);
      const skills: HubSkill[] = [];
      for (const skill of response) {
        const validated = HubSkillSchema.safeParse(skill);
        if (validated.success) {
          skills.push(validated.data);
        }
      }
      return skills;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to browse skills');
    }
  }

  async search(query: string): Promise<HubSkill[]> {
    if (!query || query.trim().length === 0) {
      throw new ValidationError('Search query cannot be empty');
    }

    try {
      const response = await apiGet<HubSkill[]>('/api/hub/search', { query });
      const skills: HubSkill[] = [];
      for (const skill of response) {
        const validated = HubSkillSchema.safeParse(skill);
        if (validated.success) {
          skills.push(validated.data);
        }
      }
      return skills;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to search skills');
    }
  }

  async get(name: string): Promise<Skill> {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Skill name cannot be empty');
    }

    try {
      const response = await apiGet<Skill>('/api/skills/' + name);
      const validated = SkillSchema.safeParse(response);
      if (!validated.success) {
        throw new NetworkError('Invalid response from skills.get');
      }
      return validated.data;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to get skill');
    }
  }

  async install(name: string, force = false): Promise<{ installed: string; message: string }> {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Skill name cannot be empty');
    }

    try {
      return await apiPost<{ installed: string; message: string }>('/api/hub/install', {
        name,
        force,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to install skill');
    }
  }

  async remove(name: string): Promise<{ removed: string }> {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Skill name cannot be empty');
    }

    try {
      return await apiDelete<{ removed: string }>('/api/hub/' + name);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to remove skill');
    }
  }

  async run(name: string): Promise<{ result: string }> {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Skill name cannot be empty');
    }

    try {
      const response = await apiPost<{ result: string }>('/api/skills/' + name + '/run');
      const validated = SkillResultSchema.safeParse(response);
      if (!validated.success) {
        throw new NetworkError('Invalid response from skills.run');
      }
      return validated.data;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to run skill');
    }
  }

  async create(skill: CreateSkillInput): Promise<Skill> {
    try {
      const response = await apiPost<Skill>('/api/skills', skill);
      const validated = SkillSchema.safeParse(response);
      if (!validated.success) {
        throw new NetworkError('Invalid response from skills.create');
      }
      return validated.data;
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to create skill');
    }
  }

  async delete(name: string): Promise<{ deleted: string }> {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Skill name cannot be empty');
    }

    try {
      return await apiDelete<{ deleted: string }>('/api/skills/' + name);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new NetworkError('Failed to delete skill');
    }
  }
}

export function createSkillsService(): SkillsService {
  return new HttpSkillsService();
}
