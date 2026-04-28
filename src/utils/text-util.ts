export class TextUtil {
    /**
     * Removes HTML tags and collapses multiple spaces into one.
     * @param input The string to clean.
     * @returns The cleaned string.
     */
    static cleanText(input?: string): string {
        return (input ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }
}
