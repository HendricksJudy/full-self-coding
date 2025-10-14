/**
 * Trims a string to extract a valid JSON object.
 * It removes all text before the first '{' and after the last '}'.
 * 
 * @param jsonString The string containing the JSON object.
 * @returns A string containing only the JSON object, or an empty string if no valid JSON object is found.
 */
export function trimJSON(jsonString: string): string {
    const firstBracket = jsonString.indexOf('[');
    const lastBracket = jsonString.lastIndexOf(']');

    if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
        return '';
    }

    return jsonString.substring(firstBracket, lastBracket + 1);
}
