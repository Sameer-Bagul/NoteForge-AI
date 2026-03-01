import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR = path.join(process.cwd(), 'storage', 'cache');

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export class CacheService {
    private getHash(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    private getFilePath(key: string): string {
        return path.join(CACHE_DIR, `${key}.json`);
    }

    async get<T>(key: string): Promise<T | null> {
        const filePath = this.getFilePath(this.getHash(key));
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(data) as T;
            } catch (err) {
                console.warn(`[Cache] Failed to read cache for ${key}:`, err);
                return null;
            }
        }
        return null;
    }

    async set<T>(key: string, value: T): Promise<void> {
        const filePath = this.getFilePath(this.getHash(key));
        try {
            fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
        } catch (err) {
            console.warn(`[Cache] Failed to write cache for ${key}:`, err);
        }
    }

    async clear(): Promise<void> {
        if (fs.existsSync(CACHE_DIR)) {
            const files = fs.readdirSync(CACHE_DIR);
            for (const file of files) {
                fs.unlinkSync(path.join(CACHE_DIR, file));
            }
        }
    }
}

export const cacheService = new CacheService();
