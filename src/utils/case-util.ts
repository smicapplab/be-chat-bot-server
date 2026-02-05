export class CaseUtil {
    /**
     * Converts a string to camelCase format.
     * @param str The string to convert.
     * @returns The camelCase version of the string.
     */
    static toCamelCase(str: string): string {
        return str.replace(/([-_][a-z])/g, (group) =>
            group.toUpperCase().replace('-', '').replace('_', '')
        );
    }

    /**
     * Recursively converts all keys of an object or array to camelCase.
     * @param obj The object or array to transform.
     * @returns A new object or array with camelCase keys.
     */
    static keysToCamelCase<T>(obj: T): T {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        if (obj instanceof Date) {
            return obj as T;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.keysToCamelCase(item)) as unknown as T;
        }

        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            const camelKey = CaseUtil.toCamelCase(key);
            result[camelKey] = CaseUtil.keysToCamelCase(value);
        }

        return result as T;
    }

    /**
     * Converts a string to snake_case format.
     * @param str The string to convert.
     * @returns The snake_case version of the string.
     */
    static toSnakeCase(str: string): string {
        return str.replace(/([A-Z])/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
    }

    /**
     * Recursively converts all keys of an object or array to snake_case.
     * @param obj The object or array to transform.
     * @returns A new object or array with snake_case keys.
     */
    static keysToSnakeCase<T>(obj: T): T {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => CaseUtil.keysToSnakeCase(item)) as unknown as T;
        }

        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            const snakeKey = CaseUtil.toSnakeCase(key);
            result[snakeKey] = CaseUtil.keysToSnakeCase(value);
        }

        return result as T;
    }
}