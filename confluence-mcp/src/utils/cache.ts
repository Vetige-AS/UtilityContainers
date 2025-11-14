import fs from 'fs';
import path from 'path';
import NodeCache from 'node-cache';

interface PageMapping {
  markdownPath: string;
  pageId: string;
  spaceKey: string;
  title: string;
  lastUpdated: string;
}

export class MarkdownPageCache {
  private cache: NodeCache;
  private cacheFile: string;
  
  constructor(cacheFilePath?: string) {
    this.cache = new NodeCache({ stdTTL: 0 }); // No expiration
    this.cacheFile = cacheFilePath || path.join(process.cwd(), 'markdown-page-mapping.json');
    this.loadCache();
  }
  
  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        Object.keys(data).forEach(key => {
          this.cache.set(key, data[key]);
        });
        console.log(`Loaded ${Object.keys(data).length} page mappings from cache`);
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
    }
  }
  
  private saveCache(): void {
    try {
      const data = this.cache.mget(this.cache.keys());
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }
  
  getPageMapping(markdownPath: string): PageMapping | undefined {
    return this.cache.get<PageMapping>(markdownPath);
  }
  
  setPageMapping(markdownPath: string, mapping: PageMapping): void {
    this.cache.set(markdownPath, mapping);
    this.saveCache();
  }
  
  removePageMapping(markdownPath: string): void {
    this.cache.del(markdownPath);
    this.saveCache();
  }
  
  getAllMappings(): Record<string, PageMapping> {
    return this.cache.mget(this.cache.keys());
  }
}