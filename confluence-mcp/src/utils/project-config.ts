import * as fs from 'fs';
import * as path from 'path';

export interface ProjectConfig {
  confluenceUrl: string;
  username: string;
  apiToken: string;
  spaceKey: string;
  parentPageTitle?: string;
  parentPageId?: string;
  baseDir?: string;
  lastUpdated: string;
}

export class ProjectConfigManager {
  private configPath: string;
  private config: ProjectConfig | null = null;

  constructor(configPath: string = './confluence-project-config.json') {
    this.configPath = configPath;
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(configData);
      }
    } catch (error) {
      console.warn('Failed to load project config:', error);
      this.config = null;
    }
  }

  public saveConfig(config: Partial<ProjectConfig>): void {
    const newConfig: ProjectConfig = {
      ...this.config,
      ...config,
      lastUpdated: new Date().toISOString()
    } as ProjectConfig;

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2));
      this.config = newConfig;
    } catch (error) {
      throw new Error(`Failed to save project config: ${error}`);
    }
  }

  public getConfig(): ProjectConfig | null {
    return this.config;
  }

  public isConfigured(): boolean {
    return this.config !== null && 
           !!this.config.confluenceUrl && 
           !!this.config.username && 
           !!this.config.apiToken && 
           !!this.config.spaceKey;
  }

  public getSpaceKey(): string | null {
    return this.config?.spaceKey || null;
  }

  public getParentPageTitle(): string | null {
    return this.config?.parentPageTitle || null;
  }

  public getParentPageId(): string | null {
    return this.config?.parentPageId || null;
  }

  public getBaseDir(): string | null {
    return this.config?.baseDir || null;
  }

  public updateParentPageId(pageId: string): void {
    if (this.config) {
      this.config.parentPageId = pageId;
      this.saveConfig(this.config);
    }
  }

  public clearConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
      this.config = null;
    } catch (error) {
      throw new Error(`Failed to clear project config: ${error}`);
    }
  }
}
