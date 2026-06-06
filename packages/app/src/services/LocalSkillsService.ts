import type { SkillsService, Skill, HubSkill, CreateSkillInput } from './SkillsService';

export class LocalSkillsService implements SkillsService {
  private skillEngine: any;
  private hubClient: any;
  private skillSearch: any;

  constructor(deps: { skillEngine: any; hubClient: any; skillSearch: any }) {
    this.skillEngine = deps.skillEngine;
    this.hubClient = deps.hubClient;
    this.skillSearch = deps.skillSearch;
  }

  async list(): Promise<Skill[]> {
    return this.skillEngine.list() as Skill[];
  }

  async browse(category?: string): Promise<HubSkill[]> {
    return this.hubClient.browse(category) as HubSkill[];
  }

  async search(query: string): Promise<HubSkill[]> {
    return this.skillSearch.search(query) as HubSkill[];
  }

  async get(name: string): Promise<Skill> {
    return this.skillEngine.get(name) as Skill;
  }

  async install(name: string, force = false): Promise<{ installed: string; message: string }> {
    return this.hubClient.install(name, force);
  }

  async remove(name: string): Promise<{ removed: string }> {
    return this.hubClient.remove(name);
  }

  async run(name: string): Promise<{ result: string }> {
    const result = await this.skillEngine.run(name);
    return { result: typeof result === 'string' ? result : JSON.stringify(result) };
  }

  async create(skill: CreateSkillInput): Promise<Skill> {
    return this.skillEngine.create(skill) as Promise<Skill>;
  }

  async delete(name: string): Promise<{ deleted: string }> {
    await this.skillEngine.delete(name);
    return { deleted: name };
  }
}
