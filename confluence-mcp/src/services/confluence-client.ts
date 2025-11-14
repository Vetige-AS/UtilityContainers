import axios, { AxiosInstance } from 'axios';
import { getConfig } from '../utils/config';

interface Space {
  id: string;
  key: string;
  name: string;
}

interface Page {
  id: string;
  title: string;
  spaceKey: string;
  version: {
    number: number;
  };
}

export class ConfluenceClient {
  private client: AxiosInstance;
  
  constructor() {
    const config = getConfig();
    
    this.client = axios.create({
      baseURL: `${config.baseUrl}/rest/api`,
      auth: {
        username: config.username,
        password: config.apiToken
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  async listSpaces(): Promise<Space[]> {
    const response = await this.client.get('/space', {
      params: {
        limit: 100,
        expand: 'description.plain'
      }
    });
    
    return response.data.results.map((space: any) => ({
      id: space.id,
      key: space.key,
      name: space.name
    }));
  }
  
  async listPages(spaceKey: string): Promise<Page[]> {
    const response = await this.client.get('/content', {
      params: {
        spaceKey,
        type: 'page',
        limit: 100,
        expand: 'version'
      }
    });
    
    return response.data.results.map((page: any) => ({
      id: page.id,
      title: page.title,
      spaceKey: page.space.key,
      version: page.version
    }));
  }
  
  async createPage(spaceKey: string, title: string, content: string, parentPageId?: string): Promise<Page> {
    const pageData: any = {
      type: 'page',
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    // Add parent page if specified
    if (parentPageId) {
      pageData.ancestors = [{ id: parentPageId }];
    }

    const response = await this.client.post('/content', pageData);

    return {
      id: response.data.id,
      title: response.data.title,
      spaceKey: response.data.space.key,
      version: response.data.version
    };
  }
  
  async updatePage(pageId: string, title: string, content: string, version: number, parentPageId?: string): Promise<Page> {
    const pageData: any = {
      type: 'page',
      title,
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      },
      version: {
        number: version + 1
      }
    };

    // Add parent page if specified
    if (parentPageId) {
      pageData.ancestors = [{ id: parentPageId }];
    }

    const response = await this.client.put(`/content/${pageId}`, pageData);

    return {
      id: response.data.id,
      title: response.data.title,
      spaceKey: response.data.space.key,
      version: response.data.version
    };
  }
  
  async deletePage(pageId: string): Promise<void> {
    await this.client.delete(`/content/${pageId}`);
  }
}