export async function* generateSentenceStream(
    llmStream: AsyncIterable<string>
): AsyncGenerator<string, void, unknown> {
    let buffer = "";
    const sentenceBoundaryRegex = /(.*?[.?!])(?:\s|$)|(.*\n)/;

    for await (const chunk of llmStream) {
        buffer += chunk;
        let match;

        while ((match = buffer.match(sentenceBoundaryRegex)) !== null) {
            const completeSentence = match[0];
            yield completeSentence.trim();
            buffer = buffer.slice(completeSentence.length);
        }
    }

    if (buffer.trim().length > 0) {
        yield buffer.trim();
    }
}